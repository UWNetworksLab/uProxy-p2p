var RTCPeerConnection = null;
var getUserMedia = null;
var attachMediaStream = null;
var reattachMediaStream = null;
var webrtcDetectedBrowser = null;
var webrtcDetectedVersion = null;
var createIceServer = null;
var getPeerConnectionStats = null;

if (navigator.mozGetUserMedia) {
  console.log("This appears to be Firefox");

  webrtcDetectedBrowser = "firefox";

  webrtcDetectedVersion =
           parseInt(navigator.userAgent.match(/Firefox\/([0-9]+)\./)[1], 10);

  // The RTCPeerConnection object.
  RTCPeerConnection = mozRTCPeerConnection;

  // The RTCSessionDescription object.
  RTCSessionDescription = mozRTCSessionDescription;

  // The RTCIceCandidate object.
  RTCIceCandidate = mozRTCIceCandidate;

  // Get UserMedia (only difference is the prefix).
  // Code from Adam Barth.
  getUserMedia = navigator.mozGetUserMedia.bind(navigator);

  // Creates iceServer from the url for FF.
  createIceServer = function(url, username, password) {
    var iceServer = null;
    var url_parts = url.split(':');
    if (url_parts[0].indexOf('stun') === 0) {
      // Create iceServer with stun url.
      iceServer = { 'url': url };
    } else if (url_parts[0].indexOf('turn') === 0) {
      if (webrtcDetectedVersion < 27) {
        // Create iceServer with turn url.
        // Ignore the transport parameter from TURN url for FF version <=27.
        var turn_url_parts = url.split("?");
        // Return null for createIceServer if transport=tcp.
        if (turn_url_parts[1].indexOf('transport=udp') === 0) {
          iceServer = { 'url': turn_url_parts[0],
                        'credential': password,
                        'username': username };
        }
      } else {
        // FF 27 and above supports transport parameters in TURN url,
        // So passing in the full url to create iceServer.
        iceServer = { 'url': url,
                      'credential': password,
                      'username': username };
      }
    }
    return iceServer;
  };

  // Attach a media stream to an element.
  attachMediaStream = function(element, stream) {
    console.log("Attaching media stream");
    element.mozSrcObject = stream;
    element.play();
  };

  reattachMediaStream = function(to, from) {
    console.log("Reattaching media stream");
    to.mozSrcObject = from.mozSrcObject;
    to.play();
  };

  // Fake get{Video,Audio}Tracks
  if (!MediaStream.prototype.getVideoTracks) {
    MediaStream.prototype.getVideoTracks = function() {
      return [];
    };
  }

  if (!MediaStream.prototype.getAudioTracks) {
    MediaStream.prototype.getAudioTracks = function() {
      return [];
    };
  }
  getPeerConnectionStats = function(pc) {
    return new Promise(function(F, R) {
      function tryGetStats() {
        pc.getStats(null,
          function(report) {
            var result = {};
            for(key in report) {
              res = report[key];
              if (res.type === 'candidatepair' && res.selected) {
                var localCandidate = report[res.localCandidateId];
                result.local = {
                  address: localCandidate.ipAddress,
                  port: localCandidate.portNumber
                };
                result.localType = localCandidate.candidateType;
                var remoteCandidate = report[res.remoteCandidateId];
                result.remote = {
                  address: remoteCandidate.ipAddress,
                  port: remoteCandidate.portNumber
                };
                result.remoteType = remoteCandidate.candidateType;
                F(result);
                return;
              }
            }
            window.setTimeout(tryGetStats, 200);
          }, R);
      }
      tryGetStats();
    });
  }
} else if (navigator.webkitGetUserMedia) {
  console.log("This appears to be Chrome");

  webrtcDetectedBrowser = "chrome";
  webrtcDetectedVersion =
         parseInt(navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./)[2], 10);

  // Creates iceServer from the url for Chrome.
  createIceServer = function(url, username, password) {
    var iceServer = null;
    var url_parts = url.split(':');
    if (url_parts[0].indexOf('stun') === 0) {
      // Create iceServer with stun url.
      iceServer = { 'url': url };
    } else if (url_parts[0].indexOf('turn') === 0) {
      // Chrome M28 & above uses below TURN format.
      iceServer = { 'url': url,
                    'credential': password,
                    'username': username };
    }
    return iceServer;
  };

  // The RTCPeerConnection object.
  RTCPeerConnection = webkitRTCPeerConnection;

  // Get UserMedia (only difference is the prefix).
  // Code from Adam Barth.
  getUserMedia = navigator.webkitGetUserMedia.bind(navigator);

  // Attach a media stream to an element.
  attachMediaStream = function(element, stream) {
    if (typeof element.srcObject !== 'undefined') {
      element.srcObject = stream;
    } else if (typeof element.mozSrcObject !== 'undefined') {
      element.mozSrcObject = stream;
    } else if (typeof element.src !== 'undefined') {
      element.src = URL.createObjectURL(stream);
    } else {
      console.log('Error attaching stream to element.');
    }
  };

  reattachMediaStream = function(to, from) {
    to.src = from.src;
  };

  getPeerConnectionStats = function(pc) {
    return new Promise(function(F, R) {
      function tryGetStats() {
        pc.getStats(
          // Success.
          // TODO: when Chrome meets the spec, update to match.
          function(report) {
            var results = report.result();
            for (var i = 0; i < results.length; i++) {
              var result = results[i];
              // Search for the endpoints in use.
              // There's a bug in Chrome whereby RTCPeerConnection.getStats(),
              // when that RTCPeerConnection is configured to use a TURN server,
              // reports multiple channels, *some of which have the non-relay
              // candidates and are reported as active*. Fortunately, the report
              // quickly fixes itself and a workaround seems to be to wait until
              // some bytes are sent over the channel -- fortunately, again,
              // this happens automatically as part of keeping the channel alive.
              //
              // Tracking here:
              //   https://code.google.com/p/webrtc/issues/detail?id=3665
              //
              // Note that the inactive/failed channel remains visible at
              // chrome://webrtc-internals/.
              if (result.stat('googActiveConnection') === 'true' &&
                  parseInt(result.stat('bytesSent')) > 0) {
                var localFields = result.stat('googLocalAddress').split(':');
                var remoteFields = result.stat('googRemoteAddress').split(':');
                F({
                    local: {
                      address: localFields[0],
                      port: parseInt(localFields[1])
                    },
                    remote: {
                      address: remoteFields[0],
                      port: parseInt(remoteFields[1])
                    },
                    localType: result.stat('googLocalCandidateType'),
                    remoteType: result.stat('googRemoteCandidateType')
                  });
                return;
              }
            }
            // Get stats doesn't reliably work, so we have to pull it
            // TODO: bug request?
            window.setTimeout(tryGetStats, 200);
          }, R);
      }
      tryGetStats();
    });
  }
} else {
  console.log("Browser does not appear to be WebRTC-capable");
}
