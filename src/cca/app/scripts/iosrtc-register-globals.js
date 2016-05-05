/*
  In order use WebRTC on iOS, you can call cordova.plugins.iosrtc.registerGlobals() after 'deviceready' fires.
  However, we need to set window.RTCPeerConnection, window.RTCSessionDescription, and window.RTCIceCandidate 
  before freedom-for-chrome.js loads so we do so in the background here. This script should only be loaded for ios.
*/

if (cordova && cordova.plugins && cordova.plugins.iosrtc) {
  window.RTCPeerConnection = cordova.plugins.iosrtc.RTCPeerConnection;
  window.RTCSessionDescription = cordova.plugins.iosrtc.RTCSessionDescription;
  window.RTCIceCandidate = cordova.plugins.iosrtc.RTCIceCandidate;
}
