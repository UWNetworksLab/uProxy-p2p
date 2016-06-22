/// <reference path='../../../third_party/typings/browser.d.ts' />

export const STORAGE_VERSION = 1;

// 1: initial release
// 2: introduce BridgingPeerConnection (no obfuscation)
// 3: caesar obfuscation
// 4: holographic ICE
// 5: encrypted signalling messages (long since replaced by Network#isEncrypted)
// 6: RC4 obfuscation
export const MESSAGE_VERSION = 6;

export const DEFAULT_STUN_SERVERS = [
  {urls: ['stun:stun.l.google.com:19302']},
  {urls: ['stun:stun.services.mozilla.com']},
  {urls: ['stun:stun.stunprotocol.org']}
];

export const DEFAULT_PROXY_BYPASS = [
  '10.0.0.0/8',
  '172.16.0.0/12',
  '192.168.0.0/16',
];
