/// <reference path='../../../third_party/freedom-typings/freedom-common.d.ts' />
/// <reference path='../../../third_party/typings/es6-promise/es6-promise.d.ts' />
/// <reference path='../../../third_party/freedom-typings/udp-socket.d.ts' />

// TODO(ldixon): reorganize the utransformers and rename uproxy-obfuscators.
// Ideal:
//  import Transformer = require('uproxy-obfuscators/transformer');
//  import Rabbit = require('uproxy-obfuscators/rabbit.transformer');
//  import Fte = require('uproxy-obfuscators/fte.transformer');
// Current:
/// <reference path='../../../third_party/uTransformers/utransformers.d.ts' />

// import Rabbit = require('utransformers/src/transformers/uTransformers.fte');
// import Fte = require('utransformers/src/transformers/uTransformers.rabbit');

import PassThrough = require('../simple-transformers/passthrough');
import CaesarCipher = require('../simple-transformers/caesar');

import logging = require('../logging/logging');

import net = require('../net/net.types');

var log :logging.Log = new logging.Log('churn-pipe');

// Retry an async function with exponential backoff for up to 2 seconds
// before failing.
var retry_ = <T>(func:() => Promise<T>, delayMs?:number) : Promise<T> => {
  delayMs = delayMs || 10;
  return func().catch((err) => {
    delayMs *= 2;
    if (delayMs > 2000) {
      return Promise.reject(err);
    }
    return new Promise<T>((F, R) => {
      setTimeout(() => {
        this.retry_(func, delayMs).then(F, R);
      }, delayMs);
    });
  });
}

var makeTransformer_ = (
    // Name of transformer to use, e.g. 'rabbit' or 'none'.
    name :string,
    // Key for transformer, if any.
    key ?:ArrayBuffer,
    // JSON-encoded configuration, if any.
    config ?:string)
  : Transformer => {
  var transformer :Transformer;
  // TODO(ldixon): re-enable rabbit and FTE once we can figure out why they
  // don't load in freedom.
  /* if (name == 'rabbit') {
     transformer = Rabbit.Transformer();
     } else if (name == 'fte') {
     transformer = Fte.Transformer();
     } else */ if (name == 'caesar') {
       transformer = new CaesarCipher();
     } else if (name == 'none') {
       transformer = new PassThrough();
     } else {
       throw new Error('unknown transformer: ' + name);
     }
  if (key) {
    transformer.setKey(key);
  }
  if (config) {
    transformer.configure(config);
  }
  return transformer;
}

/**
 * A Churn Pipe is a transparent obfuscator/deobfuscator for transforming the
 * apparent type of browser-generated UDP datagrams.
 */
class Pipe {

  // A socket that is bound to a port on a physical network interface.  This
  // port is intended to be publicly routable (possibly thanks to NAT), and is
  // used only for sending and receiving obfuscated traffic with the remote
  // endpoints.
  private publicSocket_ :freedom_UdpSocket.Socket;

  // Each mirror socket is bound to a port on localhost, and corresponds to a
  // specific remote endpoint.  When the public socket receives an obfuscated
  // packet from that remote endpoint, the mirror socket sends the
  // corresponding deobfuscated message to the browser endpoint.  Similarly,
  // when a mirror socket receives a (unobfuscated) message from the browser
  // endpoint, the public socket sends the corresponding obfuscated packet to
  // that mirror socket's remote endpoint.
  private mirrorSockets_ : { [k: string]: freedom_UdpSocket.Socket } = {};

  // Obfuscates and deobfuscates messages.
  private transformer_ :Transformer = makeTransformer_('none');

  // Endpoint to which all incoming obfuscated messages are forwarded.
  private browserEndpoint_ :net.Endpoint;

  // TODO: define a type for event dispatcher in freedom-typescript-api
  constructor (dispatchEvent_:(name:string, args:Object) => void) {
  }

  // Set the current transformer parameters.  The default is no transformation.
  public setTransformer = (
      transformerName :string,
      key ?:ArrayBuffer,
      config ?:string) : Promise<void> => {
    try {
      this.transformer_ = makeTransformer_(transformerName, key, config);
      return Promise.resolve<void>();
    } catch (e) {
      return Promise.reject(e);
    }
  }

  /**
   * Returns a promise to create a socket, bind to the specified address, and
   * start listening for datagrams, which will be deobfuscated and forwarded to the
   * browser endpoint.
   */
  public bindLocal = (publicEndpoint:net.Endpoint) :Promise<void> => {
    if (this.publicSocket_) {
      return Promise.reject(new Error('Churn Pipe cannot rebind the local endpoint'));
    }

    this.publicSocket_ = freedom['core.udpsocket']();
    // This retry is needed because the browser releases the UDP port
    // asynchronously after we call close() on the RTCPeerConnection, so
    // this call to bind() may initially fail, until the port is released.
    return retry_(() => {
      return this.publicSocket_.bind(publicEndpoint.address, publicEndpoint.port);
    }).then((resultCode:number) => {
      if (resultCode != 0) {
        return Promise.reject(new Error(
          'bindLocal failed with result code ' + resultCode));
      }
      this.publicSocket_.on('onData', this.onIncomingData_);
    });
  }

  public setBrowserEndpoint = (browserEndpoint:net.Endpoint) :Promise<void> => {
    this.browserEndpoint_ = browserEndpoint;
    return Promise.resolve<void>();
  }

  /**
   * Given an endpoint from which obfuscated datagrams may arrive, this method
   * constructs a corresponding mirror socket, and returns its endpoint.
   */
  public bindRemote = (remoteEndpoint:net.Endpoint) : Promise<net.Endpoint> => {
    return this.getMirrorSocket_(remoteEndpoint).then(
        (mirrorSocket:freedom_UdpSocket.Socket) => {
      return mirrorSocket.getInfo();
    }).then(Pipe.endpointFromInfo_);
  }

  private getMirrorSocket_ = (remoteEndpoint:net.Endpoint)
      : Promise<freedom_UdpSocket.Socket> => {
    var key = Pipe.makeEndpointKey_(remoteEndpoint);
    if (key in this.mirrorSockets_) {
      return Promise.resolve(this.mirrorSockets_[key]);
    }

    var mirrorSocket :freedom_UdpSocket.Socket = freedom['core.udpsocket']();
    this.mirrorSockets_[key] = mirrorSocket;
    // Bind to INADDR_ANY owing to restrictions on localhost candidates
    // in Firefox:
    //   https://github.com/uProxy/uproxy/issues/1597
    // TODO: bind to an actual, non-localhost address (see the issue)
    return mirrorSocket.bind('0.0.0.0', 0).then((resultCode:number)
        : freedom_UdpSocket.Socket => {
      if (resultCode != 0) {
        throw new Error('bindRemote failed with result code ' + resultCode);
      }
      mirrorSocket.on('onData', (recvFromInfo:freedom_UdpSocket.RecvFromInfo) => {
        this.sendTo_(recvFromInfo.data, remoteEndpoint);
      });
      return mirrorSocket;
    });
  }

  private static endpointFromInfo_ = (socketInfo:freedom_UdpSocket.SocketInfo) => {
    return {
      // freedom-for-firefox currently reports the bound address as 'localhost',
      // which is unsupported in candidate lines by Firefox:
      //   https://github.com/freedomjs/freedom-for-firefox/issues/62
      address: '127.0.0.1',
      port: socketInfo.localPort
    }
  }

  private static makeEndpointKey_ = (endpoint:net.Endpoint) : string => {
    return endpoint.address + ':' + endpoint.port;
  };

  /**
   * Sends a message over the network to the specified destination.
   * The message is obfuscated before it hits the wire.
   */
  private sendTo_ = (buffer:ArrayBuffer, to:net.Endpoint) : void => {
    var transformedBuffer = this.transformer_.transform(buffer);
    this.publicSocket_.sendTo.reckless(
      transformedBuffer,
      to.address,
      to.port);
  }

  /**
   * Called when a message is received over the network from the remote side.
   * The message is de-obfuscated before being passed to the browser endpoint
   * via a corresponding mirror socket.
   */
  private onIncomingData_ = (recvFromInfo:freedom_UdpSocket.RecvFromInfo) => {
    var transformedBuffer = recvFromInfo.data;
    var buffer = this.transformer_.restore(transformedBuffer);
    var source :net.Endpoint = {
      address: recvFromInfo.address,
      port: recvFromInfo.port
    };
    this.getMirrorSocket_(source).then((mirrorSocket:freedom_UdpSocket.Socket) => {
      mirrorSocket.sendTo.reckless(
          buffer,
          this.browserEndpoint_.address,
          this.browserEndpoint_.port);
    });
  }
}

export = Pipe;
