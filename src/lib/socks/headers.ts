/*
  For the RFC for socks, see:
    http://tools.ietf.org/html/rfc1928
*/
/// <reference path='../../../third_party/ipaddrjs/ipaddrjs.d.ts' />

import * as arraybuffers from '../arraybuffers/arraybuffers';
import * as ipaddr from 'ipaddr.js';
import * as net from '../net/net.types';

// VERSION - Socks protocol and subprotocol version headers
export enum Version {
  VERSION1 = 0x01,
  VERSION5 = 0x05
}

// AUTH - Authentication methods
export enum Auth {
  NOAUTH   = 0x00,  // X'00' NO AUTHENTICATION REQUIRED
  GSSAPI   = 0x01,  // X'01' GSSAPI
  USERPASS = 0x02,  // X'02' USERNAME/PASSWORD
                    // X'03' to X'7F' IANA ASSIGNED
                    // X'80' to X'FE' RESERVED FOR PRIVATE METHODS
  NONE     = 0xFF   // X'FF' NO ACCEPTABLE METHODS
}

// CMD - Commands
export enum Command {
  TCP_CONNECT       = 0x01, // Connect to TCP = CONNECT in the RFC.
  TCP_BIND          = 0x02, // Listen for TCP = BIND in the RFC.
  UDP_ASSOCIATE     = 0x03  // Connect to UDP association
}

// ATYP - address type of following address.
export enum AddressType {
  IP_V4 = 0x01,  // IP V4 Address
  DNS   = 0x03,  // DOMAINNAME
  IP_V6 = 0x04   // IP V6 Address
}

// REP - Reply Field
export enum Reply {
  SUCCEEDED           = 0x00,  // Succeeded
  FAILURE             = 0x01,  // General SOCKS server failure
  NOT_ALLOWED         = 0x02,  // Connection not allowed by ruleset
  NETWORK_UNREACHABLE = 0x03,  // Network unreachable
  HOST_UNREACHABLE    = 0x04,  // Host unreachable
  CONNECTION_REFUSED  = 0x05,  // Connection refused
  TTL_EXPIRED         = 0x06,  // TTL expired
  UNSUPPORTED_COMMAND = 0x07,  // Command not supported
  ADDRESS_TYPE        = 0x08,  // Address type not supported
  RESERVED            = 0x09   // 0x09 - 0xFF unassigned
}

// Represents the destination portion of a SOCKS request.
// @see interpretDestination
export interface Destination {
  addressType    :AddressType;
  endpoint       :net.Endpoint;
  // The length, in bytes, of the address in an arraybuffer. Used to know far
  // to move in the arraybuffer to get to the next bit of data to interpret.
  addressByteLength     :number;
}

// Represents a SOCKS request.
// @see interpretSocksRequest
export interface Request {
  command        :Command;
  endpoint       :net.Endpoint;
}

// Represents a SOCKS username-password pair for USERPASS auth
// @see interpretUserPassRequest
export interface UserPassRequest {
  username       :string;
  password       :string;
}

function isValidEndpoint(e:any) : boolean {
  if (typeof e != 'object') {
    return false;
  }
  if (typeof e.address != 'string') {
    return false;
  }
  if (typeof e.port != 'number' ||
      e.port < 0 || e.port > 65535) {
    return false;
  }
  if (Object.keys(e).length > 2) {
    return false;
  }
  return true;
}

export function isValidRequest(r:any) : boolean {
  if (typeof r != 'object') {
    return false;
  }
  if (typeof r.command != 'number' ||
      typeof Command[r.command] != 'string') {
    return false;
  }
  if (!isValidEndpoint(r.endpoint)) {
    return false;
  }
  if (Object.keys(r).length > 2) {
    return false;
  }
  return true;
}

export interface Response {
  reply: Reply;
  endpoint?: net.Endpoint;
}

export function isValidResponse(r:any) : boolean {
  if (typeof r != 'object') {
    return false;
  }
  if (typeof r.reply != 'number' ||
      typeof Reply[r.reply] != 'string') {
    return false;
  }
  if (r.reply == Reply.SUCCEEDED && !r.endpoint) {
    return false;
  }
  if (r.endpoint && !isValidEndpoint(r.endpoint)) {
    return false;
  }
  if (Object.keys(r).length > 2) {
    return false;
  }
  return true;
}

// Represents a UDP request message.
// @see interpretUdpMessage
export interface UdpMessage {
  frag           :number;
  destination    :Destination;
  data           :Uint8Array;
}



// Client to Server (Step 1)
// Authentication method negotiation
//
// Examines the supplied session establishment bytes, throwing an
// error if the requested SOCKS version or METHOD is unsupported.
// https://tools.ietf.org/html/rfc1928
//
//   +----+----------+----------+
//   |VER | NMETHODS | METHODS  |
//   +----+----------+----------+
//   | 1  |    1     | 1 to 255 |
//   +----+----------+----------+
//
//
export function interpretAuthHandshakeBuffer(buffer:ArrayBuffer) : Auth[] {
  var handshakeBytes = new Uint8Array(buffer);
  console.log(`***** handshakeBytes: ${handshakeBytes[0]} ${handshakeBytes[1]} ${handshakeBytes[2]}`);

  // Only SOCKS Version 5 is supported.
  var socksVersion = handshakeBytes[0];
  if (socksVersion != Version.VERSION5) {
    if (socksVersion === 71 /* 'G' as in 'GET' */) {
      console.error('Make sure you set a SOCKS proxy and not an HTTP proxy!')
    }
    throw new Error('unsupported SOCKS version: ' + socksVersion);
  }

  // Check AUTH methods on SOCKS handshake.
  // Get supported auth methods. Starts from 1, since 0 is already read.
  var authMethods:Auth[] = [];
  var numAuthMethods:number = handshakeBytes[1];
  for (var i = 0; i < numAuthMethods; i++) {
    authMethods.push(handshakeBytes[2 + i]);
  }
  // Make sure the client supports 'no authentication'.
  if (authMethods.indexOf(Auth.NOAUTH) <= -1) {
    throw new Error('client requires authentication');
  }
  return authMethods;
}

export function composeAuthHandshakeBuffer(auths:Auth[]) : ArrayBuffer {
  if (auths.length == 0) {
    throw new Error('At least one authentication method must be specified.');
  }
  var handshakeBytes = new Uint8Array(auths.length + 2);
  handshakeBytes[0] = Version.VERSION5;
  handshakeBytes[1] = auths.length;
  // https://github.com/Microsoft/TypeScript/issues/3979
  (<any>handshakeBytes).set(auths, 2);
  return handshakeBytes.buffer;
}

// Server to Client (Step 2)
// Authentication method negotiation response
//
// Given an initial authentication query, compose a response with the support
// authentication types (none needed).
export function composeAuthResponse(authType:Auth)
    : ArrayBuffer {
  var buffer:ArrayBuffer = new ArrayBuffer(2);
  var bytes:Uint8Array = new Uint8Array(buffer);
  bytes[0] = Version.VERSION5;
  bytes[1] = authType;
  return buffer;
}

export function interpretAuthResponse(buffer:ArrayBuffer) : Auth {
  if (buffer.byteLength != 2) {
    throw new Error('Auth response must be exactly 2 bytes long');
  }
  var byteArray = new Uint8Array(buffer);

  // Only SOCKS Version 5 is supported.
  var socksVersion = byteArray[0];
  if (socksVersion != Version.VERSION5) {
    throw new Error('unsupported SOCKS version: ' + socksVersion);
  }
  return byteArray[1];
}

// In between Steps 2 and 3, additional subnegotiation messages may need to
// be exchanged depending on which authentication method was negotiated.
//
// Client to Server (USERPASS Subnegotiation)
// https://tools.ietf.org/html/rfc1929
//
// Given a username and password combination for userpass auth, compose and
// interpret the auth request.
//
//            +----+------+----------+------+----------+
//            |VER | ULEN |  UNAME   | PLEN |  PASSWD  |
//            +----+------+----------+------+----------+
//            | 1  |  1   | 1 to 255 |  1   | 1 to 255 |
//            +----+------+----------+------+----------+
export function composeUserPassRequest(userPass:UserPassRequest) : ArrayBuffer {
  const ulen = userPass.username.length;
  const plen = userPass.password.length;
  var requestBytes = new Uint8Array(2 + ulen + 1 + plen);

  requestBytes[0] = Version.VERSION1;  // Only support version 1 of UserPass protocol.
  requestBytes[1] = ulen;
  requestBytes.set(new Buffer(userPass.username, 'ascii'), 2);
  requestBytes[2 + ulen] = plen;
  requestBytes.set(new Buffer(userPass.password, 'ascii'), 2 + ulen + 1);
  return requestBytes.buffer;
}

export function interpretUserPassRequest(buffer:ArrayBuffer) : UserPassRequest {
  var requestBytes = new Uint8Array(buffer);
  if (requestBytes.byteLength < 3) {
    throw new Error('USERPASS auth request must be at least 3 bytes long');
  }
  // Only UserPass Version 1 is supported.
  var userpassVersion = requestBytes[0];
  if (userpassVersion != Version.VERSION1) {
    throw new Error('unsupported USERPASS Auth version: ' + userpassVersion);
  }
  const ulen = requestBytes[1];
  if (requestBytes.byteLength < 2 + ulen + 1) {
    throw new Error('USERPASS auth request does not contain proper bytes.' +
                   ' ulen: ' + ulen + ', request size: ' +
                   requestBytes.byteLength);
  }
  const username = (new Buffer(requestBytes)).slice(2, 2 + ulen).toString('ascii');
  const plen = requestBytes[2 + ulen];
  if (requestBytes.byteLength != 2 + ulen + 1 + plen) {
    throw new Error('USERPASS auth request does not contain proper bytes.' +
                   ' ulen: ' + ulen + ', plen: ' + plen +
                   ' request size: ' + requestBytes.byteLength);
  }
  const password = (new Buffer(requestBytes)).slice(2 + ulen + 1).toString('ascii');
  return {
    username: username,
    password: password
  };
}

// Server to Client (USERPASS Subnegotiation)
// Given a boolean of userpass auth success, compose and interpret response.
//
//                         +----+--------+
//                         |VER | STATUS |
//                         +----+--------+
//                         | 1  |   1    |
//                         +----+--------+
export function composeUserPassResponse(success:boolean) : ArrayBuffer {
  var responseBytes = new Uint8Array(2);
  responseBytes[0] = Version.VERSION1;  // Only support for version 1 of UserPass protocol.
  responseBytes[1] = success ? 0 : -1;  // Send 0 if successful
  return responseBytes.buffer;
}

export function interpretUserPassResponse(buffer:ArrayBuffer) : boolean {
  var responseBytes = new Uint8Array(buffer);
  if (responseBytes.byteLength != 2) {
    throw new Error('USERPASS auth response must be exactly 2 bytes long');
  }
  return responseBytes[1] === 0;
}

// Client to Server (Step 3-A)
//
// Interprets a SOCKS 5 request, which looks like this:
//
//   +----+-----+-------+------+----------+----------+
//   |VER | CMD |  RSV  | ATYP | DST.ADDR | DST.PORT |
//   +----+-----+-------+------+----------+----------+
//   | 1  |  1  | X'00' |  1   | Variable |    2     |
//   +----+-----+-------+------+----------+----------+
export function interpretRequestBuffer(buffer:ArrayBuffer)
    : Request {
  return interpretRequest(new Uint8Array(buffer));
}
export function interpretRequest(byteArray:Uint8Array) : Request {
  var version     :number;
  var command     :Command;
  var destination :Destination;

  // Fail if the request is too short to be valid.
  if (byteArray.length < 9) {
    throw new Error(`SOCKS request too short: ${byteArray[0]} ${byteArray[1]} ${byteArray[2]} ${byteArray[3]} ${byteArray[4]} `);
  }

  // Fail if client is not talking Socks version 5.
  version = byteArray[0];
  if (version !== Version.VERSION5) {
    throw new Error('must be SOCKS5');
  }

  command = byteArray[1];
  // Fail unless we got a CONNECT or UDP_ASSOCIATE command.
  if (command != Command.TCP_CONNECT &&
    command != Command.UDP_ASSOCIATE) {
    throw new Error('unsupported SOCKS command (CMD): ' + command);
  }

  destination = interpretDestination(byteArray.subarray(3));

  var request = {
    command: command,
    endpoint: destination.endpoint
  };

  if (!isValidRequest(request)) {
    throw new Error('Constructed invalid request object: ' +
                    JSON.stringify(request));
  }

  return request;
}

export function composeRequestBuffer(request:Request) : ArrayBuffer {
  var destination = makeDestinationFromEndpoint(request.endpoint);
  // The header is 3 bytes
  var byteArray = new Uint8Array(3 + destination.addressByteLength);
  byteArray[0] = Version.VERSION5;
  byteArray[1] = request.command;
  byteArray[2] = 0;  // reserved
  byteArray.set(composeDestination(destination), 3);
  return byteArray.buffer;
}

// Client to Server (Step 3-B)
//
// Interprets a SOCKS5 UDP request, returning the UInt8Array view of the
// sub-section for the DATA part of the request. The Request looks like this:
//
//   +----+------+------+----------+----------+----------+
//   |RSV | FRAG | ATYP | DST.ADDR | DST.PORT |   DATA   |
//   +----+------+------+----------+----------+----------+
//   | 2  |  1   |  1   | Variable |    2     | Variable |
//   +----+------+------+----------+----------+----------+
export function interpretUdpMessage(byteArray:Uint8Array) : UdpMessage {
  // Fail if the request is too short to be valid.
  if(byteArray.length < 10) {
    throw new Error('UDP request too short');
  }

  var destination :Destination = interpretDestination(byteArray.subarray(3));

  var udpMessage :UdpMessage = {
    frag: byteArray[2],
    destination: destination,
    data: byteArray.subarray(3 + destination.addressByteLength)
  };

  // Fail if client is requesting fragmentation.
  if (udpMessage.frag !== 0) {
    throw new Error('fragmentation not supported');
  }

  return udpMessage;
}


// Interprets this sub-structure, found within both "regular" SOCKS requests
// and UDP requests:
//
//   +------+----------+----------+
//   | ATYP | DST.ADDR | DST.PORT |
//   +------+----------+----------+
//   |  1   | Variable |    2     |
//   +------+----------+----------+
//
// The length of DST.ADDR varies according to the type found (IPv4, IPv6,
// host name, etc).
//
// Returns a Destination which captures this in a more convenient form.
export function interpretDestination(byteArray:Uint8Array) : Destination {
  var portOffset   :number;
  var addressType  :AddressType;
  var addressSize  :number;
  var address      :string;
  var port         :number;

  addressType = byteArray[0];
  if (AddressType.IP_V4 == addressType) {
    addressSize = 4;
    address = interpretIpv4Address(
        byteArray.subarray(1, 1 + addressSize));
    portOffset = addressSize + 1;
  } else if (AddressType.DNS == addressType) {
    addressSize = byteArray[1];
    address = '';
    for (var i = 0; i < addressSize; ++i) {
      address += String.fromCharCode(byteArray[2 + i]);
    }
    portOffset = addressSize + 2;
  } else if (AddressType.IP_V6 == addressType) {
    addressSize = 16;
    address = interpretIpv6Address(
        byteArray.subarray(1, 1 + addressSize));
    portOffset = addressSize + 1;
  } else {
    throw new Error('Unsupported SOCKS address type: ' + addressType);
  }

  // Parse the port.
  port = byteArray[portOffset] << 8 | byteArray[portOffset + 1];

  return {
    addressType: addressType,
    endpoint: { address: address, port: port },
    addressByteLength: portOffset + 2
  }
}

function interpretIpv4Address(byteArray:Uint8Array) : string {
  if (byteArray.length != 4) {
    throw new Error('IPv4 addresses must be exactly 4 bytes long');
  }
  var ipAddress = new ipaddr.IPv4(Array.prototype.slice.call(byteArray));
  return ipAddress.toString();
}

// Heler function for parsing an IPv6 address from an Uint8Array portion of
// a socks address in an arraybuffer.
export function interpretIpv6Address(byteArray:Uint8Array) : string {
  if (byteArray.length != 16) {
    throw new Error('IPv6 addresses must be exactly 16 bytes long');
  }
  // |byteArray| contains big-endian shorts, but Uint16Array would read it
  // as little-endian on most platforms, so we have to read it manually.
  var parts :number[] = [];
  for (var i = 0; i < 16; i += 2) {
    parts.push(byteArray[i] << 8 | byteArray[i + 1]);
  }
  var ipAddress = new ipaddr.IPv6(parts);
  return ipAddress.toString();
}

export function composeDestination(destination:Destination) : Uint8Array {
  var endpoint = destination.endpoint;
  var address = new Uint8Array(destination.addressByteLength);
  address[0] = destination.addressType;
  var addressSize :number;
  switch (destination.addressType) {
    case AddressType.IP_V4:
      addressSize = 4;
      var ipv4 = ipaddr.IPv4.parse(endpoint.address);
      // https://github.com/Microsoft/TypeScript/issues/3979
      (<any>address).set(ipv4.octets, 1);
      break;
    case AddressType.DNS:
      addressSize = endpoint.address.length + 1;
      address[1] = endpoint.address.length;
      for (var i = 0; i < endpoint.address.length; ++i) {
        address[i + 2] = endpoint.address.charCodeAt(i);
      }
      break;
    case AddressType.IP_V6:
      addressSize = 16;
      var ipv6 = ipaddr.IPv6.parse(endpoint.address);
      // https://github.com/Microsoft/TypeScript/issues/3979
      (<any>address).set(ipv6.toByteArray(), 1);
      break;
    default:
      throw new Error(
          'Unsupported SOCKS address type: ' + destination.addressType);
  }

  var portOffset = addressSize + 1;
  address[portOffset] = endpoint.port >> 8;
  address[portOffset + 1] = endpoint.port & 0xFF;

  return address;
}

function makeDestinationFromEndpoint(endpoint:net.Endpoint) : Destination {
  var type :AddressType;
  var byteLength :number;
  if (ipaddr.IPv4.isValid(endpoint.address)) {
    type = AddressType.IP_V4;
    byteLength = 7;  // 1 (type) + 4 (address) + 2 (port)
  } else if (ipaddr.IPv6.isValid(endpoint.address)) {
    type = AddressType.IP_V6;
    byteLength = 19;  // 1 (type) + 16 (address) + 2 (port)
  } else {
    // TODO: Fail if the string is not a valid DNS name.
    type = AddressType.DNS;
    // 4 = 1 (type) + 1 (length) + 2 (port)
    byteLength = endpoint.address.length + 4;
  }
  return {
    addressType: type,
    endpoint: endpoint,
    addressByteLength: byteLength
  };
}

// Server to Client (Step 4-A)
//
// TODO: support failure (https://github.com/uProxy/uproxy/issues/321)
//
// Given a destination reached, compose a response.
export function composeResponseBuffer(response:Response) : ArrayBuffer {
  var fakeEndpoint :net.Endpoint = {
    address: '0.0.0.0',
    port: 0
  };
  var endpoint :net.Endpoint = response.endpoint || fakeEndpoint;
  var destination = makeDestinationFromEndpoint(endpoint);
  var destinationArray = composeDestination(destination);

  var bytes :Uint8Array = new Uint8Array(destinationArray.length + 3);
  bytes[0] = Version.VERSION5;
  bytes[1] = response.reply;
  bytes[2] = 0x00;
  bytes.set(destinationArray, 3);

  return bytes.buffer;
}

export function interpretResponseBuffer(buffer:ArrayBuffer) : Response {
  var bytes = new Uint8Array(buffer);

  // Only SOCKS Version 5 is supported.
  var socksVersion = bytes[0];
  if (socksVersion != Version.VERSION5) {
    throw new Error('unsupported SOCKS version: ' + socksVersion);
  }

  var reply = bytes[1];
  var destination = interpretDestination(bytes.subarray(3));
  var response = {
    reply: reply,
    endpoint: destination.endpoint
  };

  if (!isValidResponse(response)) {
    throw new Error('Constructed invalid response object: ' +
                    JSON.stringify(response));
  }

  return response;
}
