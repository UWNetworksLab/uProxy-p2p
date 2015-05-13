/// <reference path="../networking-typings/communications.d.ts" />
/// <reference path="../socks-common/socks-headers.d.ts" />
/// <reference path="../tcp/tcp.d.ts" />

class ProxyTester {
  private echoServer_ :Tcp.Server;
  private connections_ :{ [index:string]: Tcp.Connection; } = {};
  private localhost_ :string = '127.0.0.1';

  constructor() {
  }

  public startEchoServer = () : Promise<number> => {
    var server = new Tcp.Server({
      address: this.localhost_,
      port: 0
    });

    server.connectionsQueue.setSyncHandler((tcpConnection:Tcp.Connection) => {
      tcpConnection.dataFromSocketQueue.setSyncHandler((buffer:ArrayBuffer) => {
        tcpConnection.send(buffer);
      });
    });

    // Discard endpoint info; we'll get it again later via .onceListening().
    this.echoServer_ = server;
    return server.listen().then((endpoint:net.Endpoint) => { return endpoint.port; });
  }

  // Assumes webEndpoint is IPv4.
  private connectThroughSocks_ = (socksEndpoint:net.Endpoint, webEndpoint:net.Endpoint) : Promise<Tcp.Connection> => {
    var connection = new Tcp.Connection({endpoint: socksEndpoint});
    var authRequest = Socks.composeAuthHandshakeBuffer([Socks.Auth.NOAUTH]);
    connection.send(authRequest);
    var connected = new Promise<Tcp.ConnectionInfo>((F, R) => {
      connection.onceConnected.then(F);
      connection.onceClosed.then(R);
    });
    var firstBufferPromise :Promise<ArrayBuffer> = connection.receiveNext();
    return connected.then((i:Tcp.ConnectionInfo) => {
      return firstBufferPromise;
    }).then((buffer:ArrayBuffer) : Promise<ArrayBuffer> => {
      var auth = Socks.interpretAuthResponse(buffer);
      if (auth != Socks.Auth.NOAUTH) {
        throw new Error('SOCKS server returned unexpected AUTH response.  ' +
                        'Expected NOAUTH (' + Socks.Auth.NOAUTH + ') but got ' + auth);
      }

      var request :Socks.Request = {
        command: Socks.Command.TCP_CONNECT,
        endpoint: webEndpoint,
      };
      connection.send(Socks.composeRequestBuffer(request));
      return connection.receiveNext();
    }).then((buffer:ArrayBuffer) : Promise<Tcp.Connection> => {
      var response = Socks.interpretResponseBuffer(buffer);
      if (response.reply != Socks.Reply.SUCCEEDED) {
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
           .then((connection:Tcp.Connection) => {
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
