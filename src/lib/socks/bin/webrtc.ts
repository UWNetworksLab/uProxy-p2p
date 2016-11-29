/// <reference path='../../../../third_party/wrtc/wrtc.d.ts' />

import * as node_server from '../node/server';
import * as node_socket from '../node/socket';
import * as session from '../session';

import * as wrtc from 'wrtc';

const SERVER_ADDRESS = '0.0.0.0';
const SERVER_PORT = 9999;

const getter = new wrtc.RTCPeerConnection();
const giver = new wrtc.RTCPeerConnection();

getter.onicecandidate = (event: any) => {
  if (event.candidate) {
    console.info('getter candidate', event.candidate.candidate);
    giver.addIceCandidate(event.candidate);
  }
}
giver.onicecandidate = (event: any) => {
  if (event.candidate) {
    console.info('giver candidate', event.candidate.candidate);
    getter.addIceCandidate(event.candidate);
  }
}

// Create a SocksSession in response to each new datachannel.
// NOTE: because onopen datachannel events don't fire for the
//       peer who created the datachannel, this is not fired
//       for the "opening" channel.
giver.ondatachannel = (event: any) => {
  const channel: any = event.channel;
  const sessionId = channel.label;

  const socksSession = new session.SocksSession(sessionId);
  socksSession.onForwardingSocketRequired((host, port) => {
    const forwardingSocket = new node_socket.NodeForwardingSocket();
    return forwardingSocket.connect(host, port).then(() => {
      return forwardingSocket;
    });
  });

  // datachannel -> SOCKS session
  channel.onmessage = (event: any) => {
    socksSession.handleDataFromSocksClient(event.data);
  };
  // datachannel <- SOCKS session
  socksSession.onDataForSocksClient((bytes) => {
    // When too much is buffered, the channel closes/fails.
    // TODO: backpressure!
    if (channel.bufferedAmount < 16000000) {
      channel.send(bytes);
    } else {
      console.warn('channel congested, dropping bytes')
    }
  });

  socksSession.onDisconnect(() => {
  });
  channel.onclose = () => {
    console.info(sessionId + ': channel closed (giver side)');
  };
};

// Curiously, we must do this *before* creating an offer.
getter.createDataChannel('IGNORED').onopen = () => {
  console.info('connected!');
  new node_server.NodeSocksServer(SERVER_ADDRESS, SERVER_PORT).onConnection((sessionId) => {
    const channel = getter.createDataChannel(sessionId);
    channel.onclose = () => {
      console.info(sessionId + ': channel closed (getter side)');
    };

    return {
      // SOCKS client -> datachannel
      handleDataFromSocksClient: (bytes: ArrayBuffer) => {
        channel.send(bytes);
      },
      // SOCKS client <- datachannel
      onDataForSocksClient: (callback: (buffer: ArrayBuffer) => void) => {
        channel.onmessage = (event: any) => {
          callback(event.data);
        };
        return this;
      },
      // the socks client has disconnected - close the datachannel.
      handleDisconnect: () => {
        console.info(sessionId + ': client disconnected, closing datachannel');
        channel.close();
      },
      onDisconnect: (callback: () => void) => {
        return this;
      }
    };
  }).listen().then(() => {
    console.log('curl -x socks5h://' + SERVER_ADDRESS + ':' + SERVER_PORT + ' www.example.com');
  }, (e) => {
    console.error('failed to start SOCKS server', e);
  });
};

getter.createOffer((offer: any) => {
  console.info('offer', offer.sdp);
  getter.setLocalDescription(offer);
  giver.setRemoteDescription(offer);
  giver.createAnswer((answer: any) => {
    console.info('answer', answer.sdp);
    giver.setLocalDescription(answer);
    getter.setRemoteDescription(answer);
  }, console.error);
}, console.error);
