/// <reference path='../../../third_party/typings/index.d.ts' />

// DataPeer - a class that wraps peer connections and data channels.
//
// This class assumes WebRTC is available; this is provided by the cross-
// platform compatibility library webrtc-adaptor.js (from:
// https://code.google.com/p/webrtc/source/browse/stable/samples/js/base/adapter.js)

import handler = require('../handler/queue');
import arraybuffers = require('../arraybuffers/arraybuffers');
import logging = require('../logging/logging');

declare const freedom: freedom.FreedomInModuleEnv;

var log: logging.Log = new logging.Log('DataChannel');

// Messages are limited to a 16KB length by SCTP. For maximum efficiency,
// this size should match the buffer size used by Freedom's TCP connection.
// http://tools.ietf.org/html/draft-ietf-rtcweb-data-channel-07#section-6.6
export var CHUNK_SIZE = 1024 * 16;

// The maximum amount of bytes we should allow to get queued up in
// peerconnection. Any more and we start queueing in JS. There are two reasons
// to limit this:
// 1. Data channels are closed by WebRTC when the buffer fills, so we really
// don't want that to happen accidentally. More info in this thread, which
// mentions a limit of 16MB for Chrome 37+ and 100 messages for previous versions:
//   https://code.google.com/p/webrtc/issues/detail?id=2866

// 2. This limit sets the reaction time for backpressure.  Having extremely fast
// backpressure reaction time is crucial to preventing a huge backlog of TCP
// data events.  If CHURN is enabled, this backlog also blocks all UDP data
// transmission, and if the backlog exceeds 5 seconds, it can cause the
// PeerConnection to experience ICE disconnection.

// Setting this value to zero would give the fastest possible backpressure
// reaction time, by pausing the socket after every message, forcing a call to
// "getBufferedAmount", and only resuming the socket  after the message is
// actually sent.  This appears to improve our resilience to disconnection when
// downloading from super-fast servers
// (https://github.com/uProxy/uproxy/issues/1511) or loading many pages
// simultaneously.  However, lowering this value to zero also effectively
// negates the performance benefits from
// https://github.com/uProxy/uproxy/issues/1474, and even further regresses
// the CPU intensity.  In testing on slow sharers with ultra-fast sources,
// 64 KiB seems to be the largest safe value, and when loading many pages
// simultaneously, 16 KiB seems to be the largest safe value.
export var PC_QUEUE_LIMIT = 16 * 1024;

// Javascript has trouble representing integers larger than 2^53. So we simply
// don't support trying to send array's bigger than that.
var MAX_MESSAGE_SIZE = Math.pow(2, 53);

interface StringData { str :string; }
interface BufferData { buffer :ArrayBuffer; }

export interface DataChannel {
  // Guaranteed to be invariant for the life of the data channel.
  getLabel : () => string;

  // Promise for when the data channel has been opened.
  onceOpened : Promise<void>;

  // Promise for when the data channel has been closed (only fulfilled after
  // the data channel has been opened).
  // NOTE: There exists a bug in Chrome prior to version 37 which prevents
  //       this from fulfilling on the remote peer.
  onceClosed : Promise<void>;

  // Data from the peer. No data will be added to the queue after |onceClosed|
  // is fulfilled.
  dataFromPeerQueue :handler.QueueHandler<Data, void>;

  // Send data; promise returns when all the data has been passed on to the
  // undertlying network layer for ending.
  send(data:Data) : Promise<void>;

  // Returns the number of bytes which have been passed to the browser but
  // which have not yet been handed off to usrsctplib.
  getBrowserBufferedAmount() : Promise<number>;

  // Returns the number of bytes which have been passed to send() but
  // which have not yet been handed off to the browser.
  getJavascriptBufferedAmount() : number;

  // Returns whether the send buffer is currently in an overflow state.
  isInOverflow() : boolean;

  // Registers a function that will be called whenever the browser buffer
  // overflows into the javascript buffer, and whenever the overflow is
  // cleared.  There can only be one listener at a time.  Pass null to unset.
  setOverflowListener(listener:(overflow:boolean) => void) : void;

  // Closes this data channel once all outgoing messages have been sent.
  // A channel cannot be re-opened once this has been called.
  close() : Promise<void>;

  toString() : string;
}

// Data sent to or received from a peer on a data channel in the peer
// connection.
export interface Data {
  str ?:string;
  buffer ?:ArrayBuffer;
  // TODO: add when supported by WebRtc in Chrome and FF.
  // https://code.google.com/p/webrtc/issues/detail?id=2276
  //
  // bufferView  ?:ArrayBufferView;
  // blob        ?:Blob
  // domString   ?:DOMString
}

// Wrapper for a WebRtc Data Channels:
// http://dev.w3.org/2011/webrtc/editor/webrtc.html#rtcdatachannel
//
export class DataChannelClass implements DataChannel {

  public dataFromPeerQueue      :handler.Queue<Data,void>;

  // The |toPeerDataQueue_| is chunked by the send call and congestion
  // controlled by the handler this class sets.
  private toPeerDataQueue_        :handler.Queue<Data,void>;
  // This is the total number of bytes in all the ArrayBuffers in
  // toPeerDataQueue_.
  // TODO: Count bytes in strings as well.
  private toPeerDataBytes_        :number;

  // This is an upper bound on |bufferedAmount|, which is updated
  // (increased) on each call to send.  (However, these updates do not
  // account for string messages.)
  private lastBrowserBufferedAmount_ :number;

  public onceOpened      :Promise<void>;
  public onceClosed      :Promise<void>;

  // True iff close() has been called.
  private draining_ = false;
  private fulfillDrained_ :() => void;
  private onceDrained_ = new Promise((F, R) => {
    this.fulfillDrained_ = F;
  });

  // True between onceOpened and onceClosed
  private isOpen_ :boolean;
  private rejectOpened_  :(e:Error) => void;

  private overflow_ :boolean = false;
  private overflowListener_ :(overflow:boolean) => void = null;

  public getLabel = () : string => { return this.label_; }

  // |rtcDataChannel_| is the freedom rtc data channel.
  // |label_| is the rtcDataChannel_.getLabel() result
  constructor(private rtcDataChannel_:freedom.RTCDataChannel.RTCDataChannel,
              private label_ = '') {
    this.dataFromPeerQueue = new handler.Queue<Data,void>();
    this.toPeerDataQueue_ = new handler.Queue<Data,void>();
    this.toPeerDataBytes_ = 0;
    this.lastBrowserBufferedAmount_ = 0;

    this.onceOpened = new Promise<void>((F,R) => {
      this.rejectOpened_ = R;
      this.rtcDataChannel_.getReadyState().then((state:string) => {
        // RTCDataChannels created by a RTCDataChannelEvent have an initial
        // state of open, so the onopen event for the channel will not
        // fire. We need to fire the onOpenDataChannel event here
        // http://www.w3.org/TR/webrtc/#idl-def-RTCDataChannelState
        if (state === 'open') {
          F();
        } else if (state === 'connecting') {
          // Firefox channels do not have an initial state of 'open'
          // See https://bugzilla.mozilla.org/show_bug.cgi?id=1000478
          this.rtcDataChannel_.on('onopen', F);
        }
      });
    });
    this.onceClosed = new Promise<void>((F,R) => {
        this.rtcDataChannel_.on('onclose', F);
      });
    this.rtcDataChannel_.on('onmessage', this.onDataFromPeer_);
    this.rtcDataChannel_.on('onerror', (e:Event) => {
      log.error('rtcDataChannel_.onerror: ' + e.toString);
    });
    this.onceOpened.then(() => {
      this.isOpen_ = true;
      this.sendNext_();
    }, (e:Error) => {
      log.debug('failed to open');
    });
    this.onceClosed.then(() => {
        if(!this.isOpen_) {
          // Make sure to reject the onceOpened promise if state went from
          // |connecting| to |close|.
          this.rejectOpened_(new Error(
              'Failed to open; closed while trying to open.'));
        }
        this.isOpen_ = false;
      });
    this.onceDrained_.then(() => {
      log.debug('all messages sent, closing');
      this.rtcDataChannel_.close();
    });
  }


  // Handle data we get from the peer by putting it, appropriately wrapped, on
  // the queue of data from the peer.
  private onDataFromPeer_ = (message:freedom.RTCDataChannel.Message) : void => {
    if (typeof message.text === 'string') {
      this.dataFromPeerQueue.handle({str: message.text});
    } else if (message.buffer instanceof ArrayBuffer) {
      this.dataFromPeerQueue.handle({buffer: message.buffer});
    } else {
      log.error('Unexpected data from peer: %1', message);
    }
  }

  // Promise completes once all the data has been sent. This is async because
  // there may be more data than fits in the buffer; we do chunking so that
  // data larger than the SCTP message size limit (about 16k) can be sent and
  // received reliably, and so that the internal buffer is not over-filled. If
  // data is too big we also fail.
  //
  // CONSIDER: We could support blob data by streaming into array-buffers.
  public send = (data:Data) : Promise<void> => {
    // Note: you cannot just write |if(data.str) ...| because str may be empty
    // which is treated as false. You have to do something more verbose, like
    // |if (typeof data.str === 'string') ...|.
    if (!(typeof data.str === 'string' ||
         (typeof data.buffer === 'object') &&
           (data.buffer instanceof ArrayBuffer)) ) {
      return Promise.reject(
          new Error('data to send must have at least `str:string` or ' +
              '`buffer:ArrayBuffer` defined (typeof data.str === ' +
              typeof data.str + '; typeof data.buffer === ' +
              typeof data.buffer +
              '; data.buffer instanceof ArrayBuffer === ' +
              (data.buffer instanceof ArrayBuffer) + ')'));
    }

    if (this.draining_) {
      return Promise.reject(new Error('send was called after close'));
    }

    var byteLength :number;
    if (typeof data.str === 'string') {
      // This calculation is based on the idea that JS strings are utf-16,
      // but since all strings are converted  to UTF-8 by the data channel
      // this calculation is only an approximate upper bound on the actual
      // message size.
      byteLength = data.str.length * 2;
    } else if (data.buffer) {
      byteLength = data.buffer.byteLength;
    }

    if(byteLength > MAX_MESSAGE_SIZE) {
      return Promise.reject(new Error(
          'Data was too big to send, sorry. ' +
          'Need to wait for real Blob support.'));
    }

    if(typeof data.str === 'string') {
      return this.chunkStringOntoQueue_({str:data.str});
    } else if(data.buffer) {
      return this.chunkBufferOntoQueue_({buffer:data.buffer});
    }
  }

  // TODO: add an issue for chunking strings, write issue number here, then
  // write the code and resolve the issue :-)
  private chunkStringOntoQueue_ = (data:StringData) : Promise<void> => {
    return this.toPeerDataQueue_.handle(data);
  }

  private chunkBufferOntoQueue_ = (data:BufferData) : Promise<void> => {
    var chunks = arraybuffers.chunk(data.buffer, CHUNK_SIZE);
    var promises :Promise<void>[] = [];
    chunks.forEach((chunk) => {
      this.toPeerDataBytes_ += chunk.byteLength;
      promises.push(this.toPeerDataQueue_.handle({buffer: chunk}));
    });

    // CONSIDER: can we change the interface to support not having the dummy
    // extra return at the end?
    return Promise.all(promises).then(() => { return; });
  }

  // Assumes data is chunked.
  private handleSendDataToPeer_ = (data:Data) : void => {
    if (typeof data.str === 'string') {
      this.rtcDataChannel_.send.reckless(data.str);
    } else if (data.buffer) {
      this.toPeerDataBytes_ -= data.buffer.byteLength;
      this.rtcDataChannel_.sendBuffer.reckless(data.buffer);
      this.lastBrowserBufferedAmount_ += data.buffer.byteLength;
    } else {
      // If type-safety is ensured at compile time, this should never happen.
      throw new Error('Bad data: ' + JSON.stringify(data));
    }
    this.sendNext_();
  }

  // Sets the overflow state, and calls the listener if it has changed.
  private setOverflow_ = (overflow:boolean) => {
    if (this.overflowListener_ && this.overflow_ !== overflow) {
      this.overflowListener_(overflow);
    }
    this.overflow_ = overflow;
  }

  private canSendMore_ = () : boolean => {
    return this.isOpen_ && this.lastBrowserBufferedAmount_ <= PC_QUEUE_LIMIT;
  }

  private sendNext_ = () : void => {
    if (!this.canSendMore_()) {
      this.setOverflow_(true);
      this.waitForOverflowToClear_();
      return;
    }
    if (this.toPeerDataQueue_.getLength() === 0) {
      this.setOverflow_(false);
    }
    if (this.toPeerDataQueue_.isHandling()) {
      log.error('Last packet handler should not still be present');
      this.close();
      return;
    }
    this.toPeerDataQueue_.setSyncNextHandler(this.handleSendDataToPeer_);
  }

  private waitForOverflowToClear_ = () : void => {
    this.rtcDataChannel_.getBufferedAmount().then((bufferedAmount:number) => {
      this.lastBrowserBufferedAmount_ = bufferedAmount;

      if (this.canSendMore_()) {
        this.sendNext_();
      } else if (this.isOpen_) {
        // TODO: Remove polling once https://code.google.com/p/webrtc/issues/detail?id=4613
        // is resolved (adding an event to RTCDataChannel).
        setTimeout(this.waitForOverflowToClear_, 20);
      }
    });
  }

  // Closes asynchronously, after waiting for all outgoing messages.
  public close = () : Promise<void> => {
    log.debug('close requested (%1 messages and %2 bytes to send)',
        this.toPeerDataQueue_.getLength(),
        this.lastBrowserBufferedAmount_);

    var onceJavascriptBufferDrained = new Promise((F, R) => {
      if (this.getJavascriptBufferedAmount() > 0) {
        this.setOverflowListener((overflow:boolean) => {
          if (!overflow) {
            F();
          }
        });
      } else {
        F();
      }
      this.draining_ = true;
    });

    onceJavascriptBufferDrained.then(this.waitForBrowserToDrain_).then(
      this.fulfillDrained_);

    return this.onceClosed;
  }

  private waitForBrowserToDrain_ = () : Promise<void> => {
    var drained :() => void;
    var onceBrowserBufferDrained :Promise<void> =
        new Promise<void>((F, R) => {
      drained = F;
    });

    var loop = () : void => {
      this.getBrowserBufferedAmount().then((amount:number) => {
        if (amount === 0) {
          drained();
        } else if (this.isOpen_) {
          setTimeout(loop, 20);
        } else {
          log.warn('Data channel was closed remotely with %1 bytes buffered',
                   amount);
        }
      });
    };

    loop();
    return onceBrowserBufferDrained;
  }

  public getBrowserBufferedAmount = () : Promise<number> => {
    return this.rtcDataChannel_.getBufferedAmount();
  }

  public getJavascriptBufferedAmount = () : number => {
    return this.toPeerDataBytes_;
  }

  public isInOverflow = () : boolean => {
    return this.overflow_;
  }

  public setOverflowListener = (listener:(overflow:boolean) => void) => {
    if (this.draining_) {
      throw new Error('Can\'t set overflow listener after close');
    }

    this.overflowListener_ = listener;
  }

  public toString = () : string => {
    var s = this.getLabel() + ': isOpen_=' + this.isOpen_;
    return s;
  }

  // This setter is not part of the DataChannel interface, and is only for
  // use by the static constructor.
  public setLabel = (label:string) => {
    if (this.label_ !== '') {
      throw new Error('Data Channel label was set twice, to '
          + this.label_ + ' and ' + label);
    }
    this.label_ = label;
  }
}  // class DataChannelClass

// Static constructor which constructs a core.rtcdatachannel instance
// given a core.rtcdatachannel GUID.
export function createFromFreedomId(id:string) : Promise<DataChannel> {
  return createFromRtcDataChannel(freedom['core.rtcdatachannel'](id));
}

// Static constructor which constructs a core.rtcdatachannel instance
// given a core.rtcdatachannel instance.
export function createFromRtcDataChannel(
    rtcDataChannel:freedom.RTCDataChannel.RTCDataChannel) : Promise<DataChannel> {
  // We need to construct the data channel synchronously to avoid missing any
  // early 'onmessage' events.
  var dc = new DataChannelClass(rtcDataChannel);
  return rtcDataChannel.setBinaryType('arraybuffer').then(() => {
    return rtcDataChannel.getLabel().then((label:string) => {
      dc.setLabel(label);
      return dc;
    });
  });
}
