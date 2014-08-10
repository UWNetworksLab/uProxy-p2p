/// <reference path='../handler/queue.ts' />
/// <reference path="../third_party/typings/es6-promise/es6-promise.d.ts" />
/// <reference path='../third_party/typings/webrtc/RTCPeerConnection.d.ts' />

// DataPeer - a class that wraps peer connections and data channels.
//
// This class assumes WebRTC is available; this is provided by the cross-
// platform compatibility library webrtc-adaptor.js (from:
// https://code.google.com/p/webrtc/source/browse/stable/samples/js/base/adapter.js)

module WebRtc {

  // Messages are limited to a 16KB length by SCTP; we use 15k for safety.
  // TODO: test if we can up this to 16k; test the edge-cases!
  // http://tools.ietf.org/html/draft-ietf-rtcweb-data-channel-07#section-6.6
  var CHUNK_SIZE = 1024 * 15;
  // The maximum amount of bytes we should allow to get queued up in
  // peerconnection. Any more and we start queueing in JS. Data channels are
  // closed by WebRTC when the buffer fills, so we really don't want that happen
  // accidentally. More info in this thread (note that 250Kb is well below both
  // the 16MB for Chrome 37+ and "100 messages" of previous versions mentioned):
  //   https://code.google.com/p/webrtc/issues/detail?id=2866
  // CONSIDER: make it 0. There is no size in the spec.
  var PC_QUEUE_LIMIT = 1024 * 250;
  // Javascript has trouble representing integers larger than 2^53. So we simply
  // don't support trying to send array's bigger than that.
  var MAX_MESSAGE_SIZE = Math.pow(2, 53);

  // Data sent to or received from a peer on a data channel in the peer
  // connection.
  export interface Data {
    str ?:string;
    buffer ?:Uint8Array;
    // TODO: add when supported by WebRtc in Chrome and FF.
    // https://code.google.com/p/webrtc/issues/detail?id=2276
    //
    // bufferView  ?:ArrayBufferView;
    // blob        ?:Blob
    // domString   ?:DOMString
  }
  interface StringData {
    str :string;
  }
  interface BufferData {
    buffer :Uint8Array;
  }

  // Wrapper for a WebRtc Data Channels:
  // http://dev.w3.org/2011/webrtc/editor/webrtc.html#rtcdatachannel
  //
  //
  export class DataChannel {

    public dataFromPeerQueue      :Handler.Queue<Data,void>;

    // The |toPeerDataQueue_| is chunked by the send call and conjection
    // controlled by the handler this class sets.
    private toPeerDataQueue_        :Handler.Queue<Data,void>;

    public onceOpened      :Promise<void>;
    public onceClosed       :Promise<void>;

    private label_ :string;
    private wasOpenned_     :boolean;
    private rejectOpened_  :(e:Error) => void;

    public getLabel = () : string => {
      return this.label_;
    }

    public getState = () : string => {
      return this.rtcDataChannel_.readyState;
    }

    // Wrapper for
    constructor(private rtcDataChannel_:RTCDataChannel) {
      this.label_ = this.rtcDataChannel_.label;
      this.dataFromPeerQueue = new Handler.Queue<Data,void>();
      this.toPeerDataQueue_ = new Handler.Queue<Data,void>();
      this.onceOpened = new Promise<void>((F,R) => {
          this.rejectOpened_ = R;
          // RTCDataChannels created by a RTCDataChannelEvent have an initial
          // state of open, so the onopen event for the channel will not
          // fire. We need to fire the onOpenDataChannel event here
          // http://www.w3.org/TR/webrtc/#idl-def-RTCDataChannelState
          if (rtcDataChannel_.readyState === 'open') { F(); }
          // Firefox channels do not have an initial state of 'open'
          // See https://bugzilla.mozilla.org/show_bug.cgi?id=1000478
          if (rtcDataChannel_.readyState === 'connecting') {
            rtcDataChannel_.onopen = (e:Event) => { F(); };
          }
        });
      this.onceClosed = new Promise<void>((F,R) => {
          this.rtcDataChannel_.onclose = (e:Event) => { F(); };
        });
      this.rtcDataChannel_.onmessage = this.onDataFromPeer_;
      this.rtcDataChannel_.onerror = console.error;

      // Make sure to reject the onceOpened promise if state went from
      // |connecting| to |close|.
      this.onceOpened.then(() => {
        this.wasOpenned_ = true;
        this.toPeerDataQueue_.setHandler(this.handleSendDataToPeer_);
      });
      this.onceClosed.then(() => {
          if(!this.wasOpenned_) { this.rejectOpened_(new Error(
              'Failed to open; closed while trying to open.')); }
        });
    }

    // Handle data we get from the peer by putting it, appropriately wrapped, on
    // the queue of data from the peer.
    private onDataFromPeer_ = (messageEvent : RTCMessageEvent) : void => {
      if (typeof messageEvent.data === 'string') {
        this.dataFromPeerQueue.handle({str: messageEvent.data});
      } else if (typeof messageEvent.data === 'ArrayBuffer') {
        this.dataFromPeerQueue.handle({buffer: messageEvent.data});
      } else {
        console.error('Unexpected data from peer that has type: ' +
            JSON.stringify(messageEvent));
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
      if (!(data.str || data.buffer)) {
        return Promise.reject(
            new Error('data must have at least string or buffer set'));
      }

      var byteLength :number;
      if (data.str) {
        // JS strings are utf-16.
        byteLength = data.str.length * 2;
      } else if (data.buffer) {
        byteLength = data.buffer.byteLength;
      }

      if(byteLength > MAX_MESSAGE_SIZE) {
        return Promise.reject(new Error(
            'Data was too big to send, sorry. ' +
            'Need to wait for real Blob support.'));
      }

      if(data.str) {
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
      var startByte :number = 0;
      var endByte :number;
      var promises :Promise<void>[] = [];
      while(startByte < data.buffer.byteLength) {
        endByte = Math.min(startByte + CHUNK_SIZE, data.buffer.byteLength);
        promises.push(this.toPeerDataQueue_.handle(
            {buffer: data.buffer.subarray(startByte, endByte)}));
        startByte += CHUNK_SIZE;
      }

      // CONSIDER: can we change the interface to support not having the dummy
      // extra return at the end?
      return Promise.all(promises)
          .then<void>((_) => { return; });
    }

    // Assumes data is chunked.
    private handleSendDataToPeer_ = (data:Data) : Promise<void> => {
      if(data.str) {
        this.rtcDataChannel_.send(data.str);
      } else if(data.buffer) {
        this.rtcDataChannel_.send(data.buffer);
      } else {
        return Promise.reject(new Error(
            'Bad data: ' + JSON.stringify(data)));
      }
      this.conjestionControlSendHandler();
      return Promise.resolve<void>();
    }

    // TODO: make this timeout adaptive so that we keep the buffer as full
    // as we can without wasting timeout callbacks.
    private conjestionControlSendHandler = () : void => {
      if(this.rtcDataChannel_.bufferedAmount + CHUNK_SIZE > PC_QUEUE_LIMIT) {
        if(this.toPeerDataQueue_.isHandling()) {
          this.toPeerDataQueue_.stopHandling();
        }
        setTimeout(this.conjestionControlSendHandler, 20);
      } else {
        if(!this.toPeerDataQueue_.isHandling()) {
          this.toPeerDataQueue_.setHandler(this.handleSendDataToPeer_);
        }
      }
    }

    public close = () : void => {
      this.rtcDataChannel_.close();
    }
  }  // class DataChannel
}  // module
