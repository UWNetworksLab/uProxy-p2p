import * as Socks from './headers';

// TODO: add tests for IPv6 address parsing
describe('socks', function() {
  // A valid SOCKS5/IPV4 request.
  var ipv4RequestArray :Uint8Array;

  // A valid SOCKS5/UDP request.
  var udpMessageArray :Uint8Array;

  beforeEach(function() {
    ipv4RequestArray = new Uint8Array([
      Socks.Version.VERSION5,
      Socks.Command.TCP_CONNECT,
      0, // reserved
      Socks.AddressType.IP_V4,
      192, 168, 1, 1, // IP: 192.168.1.1
      1200 >> 8, 1200 & 0xFF]); // port: 1200

    udpMessageArray = new Uint8Array([
      0, // reserved
      0, // reserved
      0, // frag
      Socks.AddressType.IP_V4,
      192, 168, 1, 1, // IP: 192.168.1.1
      1200 >> 8, 1200 & 0xFF, // port: 1200
      11, // message (byte 1/2)
      12]); // datagram (byte 2/2)
  });

  it('roundtrip auth request', () => {
    var auths = [
      Socks.Auth.GSSAPI,
      Socks.Auth.NOAUTH,
      Socks.Auth.NONE,
      Socks.Auth.USERPASS
    ];

    var buffer = Socks.composeAuthHandshakeBuffer(auths);
    var authsAgain = Socks.interpretAuthHandshakeBuffer(buffer);
    expect(authsAgain).toEqual(auths);
  });

  it('roundtrip auth response', () => {
    var auth = Socks.Auth.USERPASS;
    var buffer = Socks.composeAuthResponse(auth);
    var authAgain = Socks.interpretAuthResponse(buffer);
    expect(authAgain).toEqual(auth);
  });

  it('roundtrip userpass auth request', () => {
    var userpass = {
      username: 'user',
      password: 'pass'
    };
    var buffer = Socks.composeUserPassRequest(userpass);
    var userpassAgain = Socks.interpretUserPassRequest(buffer);
    expect(userpassAgain.username).toEqual(userpass.username);
    expect(userpassAgain.password).toEqual(userpass.password);
  });

  it('reject userpass auth request wrong version', () => {
    var userpass = {
      username: 'user',
      password: 'pass'
    };
    var buffer = new Uint8Array(Socks.composeUserPassRequest(userpass));
    buffer[0] = 2;
    expect(() => {
      Socks.interpretUserPassRequest(buffer);
    }).toThrow();
  });

  it('roundtrip userpass auth request empty username/password', () => {
    var userpass = {
      username: '',
      password: ''
    };
    var buffer = Socks.composeUserPassRequest(userpass);
    var userpassAgain = Socks.interpretUserPassRequest(buffer);
    expect(userpassAgain.username).toEqual(userpass.username);
    expect(userpassAgain.password).toEqual(userpass.password);
  });

  it('roundtrip userpass auth response', () => {
    var bufferTrue = Socks.composeUserPassResponse(true);
    var bufferFalse = Socks.composeUserPassResponse(false);
    expect(Socks.interpretUserPassResponse(bufferTrue)).toEqual(true);
    expect(Socks.interpretUserPassResponse(bufferFalse)).toEqual(false);
  });

  it('reject wrongly sized requests', () => {
    expect(() => {
      Socks.interpretRequestBuffer(new ArrayBuffer(8));
    }).toThrow();
  });

  it('compose ipv4 tcp request', () => {
    var request : Socks.Request = {
      command: Socks.Command.TCP_CONNECT,
      endpoint: {
        address: '192.168.1.1',
        port: 1200
      }
    };
    var requestBuffer = Socks.composeRequestBuffer(request);
    var requestArray = new Uint8Array(requestBuffer);
    expect(requestArray).toEqual(ipv4RequestArray);
  });

  it('parse ipv4 request', () => {
    var result :Socks.Request =
        Socks.interpretRequest(ipv4RequestArray);
    expect(result.command).toEqual(Socks.Command.TCP_CONNECT);
    expect(result.endpoint.address).toEqual('192.168.1.1');
    expect(result.endpoint.port).toEqual(1200);
  });

  it('roundtrip ipv6 tcp request', () => {
    var request : Socks.Request = {
      command: Socks.Command.TCP_CONNECT,
      endpoint: {
        address: '2620::1003:1003:a84f:9831:df45:5420',
        port: 1200
      }
    };
    var requestBuffer = Socks.composeRequestBuffer(request);
    var requestArray = new Uint8Array(requestBuffer);
    expect(requestArray[3]).toEqual(Socks.AddressType.IP_V6);
    var requestAgain = Socks.interpretRequestBuffer(requestBuffer);
    expect(requestAgain).toEqual(request);
  });

  it('roundtrip DNS tcp request', () => {
    var request : Socks.Request = {
      command: Socks.Command.TCP_CONNECT,
      endpoint: {
        address: 'www.example.com',
        port: 1200
      }
    };
    var requestBuffer = Socks.composeRequestBuffer(request);
    var requestArray = new Uint8Array(requestBuffer);
    expect(requestArray[3]).toEqual(Socks.AddressType.DNS);
    var requestAgain = Socks.interpretRequestBuffer(requestBuffer);
    expect(requestAgain).toEqual(request);
  });

  it('roundtrip IPv4 response', () => {
    var response :Socks.Response = {
      reply: Socks.Reply.SUCCEEDED,
      endpoint: {
        address: '255.0.1.77',
        port: 65535
      }
    };
    var responseBuffer = Socks.composeResponseBuffer(response);
    var responseArray = new Uint8Array(responseBuffer);
    expect(responseArray[3]).toEqual(Socks.AddressType.IP_V4);
    var responseAgain = Socks.interpretResponseBuffer(responseBuffer);
    expect(responseAgain).toEqual(response);
  });

  it('roundtrip IPv6 request response', () => {
    var response :Socks.Response = {
      reply: Socks.Reply.FAILURE,
      endpoint: {
        address: '2620::1003:1003:a84f:9831:df45:5420',
        port: 40000
      }
    };
    var responseBuffer = Socks.composeResponseBuffer(response);
    var responseArray = new Uint8Array(responseBuffer);
    expect(responseArray[3]).toEqual(Socks.AddressType.IP_V6);
    var responseAgain = Socks.interpretResponseBuffer(responseBuffer);
    expect(responseAgain).toEqual(response);
  });

  it('roundtrip DNS request response', () => {
    var response :Socks.Response = {
      reply: Socks.Reply.NOT_ALLOWED,
      endpoint: {
        address: 'www.subdomain.example.com',
        port: 45654
      }
    };
    var responseBuffer = Socks.composeResponseBuffer(response);
    var responseArray = new Uint8Array(responseBuffer);
    expect(responseArray[3]).toEqual(Socks.AddressType.DNS);
    var responseAgain = Socks.interpretResponseBuffer(responseBuffer);
    expect(responseAgain).toEqual(response);
  });

  it('wrong socks version', () => {
    ipv4RequestArray[0] = 4;
    expect(function() {
      Socks.interpretRequest(ipv4RequestArray);
    }).toThrow();
  });

  it('unsupported command', () => {
    ipv4RequestArray[1] = Socks.Command.TCP_BIND;
    expect(function() {
      Socks.interpretRequest(ipv4RequestArray);
    }).toThrow();
  });

  it('parse destination', () => {
    var destination = Socks.interpretDestination(ipv4RequestArray.subarray(3));
    expect(destination.addressByteLength).toEqual(7);
    expect(destination.addressType).toEqual(Socks.AddressType.IP_V4);
    expect(destination.endpoint.address).toEqual('192.168.1.1');
    expect(destination.endpoint.port).toEqual(1200);
  });

  it('parse udp request', () => {
    var udpMessage = Socks.interpretUdpMessage(udpMessageArray);
    expect(udpMessage.frag).toEqual(0);
    expect(udpMessage.destination.addressType).toEqual(Socks.AddressType.IP_V4);
    expect(udpMessage.destination.endpoint.address).toEqual('192.168.1.1');
    expect(udpMessage.destination.endpoint.port).toEqual(1200);
    expect(udpMessage.data.byteLength).toEqual(2);
    expect(udpMessage.data[0]).toEqual(11);
    expect(udpMessage.data[1]).toEqual(12);
  });

  it('reject wrongly sized udp requests', () => {
    expect(() => {
      Socks.interpretUdpMessage(new Uint8Array(new ArrayBuffer(9)));
    }).toThrow();
  });

  it('reject fragmentation requests', () => {
    udpMessageArray[2] = 7;
    expect(() => { Socks.interpretUdpMessage(udpMessageArray); }).toThrow();
  });

  it('roundtrip SOCKS 4 request', () => {
    let request : Socks.Request = {
      command: Socks.Command.TCP_CONNECT,
      endpoint: {
        address: '192.0.2.4',
        port: 54321
      }
    };
    let requestBuffer = Socks.composeRequestBufferV4(request);
    let requestArray = new Uint8Array(requestBuffer);
    expect(requestArray[0]).toEqual(Socks.Version.VERSION4);
    expect(requestArray[1]).toEqual(Socks.Command.TCP_CONNECT);
    expect(requestArray[2] << 8 | requestArray[3]).toEqual(request.endpoint.port);
    expect(requestArray[8]).toEqual(0);
    expect(requestArray.length).toEqual(9);
    let requestAgain = Socks.interpretRequestBufferV4(requestBuffer);
    expect(requestAgain).toEqual(request);
  });

  it('roundtrip SOCKS 4a request', () => {
    let request : Socks.Request = {
      command: Socks.Command.TCP_CONNECT,
      endpoint: {
        address: 'www.example.com',
        port: 1200
      }
    };
    let requestBuffer = Socks.composeRequestBufferV4(request);
    let requestArray = new Uint8Array(requestBuffer);
    expect(requestArray[0]).toEqual(Socks.Version.VERSION4);
    expect(requestArray[1]).toEqual(Socks.Command.TCP_CONNECT);
    expect(requestArray[2] << 8 | requestArray[3]).toEqual(request.endpoint.port);
    expect(requestArray[4] | requestArray[5] | requestArray[6]).toEqual(0);
    expect(requestArray[7]).toEqual(request.endpoint.address.length);
    expect(requestArray[8]).toEqual(0);
    expect(requestArray.length).toEqual(10 + request.endpoint.address.length);
    let requestAgain = Socks.interpretRequestBufferV4(requestBuffer);
    expect(requestAgain).toEqual(request);
  });

  it('check SOCKS 4 version', () => {
    let request : Socks.Request = {
      command: Socks.Command.TCP_CONNECT,
      endpoint: {
        address: '192.0.2.4',
        port: 54321
      }
    };
    let requestBuffer = Socks.composeRequestBufferV4(request);
    let version = Socks.checkVersion(requestBuffer);
    expect(version).toEqual(Socks.Version.VERSION4);
  });

  it('check SOCKS 5 version', () => {
    let request : Socks.Request = {
      command: Socks.Command.TCP_CONNECT,
      endpoint: {
        address: '192.0.2.4',
        port: 54321
      }
    };
    let requestBuffer = Socks.composeRequestBuffer(request);
    let version = Socks.checkVersion(requestBuffer);
    expect(version).toEqual(Socks.Version.VERSION5);
  });

  it('roundtrip IPv4 response', () => {
    let response :Socks.Response = {
      reply: Socks.Reply.SUCCEEDED,
      endpoint: {
        address: '255.0.1.77',
        port: 65535
      }
    };
    let responseBuffer = Socks.composeResponseBufferV4(response);
    let responseArray = new Uint8Array(responseBuffer);
    expect(responseArray[0]).toEqual(Socks.Version.VERSION0);
    expect(responseArray[1]).toEqual(Socks.ResultCode4.REQUEST_GRANTED);
    expect(responseArray[2] << 8 | responseArray[3]).toEqual(response.endpoint.port);
    let responseAgain = Socks.interpretResponseBufferV4(responseBuffer);
    expect(responseAgain).toEqual(response);
  });
});
