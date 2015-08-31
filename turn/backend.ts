/// <reference path='../../../third_party/freedom-typings/freedom-module-env.d.ts' />
/// <reference path='../../../third_party/typings/es6-promise/es6-promise.d.ts' />

import arraybuffers = require('../arraybuffers/arraybuffers');
import logging = require('../logging/logging');
import messages = require('./messages');
import net = require('../net/net.types');

var log :logging.Log = new logging.Log('TURN backend');

/**
 * Represents a client known to the server. One of these objects is created
 * in response to each ALLOCATE request.
 */
class Allocation {
  /** Socket on which we are relaying datagrams for the client. */
  socket:freedom.UdpSocket.Socket;
}

/**
 * Handles relay sockets for the TURN server frontend.
 */
export class Backend {
  /**
   * All clients currently known to the server, indexed by tag.
   * Note that this map is essentially the (extremely inaccurately) named
   * "5-tuple" introduced in section 2.2 of the TURN RFC:
   *   http://tools.ietf.org/html/rfc5766#section-2.2
   */
  private allocations_:{[s:string]:Promise<Allocation>} = {};

  /** Invoked when a message must be sent to the frontend. */
  private ipcHandler_ = (
      stunMessage:messages.StunMessage,
      clientEndpoint:net.Endpoint) : void => {
    log.warn('no handler set for outgoing messages!');
  };

  public handleIpc = (
      stunMessage:messages.StunMessage,
      clientEndpoint:net.Endpoint) : Promise<void> => {
    if (stunMessage.method == messages.MessageMethod.ALLOCATE) {
      this.makeAllocation_(clientEndpoint).then((allocation:Allocation) => {
        return allocation.socket.getInfo().then(
            (socketInfo:freedom.UdpSocket.SocketInfo) => {
          this.ipcHandler_({
            method: messages.MessageMethod.ALLOCATE,
            clazz: messages.MessageClass.SUCCESS_RESPONSE,
            transactionId: stunMessage.transactionId,
            attributes: [{
              // Endpoint on which the new socket is listening.
              // This is really the whole point of the thing.
              type: messages.MessageAttribute.XOR_RELAYED_ADDRESS,
              value: messages.formatXorMappedAddressAttribute(
                  socketInfo.localAddress,
                  socketInfo.localPort)
            }, {
              // Endpoint from which the client appears to us.
              // This is essentially a STUN response and is generally
              // provided as a convenience to TURN clients.
              type: messages.MessageAttribute.XOR_MAPPED_ADDRESS,
              value: messages.formatXorMappedAddressAttribute(
                  clientEndpoint.address, clientEndpoint.port)
            }, {
              // Lifetime.
              type: messages.MessageAttribute.LIFETIME,
              value: new Uint8Array([0x00, 0x00, 600 >> 8, 600 & 0xff]) // 600 = ten mins
            }]
          }, clientEndpoint);
        });
      }).catch((e:Error) => {
        // Send error response (failed to make allocation).
        this.ipcHandler_({
          method: messages.MessageMethod.ALLOCATE,
          clazz: messages.MessageClass.FAILURE_RESPONSE,
          transactionId: stunMessage.transactionId,
          attributes: []
        }, clientEndpoint);
      });
    } else if (stunMessage.method == messages.MessageMethod.SEND) {
      // Extract the destination address and payload.
      var destinationAttribute :messages.StunAttribute;
      var dataAttribute :messages.StunAttribute;
      try {
        destinationAttribute = messages.findFirstAttributeWithType(
            messages.MessageAttribute.XOR_PEER_ADDRESS,
            stunMessage.attributes);
        dataAttribute = messages.findFirstAttributeWithType(
            messages.MessageAttribute.DATA,
            stunMessage.attributes);
      } catch (e) {
        return Promise.reject(new Error(
            'no address or data attribute in SEND indication'));
      }

      var remoteEndpoint = messages.parseXorMappedAddressAttribute(
          destinationAttribute.value);
      var payload = Backend.bytesToArrayBuffer_(dataAttribute.value);

      var tag = clientEndpoint.address + ':' + clientEndpoint.port;
      if (!(tag in this.allocations_)) {
        return Promise.reject(new Error(
            'received SEND indication for client without allocation'));
      }

      this.allocations_[tag].then((allocation:Allocation) => {
        allocation.socket.sendTo(
          payload,
          remoteEndpoint.address,
          remoteEndpoint.port);
      });
    } else {
      return Promise.reject(new Error(
          'unsupported IPC method: ' + stunMessage.method));
    }
    return Promise.resolve<void>();
  }

  /** Promises to allocate a socket, wrapped in an Allocation. */
  private makeAllocation_ = (
      clientEndpoint:net.Endpoint) : Promise<Allocation> => {
    var tag = clientEndpoint.address + ':' + clientEndpoint.port;
    if (tag in this.allocations_) {
      return this.allocations_[tag];
    }

    var socket :freedom.UdpSocket.Socket = freedom['core.udpsocket']();
    var promise = socket.bind('127.0.0.1', 0).then(() => {
      socket.getInfo().then((socketInfo:freedom.UdpSocket.SocketInfo) => {
        log.info('allocated socket for ' + tag + ' on ' +
            socketInfo.localAddress + ':' + socketInfo.localPort);
      });
      return Promise.resolve({
        socket: socket
      });
    });

    socket.on('onData', (recvFromInfo:freedom.UdpSocket.RecvFromInfo) => {
      this.ipcHandler_({
        method: messages.MessageMethod.DATA,
        clazz: messages.MessageClass.INDICATION,
        transactionId: Backend.getRandomTransactionId_(),
        attributes: [{
          type: messages.MessageAttribute.XOR_PEER_ADDRESS,
          value: messages.formatXorMappedAddressAttribute(
              recvFromInfo.address,
              recvFromInfo.port)
        }, {
          type: messages.MessageAttribute.DATA,
          value: new Uint8Array(recvFromInfo.data)
        }]
      }, clientEndpoint);
    });

    this.allocations_[tag] = promise;
    return promise;
  }

  /** Sets the function to call to send a message to the frontend. */
  public setIpcHandler = (ipcHandler:(
      stunMessage:messages.StunMessage,
      clientEndpoint:net.Endpoint) => void) : void => {
    this.ipcHandler_ = ipcHandler;
  }

  /**
   * Copies a Uint8Array into a new ArrayBuffer. Useful when the array
   * has been constructed from a subarray of the buffer, in which case
   * bytes.buffer is a much larger array than you are expecting.
   * TODO: be smarter about using slice in these instances
   */
  private static bytesToArrayBuffer_ = (bytes:Uint8Array) : ArrayBuffer => {
    var buffer = new ArrayBuffer(bytes.length);
    var view = new Uint8Array(buffer);
    for (var i = 0; i < bytes.length; i++) {
      view[i] = bytes[i];
    }
    return buffer;
  }

  private static getRandomTransactionId_ = () : Uint8Array => {
    var bytes = new Uint8Array(20);
    for (var i = 0; i < 20; i++) {
      bytes[i] = Math.random() * 255;
    }
    return bytes;
  }
}
