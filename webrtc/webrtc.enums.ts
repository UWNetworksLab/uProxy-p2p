
// This enum describes a simple signal message protocol for establishing
// P2P connections.
// TODO: rename to more accurately describe the intended abstraction.
export enum SignalType {
  OFFER,              // INIT new connection
  ANSWER,             // ACK of new connection
  CANDIDATE,          // signal data to send to peer
  NO_MORE_CANDIDATES  // no more data to send to peer
}

// Describes the state of a P2P connection.
export enum State {
  WAITING,      // Can move to CONNECTING.
  CONNECTING,   // Can move to CONNECTED or DISCONNECTED.
  CONNECTED,    // Can move to DISCONNECTED.
  DISCONNECTED  // End-state, cannot change.
}
