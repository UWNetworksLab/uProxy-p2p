export const STORAGE_VERSION = 1;

export enum MESSAGE_VERSIONS {
  PRE_BRIDGE = 1,
  BRIDGE = 2,
  CAESAR = 3,
  HOLOGRAPHIC_ICE = 4,
  // This has long since been replaced by Network#isEncrypted.
  // At the peerconnection layer, there is no difference between this
  // and HOLOGRAPHIC_ICE.
  ENCRYPTED_SIGNALS = 5,
  RC4 = 6
};

// TODO: make this RC4 once FF48 is released
export const MESSAGE_VERSION = MESSAGE_VERSIONS.ENCRYPTED_SIGNALS;

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
