import * as aqm from '../aqm/aqm';
import * as caesar from '../transformers/caesar';
import * as churn_types from '../churn/churn.types';
import * as decompression from '../transformers/decompressionShaper';
import * as fragmentation from '../transformers/fragmentationShaper';
import * as ipaddr from 'ipaddr.js';
import * as logging from '../logging/logging';
import * as net from '../net/net.types';
import PassThrough from '../transformers/passthrough';
import * as promises from '../promises/promises';
import * as protean from '../transformers/protean';
import * as rc4 from '../transformers/rc4';
import * as sequence from '../transformers/byteSequenceShaper';
import * as transformer from '../transformers/transformer';

import Socket = freedom.UdpSocket.Socket;

declare const freedom: freedom.FreedomInModuleEnv;

var log :logging.Log = new logging.Log('churn-pipe');

// Maps transformer names to class constructors.
var transformers :{[name:string] : new() => transformer.Transformer} = {
  'caesar': caesar.CaesarCipher,
  'decompressionShaper': decompression.DecompressionShaper,
  'fragmentationShaper': fragmentation.FragmentationShaper,
  'none': PassThrough,
  'protean': protean.Protean,
  'rc4': rc4.Rc4Transformer,
  'sequenceShaper': sequence.ByteSequenceShaper
};

// Local socket rebinding retry timing (see bindLocal)
const INITIAL_REBIND_INTERVAL_MS = 10;
const MAX_REBIND_INTERVAL_MS = 2000;

interface MirrorSet {
  // If true, these mirrors represent a remote endpoint that has been
  // explicitly signaled to us.
  signaled:boolean;

  // This array may be transiently sparse for signaled mirrors, and
  // persistently sparse for non-signaled mirrors (i.e. peer-reflexive).
  // Taking its length is therefore likely to be unhelpful.
  sockets:Promise<Socket>[];
}

/**
 * A Churn Pipe is a transparent obfuscator/deobfuscator for transforming the
 * apparent type of browser-generated UDP datagrams.
 *
 * This implementation makes the simplifying assumption that the browser only
 * allocates one endpoint per interface.  Relaxing this assumption would allow
 * us to achieve the same performance while allocating fewer ports, at the cost
 * of slightly more complex logic.
 */
export default class Pipe {
  // Number of instances created, for logging purposes.
  private static id_ = 0;

  // For each physical network interface, this provides a list of the open
  // public sockets on that interface.  Each socket corresponds to a port that
  // is intended to be publicly routable (possibly thanks to NAT), and is
  // used only for sending and receiving obfuscated traffic with the remote
  // endpoints.
  private publicSockets_ :{ [address:string]:Socket[] } = {};

  // Promises to track the progress of binding any public port.  This is used
  // to return the appropriate Promise when there is a redundant call to
  // |bindLocal|.
  private publicPorts_ :{ [address:string]:{ [port:number]:Promise<void> } } =
      {};

  // The maximum number of bound remote ports on any single interface.  This is
  // also the number of mirror sockets that are needed for each signaled remote
  // port.
  private maxSocketsPerInterface_ :number = 0;

  // Each mirror socket is bound to a port on localhost, and corresponds to a
  // specific remote endpoint.  When the public socket receives an obfuscated
  // packet from that remote endpoint, the mirror socket sends the
  // corresponding deobfuscated message to the browser endpoint.  Similarly,
  // when a mirror socket receives a (unobfuscated) message from the browser
  // endpoint, the public socket sends the corresponding obfuscated packet to
  // that mirror socket's remote endpoint.
  private mirrorSockets_ :{ [address:string]:{ [port:number]:MirrorSet } } =
      {};

  // Obfuscates and deobfuscates messages.
  private transformer_ :transformer.Transformer;

  // Endpoint to which incoming obfuscated messages are forwarded on each
  // interface.  The key is the interface, and the value is the port.
  // This requires the simplifying assumption that the browser allocates at
  // most one port on each interface.
  private browserEndpoints_ :{ [address:string]:number } = {};

  // The set of ports used by the browser. All values are true.
  // This is only needed because Pipe's mirror sockets are bound to the ANY
  // interface (0.0.0.0).  If the browser also binds to ANY, packets between
  // these interfaces may appear to originate from any local interface, so we
  // can't require that source addresses and ports match.
  // This object allows O(1) lookup of whether ports are available.
  private browserPorts_: {[port:number]:boolean } = {};

  // The most recently set public interface for IPv6 and IPv4.  Used to
  // report mirror endpoints.
  private lastInterface_ : {v6?:string; v4?:string;} = {};

  // There is an implicit queue between this class, running in a module, and
  // the actual send call, which runs in the core environment.  Under high
  // CPU load, that IPC queue can grow very large.  This Active Queue Manager
  // drops packets when the queue gets too large, so that the browser slows
  // down its sending, which reduces CPU load.
  private queueManager_ :aqm.AQM<[Socket, ArrayBuffer, net.Endpoint]>;

  // TODO: define a type for event dispatcher in freedom-typescript-api
  constructor(
      private dispatchEvent_:(name:string, args:Object) => void,
      private name_:string = 'unnamed-pipe-' + Pipe.id_) {
    Pipe.id_++;

    // The delay target is 10 milliseconds maximum roundtrip delay to the core.
    // This is twice 5 milliseconds, which is CoDel's recommended
    // one-way delay.
    // TODO: Tune the tracing fraction (1 / 5).  Higher should be more stable,
    // but lower should be more efficient.
    this.queueManager_ = new aqm.CoDelIsh<[Socket, ArrayBuffer, net.Endpoint]>(
        this.tracedSend_,
        this.fastSend_,
        1 / 5,
        10);
  }

  // Set transformer parameters.
  public setTransformer = (
      transformerConfig:churn_types.TransformerConfig) : Promise<void> => {
    try {
      if (!(transformerConfig.name in transformers)) {
        throw new Error('unknown transformer: ' + transformerConfig.name);
      }

      log.info('%1: using %2 obfuscator', this.name_, transformerConfig.name);
      this.transformer_ = new transformers[transformerConfig.name]();
      if (transformerConfig.config !== undefined) {
        this.transformer_.configure(transformerConfig.config);
      } else {
        log.warn('%1: no transformer config specified', this.name_);
      }

      return Promise.resolve();
    } catch (e) {
      return Promise.reject(e);
    }
  }

  /**
   * Returns a promise to create a socket, bind to the specified address, and
   * start listening for datagrams, which will be deobfuscated and forwarded to the
   * browser endpoint.
   */
  // TODO: Clarify naming between bindLocal (binds local public obfuscated
  // candidate) and bindRemote (set up private local bindings to allow
  // sending to that remote candidate).
  public bindLocal = (publicEndpoint:net.Endpoint) :Promise<void> => {
    if (ipaddr.IPv6.isValid(publicEndpoint.address)) {
      this.lastInterface_.v6 = publicEndpoint.address;
    } else if (ipaddr.IPv4.isValid(publicEndpoint.address)) {
      this.lastInterface_.v4 = publicEndpoint.address;
    } else {
      return Promise.reject(
          new Error('Invalid address: ' + publicEndpoint.address));
    }

    if (!this.publicPorts_[publicEndpoint.address]) {
      this.publicPorts_[publicEndpoint.address] = {};
    }
    var portPromise =
        this.publicPorts_[publicEndpoint.address][publicEndpoint.port];
    if (portPromise) {
      log.debug('%1: redundant public endpoint: %2', this.name_, publicEndpoint);
      return portPromise;
    }

    var socket :freedom.UdpSocket.Socket = freedom['core.udpsocket']();
    var index = this.addPublicSocket_(socket, publicEndpoint);
    // Firefox only supports binding to ANY and localhost, so bind to ANY.
    // TODO: Figure out how to behave correctly when we are instructed
    // to bind the same port on two different interfaces.  Currently, this
    // code will bind the port twice, probably duplicating all incoming
    // packets (but this is not verified).
    var anyInterface = Pipe.anyInterface_(publicEndpoint.address);
    // This retry is needed because the browser releases the UDP port
    // asynchronously after we call close() on the RTCPeerConnection, so
    // this call to bind() may initially fail, until the port is released.
    portPromise = promises.retryWithExponentialBackoff(() => {
      log.debug('%1: trying to bind public endpoint: %2',
          this.name_, publicEndpoint);
      // TODO: Once https://github.com/freedomjs/freedom/issues/283 is
      // fixed, catch here, and only retry on an ALREADY_BOUND error.
      return socket.bind(anyInterface, publicEndpoint.port);
    }, MAX_REBIND_INTERVAL_MS, INITIAL_REBIND_INTERVAL_MS).then(() => {
      log.debug('%1: successfully bound public endpoint: %2',
          this.name_, publicEndpoint);
      socket.on('onData', (recvFromInfo:freedom.UdpSocket.RecvFromInfo) => {
        this.onIncomingData_(recvFromInfo, publicEndpoint.address, index);
      });
    });

    this.publicPorts_[publicEndpoint.address][publicEndpoint.port] = portPromise;
    return portPromise;
  }

  // Given a socket, and the endpoint to which it is bound, this function adds
  // the endpoint to the set of sockets for that interface, performs any
  // updates necessary to make the new socket functional, and returns an index
  // that identifies the socket within its interface.
  private addPublicSocket_ = (socket:Socket, endpoint:net.Endpoint)
      :number => {
    if (!(endpoint.address in this.publicSockets_)) {
      this.publicSockets_[endpoint.address] = [];
    }
    this.publicSockets_[endpoint.address].push(socket);
    if (this.publicSockets_[endpoint.address].length >
        this.maxSocketsPerInterface_) {
      this.increaseReplication_();
    }
    return this.publicSockets_[endpoint.address].length - 1;
  }

  // Some interface has broken the record for the number of bound local sockets.
  // Add another mirror socket for every signaled remote candidate, to represent
  // the routes through this newly bound local socket.
  private increaseReplication_ = () => {
    log.debug('%1: increasing replication (currently %2)',
        this.name_, this.maxSocketsPerInterface_);
    for (var remoteAddress in this.mirrorSockets_) {
      for (var port in this.mirrorSockets_[remoteAddress]) {
        var mirrorSet = this.mirrorSockets_[remoteAddress][port];
        if (mirrorSet.signaled) {
          var endpoint :net.Endpoint = {
            address: remoteAddress,
            port: parseInt(port, 10)
          };
          this.getMirrorSocketAndEmit_(endpoint, this.maxSocketsPerInterface_);
        }
      }
    }
    ++this.maxSocketsPerInterface_;
  }

  // A new mirror port has been allocated for a signaled remote endpoint. Report
  // it to the client.
  private emitMirror_ = (remoteEndpoint:net.Endpoint, socket:Socket) => {
    socket.getInfo().then(this.endpointFromInfo_).then((localEndpoint) => {
      log.debug('%1: emitting mirror for %2: %3', this.name_, remoteEndpoint, localEndpoint);
      this.dispatchEvent_('mappingAdded', {
        local: localEndpoint,
        remote: remoteEndpoint
      });
    });
  }

  // Informs this module about the existence of a browser endpoint.
  public addBrowserEndpoint = (browserEndpoint:net.Endpoint) :Promise<void> => {
    log.debug('%1: adding browser endpoint: %2', this.name_, browserEndpoint);
    if (this.browserEndpoints_[browserEndpoint.address]) {
      log.warn('%1: port %2 is already open on this interface',
          this.name_, this.browserEndpoints_[browserEndpoint.address])
    }
    this.browserEndpoints_[browserEndpoint.address] = browserEndpoint.port;
    this.browserPorts_[browserEndpoint.port] = true;
    return Promise.resolve();
  }

  // Establishes an empty data structure to hold mirror sockets for this remote
  // endpoint, if necessary.  If |signaled| is true, the structure will be
  // marked as signaled, whether or not it already existed.
  private ensureRemoteEndpoint_ = (endpoint:net.Endpoint, signaled:boolean)
      :MirrorSet => {
    if (!(endpoint.address in this.mirrorSockets_)) {
      this.mirrorSockets_[endpoint.address] = {};
    }
    if (!(endpoint.port in this.mirrorSockets_[endpoint.address])) {
      this.mirrorSockets_[endpoint.address][endpoint.port] = {
        signaled: false,
        sockets: []
      };
    }
    if (signaled) {
      this.mirrorSockets_[endpoint.address][endpoint.port].signaled = true;
    }
    return this.mirrorSockets_[endpoint.address][endpoint.port];
  }

  /**
   * Given an endpoint from which obfuscated datagrams may arrive, this method
   * constructs a corresponding mirror socket, and returns its endpoint.
   */
  public bindRemote = (remoteEndpoint:net.Endpoint) :Promise<void> => {
    try {
      var dummyAddress = this.getLocalInterface_(remoteEndpoint.address);
    } catch (e) {
      return Promise.reject('You must call bindLocal before bindRemote');
    }
    log.debug('%1: binding %2 mirror(s) for remote endpoint: %3',
        this.name_, this.maxSocketsPerInterface_, remoteEndpoint);
    this.ensureRemoteEndpoint_(remoteEndpoint, true);
    var promises :Promise<void>[] = [];
    for (var i = 0; i < this.maxSocketsPerInterface_; ++i) {
      promises.push(this.getMirrorSocketAndEmit_(remoteEndpoint, i));
    }
    return Promise.all(promises).then((fulfills:void[]) :void => {});
  }

  // Returns the "any" interface with the same address family (IPv4 or IPv6) as
  // |address|.
  private static anyInterface_ = (address:string) => {
    return ipaddr.IPv6.isValid(address) ? '::' : '0.0.0.0';
  }

  private getMirrorSocket_ = (remoteEndpoint:net.Endpoint, index:number)
      :Promise<Socket> => {
    var mirrorSet = this.ensureRemoteEndpoint_(remoteEndpoint, false);
    var socketPromise :Promise<Socket> = mirrorSet.sockets[index];
    if (socketPromise) {
      return socketPromise;
    }

    var mirrorSocket :freedom.UdpSocket.Socket = freedom['core.udpsocket']();
     mirrorSocket;
    // Bind to INADDR_ANY owing to restrictions on localhost candidates
    // in Firefox:
    //   https://github.com/uProxy/uproxy/issues/1597
    // TODO: bind to an actual, non-localhost address (see the issue)
    var anyInterface = Pipe.anyInterface_(remoteEndpoint.address);
    socketPromise = mirrorSocket.bind(anyInterface, 0).then(() :Socket => {
      mirrorSocket.on('onData', (recvFromInfo:freedom.UdpSocket.RecvFromInfo) => {
        // Ignore packets that do not originate from the browser, for a
        // theoretical security benefit.
        if (!(recvFromInfo.address in this.browserEndpoints_)) {
          log.warn('%1: mirror socket for %2 ignoring incoming packet from %3: ' +
              'unknown source address',
              this.name_,
              remoteEndpoint, {
                address: recvFromInfo.address,
                port: recvFromInfo.port
              });
        } else if (!(recvFromInfo.port in this.browserPorts_)) {
          log.warn('%1: mirror socket for %2 ignoring incoming packet from %3: ' +
              'unknown source port',
              this.name_,
              remoteEndpoint, {
                address: recvFromInfo.address,
                port: recvFromInfo.port
              });
        } else {
          var publicSocket = this.publicSockets_[recvFromInfo.address] &&
              this.publicSockets_[recvFromInfo.address][index];
          // Public socket may be null, especially if the index is too great.
          // Drop the packet in that case.
          if (publicSocket) {
            this.sendTo_(publicSocket, recvFromInfo.data, remoteEndpoint);
          } else {
            log.warn('%1: Dropping packet due to null public socket', this.name_);
          }
        }
      });
      return mirrorSocket;
    });
    mirrorSet.sockets[index] = socketPromise;
    return socketPromise;
  }

  private getMirrorSocketAndEmit_ = (remoteEndpoint:net.Endpoint, index:number)
      :Promise<void> => {
    return this.getMirrorSocket_(remoteEndpoint, index).then((socket) => {
      this.emitMirror_(remoteEndpoint, socket)
    }, (e) => {
      log.error('%1: error while getting mirror socket: %2', this.name_, e);
    });
  }

  private getLocalInterface_ = (anyAddress:string) : string => {
    // This method will not work until bindLocal populates |lastInterface_|.
    var isIPv6 = ipaddr.IPv6.isValid(anyAddress);
    var address = isIPv6 ? this.lastInterface_.v6 : this.lastInterface_.v4;
    if (!address) {
      // This error would only occur if this method were called (from
      // bindRemote) before bindLocal was called.
      throw new Error('No known interface to match ' + anyAddress);
    }
    return address;
  }

  private endpointFromInfo_ = (socketInfo:freedom.UdpSocket.SocketInfo) => {
    if (!socketInfo.localAddress) {
      throw new Error('Cannot process incomplete info: ' +
          JSON.stringify(socketInfo));
    }
    // freedom-for-firefox currently reports the bound address as 'localhost',
    // which is unsupported in candidate lines by Firefox:
    //   https://github.com/freedomjs/freedom-for-firefox/issues/62
    // This will result in |localAddress| being IPv4, so this
    // issue is blocking IPv6 Churn support on Firefox.
    var localAddress = this.getLocalInterface_(socketInfo.localAddress);
    return {
      address: localAddress,
      port: socketInfo.localPort
    };
  }

  /**
   * Sends a message over the network to the specified destination.
   * The message is obfuscated before it hits the wire.
   */
  private sendTo_ = (publicSocket:Socket, buffer:ArrayBuffer, to:net.Endpoint)
      :void => {
    try {
      let transformedBuffers = this.transformer_.transform(buffer);
      for (var i = 0; i < transformedBuffers.length; i++) {
        // 0 is the identifier for the outbound flow
        this.queueManager_.send(0, [publicSocket, transformedBuffers[i], to]);
      }
    } catch (e) {
      log.warn('%1: transform error: %2', this.name_, e.message);
    }
  }

  /**
   * Sends a message to the specified destination.
   */
  private fastSend_ = (args:[Socket, ArrayBuffer, net.Endpoint]) : void => {
    var [socket, buffer, to] = args;
    socket.sendTo.reckless(
        buffer,
        to.address,
        to.port);
  }

  /**
   * Sends a message to the specified destination.
   * This version also requests an Ack from the core, and returns a Promise
   * that resolves when the core has sent the message.
   */
  private tracedSend_ = (args:[Socket, ArrayBuffer, net.Endpoint])
      : Promise<void> => {
    var [socket, buffer, to] = args;

    return socket.sendTo(
        buffer,
        to.address,
        to.port).then((bytesWritten:number) => {
      if (bytesWritten !== buffer.byteLength) {
        throw new Error('Incomplete UDP send should be impossible');
      }
    });
  }

  /**
   * Called when a message is received over the network from the remote side.
   * The message is de-obfuscated before being passed to the browser endpoint
   * via a corresponding mirror socket.
   */
  private onIncomingData_ = (recvFromInfo:freedom.UdpSocket.RecvFromInfo,
      iface:string, index:number) => {
    var browserPort = this.browserEndpoints_[iface];
    if (!browserPort) {
      // There's no browser port for this interface, so drop the packet.
      return;
    }
    var transformedBuffer = recvFromInfo.data;
    try {
      let buffers = this.transformer_.restore(transformedBuffer);
      this.getMirrorSocket_(recvFromInfo, index).then((mirrorSocket:Socket) => {
        var browserEndpoint:net.Endpoint = {
          address: iface,
          port: browserPort
        };
        for (var i = 0; i < buffers.length; i++) {
          // 1 is the identifier for the inbound flow
          this.queueManager_.send(1, [mirrorSocket, buffers[i], browserEndpoint]);
        }
      });
    } catch (e) {
      log.warn('%1: restore error: %2', this.name_, e.message);
    }
  }

  public on = (name:string, listener:(event:any) => void) :void => {
    throw new Error('Placeholder function to keep Typescript happy');
  }

  private static closeSocket_(socket:Socket) : Promise<void> {
    return socket.destroy().catch((e) => {
      log.warn('Error while closing socket: %1', e);
    }).then(() => {
      freedom['core.udpsocket'].close(socket);
    });
  }

  public shutdown = () : Promise<void> => {
    var shutdownPromises : Promise<void>[] = [];
    var address:string;
    var port:any;  // Typescript doesn't allow number in for...in loops.
    for (address in this.publicSockets_) {
      this.publicSockets_[address].forEach((publicSocket) => {
        shutdownPromises.push(Pipe.closeSocket_(publicSocket));
      });
    }

    for (address in this.mirrorSockets_) {
      for (port in this.mirrorSockets_[address]) {
        var mirrorPromises = this.mirrorSockets_[address][port].sockets;
        mirrorPromises.forEach((mirrorPromise) => {
          shutdownPromises.push(mirrorPromise.then(Pipe.closeSocket_));
        });
      }
    }
    return Promise.all(shutdownPromises).then((voids:void[]) => {});
  }
}

