// Additions and adjustments for working with RTCPeerConnection in Chrome.
// Tested with Chrome 36.

// The type supplied to RTCPeerConnection.getStats() callbacks.
// We can't easily override the return type defined in tsd, so note
// that this is actually called RTCStatsResponse in Chrome:
//   https://code.google.com/p/chromium/codesearch#chromium/src/third_party/WebKit/Source/modules/mediastream/RTCStatsResponse.h
interface RTCStatsReport {
  result: () => RTCStats[];
}

// This is actually called, somewhat confusingly, RTCStatsReport in Chrome:
//   https://code.google.com/p/chromium/codesearch#chromium/src/third_party/WebKit/Source/modules/mediastream/RTCStatsReport.h
// Since the tsd already defines a type named RTCStatsReport, we define a
// whole new type here.
interface RTCStats {
  timestamp: Object; // TODO: find/define the type for DOMHiResTimeStamp
  type: string; // RTCStatsType;
  id: string;
  stat?: (s:string) => string;
  names: () => string[];
}

interface RTCPeerConnection {
  // tsd omits the callbacks.
  addIceCandidate(candidate: RTCIceCandidate,
                  successCallback?: RTCVoidCallback,
                  failureCallback?: RTCPeerConnectionErrorCallback) : void;
}
