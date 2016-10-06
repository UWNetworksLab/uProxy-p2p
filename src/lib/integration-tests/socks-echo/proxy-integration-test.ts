/// <reference path='../../../../third_party/typings/index.d.ts' />

import * as arraybuffers from '../../arraybuffers/arraybuffers';
import * as bridge from '../../bridge/bridge';
import * as logging from '../../logging/logging';
import * as net from '../../net/net.types';
import * as peerconnection from '../../webrtc/peerconnection';
import * as proxyintegrationtesttypes from './proxy-integration-test.types';
import * as rtc_to_net from '../../rtc-to-net/rtc-to-net';
import * as socks_headers from '../../socks/headers';
import * as socks_to_rtc from '../../socks-to-rtc/socks-to-rtc';
import * as tcp from '../../net/tcp';

import ProxyConfig from '../../rtc-to-net/proxyconfig';
import ProxyIntegrationTester = proxyintegrationtesttypes.ProxyIntegrationTester;
import ReceivedDataEvent = proxyintegrationtesttypes.ReceivedDataEvent;

var log :logging.Log = new logging.Log('SocksClient');

// This abstract class is converted into a real class by Freedom, which
// fills in the unimplemented on(...) method in the process of
// constructing a module.
export default class AbstractProxyIntegrationTest implements ProxyIntegrationTester {
  private socksToRtc_ :socks_to_rtc.SocksToRtc;
  private rtcToNet_ :rtc_to_net.RtcToNet;
  private socksEndpoint_ : Promise<net.Endpoint>;
  private reproxySocksToRtc_ :socks_to_rtc.SocksToRtc;
  private reproxyRtcToNet_ :rtc_to_net.RtcToNet;
  private reproxyEndpoint_ : Promise<net.Endpoint>;
  private reproxyBytesReceived_ :number = 0;
  private reproxyBytesSent_ :number = 0;
  private echoServers_ :tcp.Server[] = [];
  private connections_ :{ [index:string]: tcp.Connection; } = {};
  private localhost_ :string = '127.0.0.1';
  private repeat_ :number = 1;

  constructor(private dispatchEvent_:(name:string, args:any) => void,
              denyLocalhost?:boolean,
              obfuscate?:boolean,
              sessionLimit?:number,
              ipv6Only?:boolean,
              reproxy?:boolean) {
    if (reproxy) {
      this.reproxyEndpoint_ = this.startReproxySocksPair_();
      this.socksEndpoint_ = this.startSocksPairWithReproxy_(denyLocalhost,
          obfuscate, sessionLimit, ipv6Only);
    } else {
      this.socksEndpoint_ = this.startSocksPair_(denyLocalhost, obfuscate,
          sessionLimit, ipv6Only);
    }
  }

  public startEchoServer = () : Promise<number> => {
    var server = new tcp.Server({
      address: this.localhost_,
      port: 0
    });

    server.connectionsQueue.setSyncHandler((tcpConnection:tcp.Connection) => {
      tcpConnection.dataFromSocketQueue.setSyncHandler((buffer:ArrayBuffer) => {
        var multiBuffer :ArrayBuffer[] = []
        for (var i = 0; i < this.repeat_; ++i) {
          multiBuffer.push(buffer);
        }
        var concatenated = arraybuffers.concat(multiBuffer);
        tcpConnection.send(concatenated);
      });
    });

    // Discard endpoint info; we'll get it again later via .onceListening().
    this.echoServers_.push(server);
    return server.listen().then((endpoint:net.Endpoint) => { return endpoint.port; });
  }

  public setRepeat = (repeat:number) : Promise<void> => {
    this.repeat_ = repeat;
    return Promise.resolve();
  };

  private static stripIPv4_ = (obj:any) : void => {
    for (var key in obj) {
      var value = obj[key];
      if (typeof value === 'string') {
        // 192.0.2.1 is a reserved address that is always unassigned.
        obj[key] = value.replace(/\d+\.\d+\.\d+\.\d+/g, '192.0.2.1');
      } else if (typeof value === 'object') {
        AbstractProxyIntegrationTest.stripIPv4_(value);
      }
    }
  }

  // Start a socksToRtc and rtcToNet pair to be used as a reproxy
  private startReproxySocksPair_ = (denyLocalhost?:boolean, obfuscate?:boolean,
      sessionLimit?:number, ipv6Only?:boolean) : Promise<net.Endpoint> => {
    var socksToRtcEndpoint :net.Endpoint = {
      address: this.localhost_,
      port: 0
    };
    var rtcPcConfig :freedom.RTCPeerConnection.RTCConfiguration = {
      iceServers: [],
    };
    var rtcToNetProxyConfig :ProxyConfig = {
      allowNonUnicast: !denyLocalhost  // Allow RtcToNet to contact the localhost server.
    };

    if (typeof sessionLimit === 'number') {
      rtc_to_net.RtcToNet.SESSION_LIMIT = sessionLimit;
    }

    var bridger = obfuscate ? bridge.best : bridge.preObfuscation;

    this.reproxySocksToRtc_ = new socks_to_rtc.SocksToRtc();
    this.reproxyRtcToNet_ = new rtc_to_net.RtcToNet('the user id');
    this.reproxyRtcToNet_.start(rtcToNetProxyConfig,
        bridger('rtctonet', rtcPcConfig));
    this.reproxyRtcToNet_.signalsForPeer.setSyncHandler((msg:Object) => {
      if (ipv6Only) {
        AbstractProxyIntegrationTest.stripIPv4_(msg);
      }
      this.reproxySocksToRtc_.handleSignalFromPeer(msg);
    });
    const start = this.reproxySocksToRtc_.start(new tcp.Server(socksToRtcEndpoint),
        bridger('sockstortc', rtcPcConfig));
    this.reproxySocksToRtc_.signalsForPeer.setSyncHandler((msg:Object) => {
      if (ipv6Only) {
        AbstractProxyIntegrationTest.stripIPv4_(msg);
      }
      this.reproxyRtcToNet_.handleSignalFromPeer(msg);
    });
    // Create handlers for tracking number of bytes sent on reproxy
    this.reproxyRtcToNet_.bytesReceivedFromPeer.setSyncHandler((bytes:number) => {
      this.reproxyBytesReceived_ += bytes;
    });
    this.reproxyRtcToNet_.bytesSentToPeer.setSyncHandler((bytes:number) => {
      this.reproxyBytesSent_ += bytes;
    });
    return start;
  }

  public getReproxyBytesReceived = () :Promise<number> => {
    return Promise.resolve(this.reproxyBytesReceived_);
  }
  public getReproxyBytesSent = () :Promise<number> => {
    return Promise.resolve(this.reproxyBytesSent_);
  }

  // Start a socksToRtc and rtcToNet pair
  private startSocksPair_ = (denyLocalhost?:boolean, obfuscate?:boolean,
      sessionLimit?:number, ipv6Only?:boolean, reproxyEndpoint?:net.Endpoint)
      : Promise<net.Endpoint> => {
    var socksToRtcEndpoint :net.Endpoint = {
      address: this.localhost_,
      port: 0
    };
    var rtcPcConfig :freedom.RTCPeerConnection.RTCConfiguration = {
      iceServers: [],
    };
    var rtcToNetProxyConfig :ProxyConfig = {
      allowNonUnicast: !denyLocalhost  // Allow RtcToNet to contact the localhost server.
    };
    if (reproxyEndpoint) {  // Add reproxy settings to proxy config
      rtcToNetProxyConfig.reproxy = {
        enabled: true,
        socksEndpoint: reproxyEndpoint
      };
    }

    if (typeof sessionLimit === 'number') {
      rtc_to_net.RtcToNet.SESSION_LIMIT = sessionLimit;
    }

    var bridger = obfuscate ? bridge.best : bridge.preObfuscation;

    this.socksToRtc_ = new socks_to_rtc.SocksToRtc();
    this.rtcToNet_ = new rtc_to_net.RtcToNet('the user id');
    this.rtcToNet_.start(rtcToNetProxyConfig,
        bridger('rtctonet', rtcPcConfig));
    this.rtcToNet_.signalsForPeer.setSyncHandler((msg:Object) => {
      if (ipv6Only) {
        AbstractProxyIntegrationTest.stripIPv4_(msg);
      }
      this.socksToRtc_.handleSignalFromPeer(msg);
    });
    const start = this.socksToRtc_.start(new tcp.Server(socksToRtcEndpoint),
        bridger('sockstortc', rtcPcConfig));
    this.socksToRtc_.signalsForPeer.setSyncHandler((msg:Object) => {
      if (ipv6Only) {
        AbstractProxyIntegrationTest.stripIPv4_(msg);
      }
      this.rtcToNet_.handleSignalFromPeer(msg);
    });
    return start;
  }

  // Start a socksToRtc and rtcToNet pair that reproxies through reproxyEndpoint
  private startSocksPairWithReproxy_ = (denyLocalhost?:boolean,
      obfuscate?:boolean, sessionLimit?:number, ipv6Only?:boolean)
      : Promise<net.Endpoint> => {
    return this.reproxyEndpoint_
      .then((reproxyEndpoint :net.Endpoint) : Promise<net.Endpoint> => {
        return this.startSocksPair_(denyLocalhost, obfuscate, sessionLimit,
                                    ipv6Only, reproxyEndpoint);
      });
  }

  private connectThroughSocks_ = (socksEndpoint:net.Endpoint, webEndpoint:net.Endpoint) : Promise<tcp.Connection> => {
    var connection = new tcp.Connection({endpoint: socksEndpoint});
    connection.onceClosed.then(() => {
      console.log('Socket ' + connection.connectionId + ' has closed');
      this.dispatchEvent_('sockClosed', connection.connectionId);
    });

    var authRequest = socks_headers.composeAuthHandshakeBuffer([socks_headers.Auth.NOAUTH]);
    log.debug('Creating auth handshake: %1', [authRequest]);
    connection.send(authRequest);
    var connected = new Promise<tcp.ConnectionInfo>((F, R) => {
      connection.onceConnected.then(F);
      connection.onceClosed.then(R);
    });
    var firstBufferPromise :Promise<ArrayBuffer> = connection.receiveNext();
    return connected.then((i:tcp.ConnectionInfo) => {
      return firstBufferPromise;
    }).then((buffer:ArrayBuffer) : Promise<ArrayBuffer> => {
      var auth = socks_headers.interpretAuthResponse(buffer);
      log.debug('Received auth handshake reply: %1', [auth]);
      if (auth != socks_headers.Auth.NOAUTH) {
        throw new Error('SOCKS server returned unexpected AUTH response.  ' +
                        'Expected NOAUTH (' + socks_headers.Auth.NOAUTH + ') but got ' + auth);
      }
      log.debug('Connecting through socks to: %1', [webEndpoint]);

      var request :socks_headers.Request = {
        command: socks_headers.Command.TCP_CONNECT,
        endpoint: webEndpoint,
      };
      log.debug('Making socks request: %1', [request]);
      connection.send(socks_headers.composeRequestBuffer(request));
      return connection.receiveNext();
    }).then((buffer:ArrayBuffer) : Promise<tcp.Connection> => {
      var response = socks_headers.interpretResponseBuffer(buffer);
      log.debug('Received request response: %1', [response]);
      if (response.reply != socks_headers.Reply.SUCCEEDED) {
        // TODO: Fix bad style: reject should only and always be an error.
        // We should be resolving with result status.
        return Promise.reject(response);
      }
      return Promise.resolve(connection);
    });
  }

  public connect = (port:number, address?:string) : Promise<string> => {
    try {
      return this.socksEndpoint_.then((socksEndpoint:net.Endpoint) : Promise<tcp.Connection> => {
        var echoEndpoint :net.Endpoint = {
          address: address || this.localhost_,
          port: port
        };
        return this.connectThroughSocks_(socksEndpoint, echoEndpoint);
      }).then((connection:tcp.Connection) => {
        this.connections_[connection.connectionId] = connection;
        return connection.connectionId;
      }, (e:any) : any => {
        // We only want to preserve the reject value if it is a Socks.Response.
        return Promise.reject({
          reply: e.reply,
          endpoint: e.endpoint,
        });
      });
    } catch (e) {
      return Promise.reject(e);
    }
  }

  public closeEchoConnections = () : Promise<void> => {
    var allPromises :Promise<void>[] = [];
    for (var i in this.echoServers_) {
      var s = this.echoServers_[i];
      allPromises.push(s.closeAll());
    }
    return Promise.all(allPromises).then(() => {
      console.log('closeEchoConnections complete.');
    });
  }

  public echo = (connectionId:string, content:ArrayBuffer) : Promise<ArrayBuffer> => {
    return this.echoMultiple(connectionId, [content])
        .then((responses:ArrayBuffer[]) : ArrayBuffer => {
          return arraybuffers.concat(responses);
        });
  }

  public echoMultiple = (connectionId:string, contents:ArrayBuffer[]) : Promise<ArrayBuffer[]> => {
    try {
      var connection = this.connections_[connectionId];
      contents.forEach(connection.send);

      var received :ArrayBuffer[] = [];
      var bytesReceived :number = 0;
      var bytesToSend :number = 0;
      contents.forEach((content:ArrayBuffer) => {
        bytesToSend += content.byteLength;
      });
      return new Promise<ArrayBuffer[]>((F, R) => {
        connection.dataFromSocketQueue.setSyncHandler((echo:ArrayBuffer) => {
          received.push(echo);
          bytesReceived += echo.byteLength;
          if (bytesReceived == bytesToSend) {
            F(received);
          }
        });
      });
    } catch (e) {
      return Promise.reject(e);
    }
  }

  public sendData = (connectionId:string, content:ArrayBuffer) : Promise<void> => {
    try {
      var connection = this.connections_[connectionId];
      connection.send(content);
      connection.dataFromSocketQueue.setSyncHandler((response:ArrayBuffer) => {
        this.dispatchEvent_('receivedData', {
          connectionId: connectionId,
          response: response
        });
      });
      return Promise.resolve();
    } catch (e) {
      return Promise.reject(e);
    }
  }


  public shutdown = () : Promise<void> => {
    var closeSocksToRtc = this.socksToRtc_.stop();
    var closeRtcToNet = this.rtcToNet_.stop();
    var closeReproxySocksToRtc :Promise<void>;
    var closeReproxyRtcToNet :Promise<void>;
    if (this.reproxyEndpoint_) {
      closeReproxySocksToRtc = this.reproxySocksToRtc_.stop();
      closeReproxyRtcToNet = this.reproxyRtcToNet_.stop();
    }
    var stopEchoServers = this.echoServers_.map((server) => {
      return server.shutdown();
    });
    var closeConnections :Promise<void>[] = [];
    for (var index in this.connections_) {
      closeConnections.push(this.connections_[index].close().then(
          (kind:tcp.SocketCloseKind) : void => {}));
    }

    var shutdownPromises = closeConnections.concat(stopEchoServers,
        [closeRtcToNet, closeSocksToRtc]);
    if (this.reproxyEndpoint_) {
      shutdownPromises = shutdownPromises.concat(closeReproxySocksToRtc,
                                                 closeReproxyRtcToNet);
    }
    return Promise.all(shutdownPromises).then((voids:void[]) => {});
  }

  public on = (name:string, listener:(event:any) => void) : void => {
    throw new Error('Placeholder function to keep Typescript happy');
  }
}
