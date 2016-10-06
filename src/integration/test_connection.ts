import * as tcp from '../../third_party/uproxy-lib/net/tcp';
import * as socks_common from '../../third_party/uproxy-lib/socks-common/socks-headers';
import * as net from '../../third_party/uproxy-lib/net/net.types';

class ProxyTester {
  private echoServer_ :tcp.Server;
  private connections_ :{ [index:string]: tcp.Connection; } = {};
  private localhost_ :string = '127.0.0.1';

  constructor() {
  }

  public startEchoServer = () : Promise<number> => {
    var server = new tcp.Server({
      address: this.localhost_,
      port: 0
    });

    server.connectionsQueue.setSyncHandler((tcpConnection:tcp.Connection) => {
      tcpConnection.dataFromSocketQueue.setSyncHandler((buffer:ArrayBuffer) => {
        tcpConnection.send(buffer);
      });
    });

    // Discard endpoint info; we'll get it again later via .onceListening().
    this.echoServer_ = server;
    return server.listen().then((endpoint:net.Endpoint) => { return endpoint.port; });
  }

  // Assumes webEndpoint is IPv4.
  private connectThroughSocks_ = (socksEndpoint:net.Endpoint, webEndpoint:net.Endpoint) : Promise<tcp.Connection> => {
    var connection = new tcp.Connection({endpoint: socksEndpoint});
    var authRequest = socks_common.composeAuthHandshakeBuffer([socks_common.Auth.NOAUTH]);
    connection.send(authRequest);
    var connected = new Promise<tcp.ConnectionInfo>((F, R) => {
      connection.onceConnected.then(F);
      connection.onceClosed.then(R);
    });
    var firstBufferPromise :Promise<ArrayBuffer> = connection.receiveNext();
    return connected.then((i:tcp.ConnectionInfo) => {
      return firstBufferPromise;
    }).then((buffer:ArrayBuffer) : Promise<ArrayBuffer> => {
      var auth = socks_common.interpretAuthResponse(buffer);
      if (auth != socks_common.Auth.NOAUTH) {
        throw new Error('SOCKS server returned unexpected AUTH response.  ' +
                        'Expected NOAUTH (' + socks_common.Auth.NOAUTH + ') but got ' + auth);
      }

      var request :socks_common.Request = {
        command: socks_common.Command.TCP_CONNECT,
        endpoint: webEndpoint,
      };
      connection.send(socks_common.composeRequestBuffer(request));
      return connection.receiveNext();
    }).then((buffer:ArrayBuffer) : Promise<tcp.Connection> => {
      var response = socks_common.interpretResponseBuffer(buffer);
      if (response.reply != socks_common.Reply.SUCCEEDED) {
        return Promise.reject(response);
      }
      return Promise.resolve(connection);
    });
  }

  public connect = (socksEndpoint: net.Endpoint,
                    port:number,
                    address?:string) : Promise<string> => {
    var echoEndpoint :net.Endpoint = {
      address: address || this.localhost_,
      port: port
    };
    return this.connectThroughSocks_(socksEndpoint, echoEndpoint)
           .then((connection:tcp.Connection) => {
        this.connections_[connection.connectionId] = connection;
        return connection.connectionId;
      }).catch((e) => {
        return Promise.reject(e.message + ' ' + e.stack);
      });
  }

  public echo = (connectionId:string, content:ArrayBuffer) : Promise<ArrayBuffer> => {
    return this.echoMultiple(connectionId, [content])
        .then((responses:ArrayBuffer[]) : ArrayBuffer => {
          return responses[0];
        });
  }

  public echoMultiple = (connectionId:string, contents:ArrayBuffer[]) : Promise<ArrayBuffer[]> => {
    try {
      var connection = this.connections_[connectionId];
      contents.forEach(connection.send);

      var received :ArrayBuffer[] = [];
      return new Promise<ArrayBuffer[]>((F, R) => {
        connection.dataFromSocketQueue.setSyncHandler((echo:ArrayBuffer) => {
          received.push(echo);
          if (received.length == contents.length) {
            F(received);
          }
        });
      });
    } catch (e) {
      return Promise.reject(e.message + ' ' + e.stack);
    }
  }
}

if (typeof freedom !== 'undefined') {
  freedom().providePromises(ProxyTester);
}
