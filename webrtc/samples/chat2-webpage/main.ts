/// <reference path='../../peerconnection.d.ts' />
/// <reference path='../../datachannel.d.ts' />
/// <reference path='../../../third_party/typings/angularjs/angular.d.ts' />
/// <reference path='../../../arraybuffers/arraybuffers.d.ts' />


//------------------------------------------------------------------------------
interface Channel {
  label :string;
  state :string; // 'open', 'connecting', 'closed'
  messages :string[];
  messageToSend :string
}

interface WebrtcPcControllerScope extends ng.IScope {
  state :string;  // 'WAITING.', 'CONNECTING...', 'CONNECTED!', 'DISCONNECTED.'
  errors :string[];
  connectInfo :string;

  localInfo :string;
  remoteInfo :string;

  newChannelLabel :string;

  channels : {[channelLabel:string] : Channel};

  // User actions
  initiateConnection :() => void;
  processRemoteSignallingMessages :() => void;
  clearErrors :() => void;

  createDataChannel :(channelLabel:string) => void;
  send :(channelLabel:string, message:string) => void;
  closeDataChannel :(channelLabel:string) => void;

  addDataChannel :(d:WebRtc.DataChannel) => void;
  addMessage :(channelLabel:string, d:WebRtc.Data, who:string) => void;

  // Callback from pc
  onLocalSignallingMessage :(signal:WebRtc.SignallingMessage) => void;
}

//-----------------------------------------------------------------------------
// Create a new peer connection.
var pcConfig :WebRtc.PeerConnectionConfig = {
    webrtcPcConfig: {
      iceServers: [{url: 'stun:stun.l.google.com:19302'},
                   {url: 'stun:stun1.l.google.com:19302'},
                   {url: 'stun:stun2.l.google.com:19302'},
                   {url: 'stun:stun3.l.google.com:19302'},
                   {url: 'stun:stun4.l.google.com:19302'}]
    },
    webrtcMediaConstraints: {
      optional: [{DtlsSrtpKeyAgreement: true}]
    }
  };
var pc :WebRtc.PeerConnection = new WebRtc.PeerConnection(pcConfig);

//-----------------------------------------------------------------------------
var webrtcPcApp = angular.module('webrtcPcApp', []);
webrtcPcApp.controller('webrtcPcController',
    ($scope :WebrtcPcControllerScope) => {
  //---------------------------------------------------------------------------
  $scope.state = 'WAITING.';
  $scope.errors = [];
  $scope.connectInfo = '';
  $scope.channels = {};

  $scope.localInfo = '';
  $scope.remoteInfo = '';

  $scope.newChannelLabel = 'test-channel-label';

  $scope.clearErrors = () => { $scope.errors = []; }

  //---------------------------------------------------------------------------
  // Promise completion callbacks
  pc.onceConnecting.then(() => {
    $scope.$apply(() => { $scope.state = 'CONNECTING...'; });
  });
  pc.onceConnected.then((addresses) => {
    $scope.$apply(() => {
      $scope.state = 'CONNECTED!';
      $scope.localInfo = '';
      $scope.remoteInfo = '';
      $scope.connectInfo = JSON.stringify(addresses);
    });
  }).catch((e) => {
    $scope.$apply(() => { $scope.errors.push(e.toString()); });
  });
  pc.onceDisconnected.then(() => {
    $scope.$apply(() => { $scope.state = 'DISCONNECTED.'; });
  });

  pc.peerOpenedChannelQueue.setSyncHandler((d:WebRtc.DataChannel) => {
    if(d.getLabel() !== '') {
      $scope.$apply(() => { $scope.addDataChannel(d); });
    } else {
      console.log('ignoring dummy channel.');
    }
  });

  // called when the start button is clicked. Only called on the initiating
  // side.
  $scope.initiateConnection = () =>  {
    console.log('initiateConnection');
    pc.negotiateConnection();
  };

  // Adds a signal text to the copy box. Callback from pc.
  $scope.onLocalSignallingMessage = (signal:WebRtc.SignallingMessage) => {
    $scope.$apply(() => {
      console.log('onLocalSignallingMessage:' + JSON.stringify(signal));
      $scope.localInfo = $scope.localInfo.trim() + '\n' +
        JSON.stringify(signal);
    });
  };
  pc.signalForPeerQueue.setSyncHandler($scope.onLocalSignallingMessage);

  // Handles each line in the received 'paste' box which are messages from the
  // remote peer via the signalling channel.
  $scope.processRemoteSignallingMessages = () => {
    console.log('onRemoteSignallingMessages');
    var signal:WebRtc.SignallingMessage;
    var s:string
    var i:number;
    var signals = $scope.remoteInfo.split('\n');
    for (var i = 0; i < signals.length; i++) {
      s = signals[i].trim();
      if(s.length > 0) {
        try {
          signal = JSON.parse(s);
          console.log('handleSignalMessage: ' + signal);
          pc.handleSignalMessage(signal);
        } catch(e) {
          $scope.errors.push('Bad signal message: "' + s + '"' + e.toString());
        }
      }
    }
  }

  $scope.createDataChannel = (channelLabel:string) : void => {
    console.log('creating data channel');
    var dataChannel = pc.openDataChannel(channelLabel);
    $scope.addDataChannel(dataChannel)
  }

  $scope.closeDataChannel = (channelLabel:string) : void => {
    console.log('closing data channel');
    pc.dataChannels[channelLabel].close();
  }

  $scope.addMessage = (channelLabel:string, d:WebRtc.Data, who:string)
      : void => {
    if (typeof d.str === 'string') {
      $scope.channels[channelLabel].messages.push(who + ':' + d.str);
    } else if (typeof d.buffer === 'object' && d.buffer instanceof ArrayBuffer) {
      $scope.channels[channelLabel].messages.push(
          who + ':' + ArrayBuffers.arrayBufferToHexString(d.buffer));
    } else {
      console.error('addMessage: only supports str and buffer, got: ' +
          JSON.stringify(d));
    }
  }

  $scope.addDataChannel = (dataChannel:WebRtc.DataChannel) :void => {
    var channelLabel = dataChannel.getLabel();

    $scope.channels[channelLabel] = {
      label: channelLabel,
      state: dataChannel.getState(),
      messages: [],
      messageToSend: ''
    };

    dataChannel.dataFromPeerQueue.setSyncHandler((d:WebRtc.Data) => {
      $scope.$apply(() => { $scope.addMessage(channelLabel, d, 'other'); });
    });
    dataChannel.onceOpened.then(() => {
      $scope.$apply(() => {
        $scope.channels[channelLabel].state = dataChannel.getState();
      });
    });
    dataChannel.onceClosed.then(() => {
      $scope.$apply(() => {
        $scope.channels[channelLabel].state = dataChannel.getState();
      });
    });
  }

  $scope.send = (channelLabel:string, channelMessage:string) => {
    console.log('send: ' + channelLabel + ' : ' + JSON.stringify(channelMessage));
    pc.dataChannels[channelLabel].send({str: channelMessage})
      .catch((e) => {
        console.error('error in sending:'  + e);
      });
    $scope.addMessage(channelLabel, {str: channelMessage}, 'self');
  }
});

/* webrtcPcApp.controller('dataChannelPcController',
    ($scope :WebrtcPcControllerScope) => {

});
*/
