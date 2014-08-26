// This file provides some constants to help document and provide type-checking
// for the freedoms tcp sockets (the freedom interface defined in:
// freedom/interface/core.js).

// Note: Freedom only uses the string values. Don't use the number value from
// these enums.

// TODO: persuade freedom to use real enums.
// TODO: double-check and merge with Firefox usage.
module freedom_TcpSocket_Constants {
  enum onDisconnect {
    // close was called.
    SUCCESS,
    // Remote end of the TCP connection closed.
    CONNECTION_CLOSED,
    // Some other unknown reason.
    UNKNOWN
  }

  // Error codes for calls to tcp socket methods. The enum is named after the
  // tcp socket method being called.
  module ErrorCode {

    enum Connect {
      // The socket is already connected.
      ALREADY_CONNECTED,
      // Something else went wrong.
      CONNECTION_FAILED
    }

    enum Secure {
      // The socket trying to be secured is not yet connected.
      NOT_CONNECTED,
      // Something else went wrong.
      CONNECTION_FAILED
    }

    enum Write {
      // The socket trying to be written to is not yet connected.
      NOT_CONNECTED,
      // CONNECTION_RESET is inferred from: bytes sent !== data length.
      CONNECTION_RESET,
      // Some internal error code.
      UNKNOWN
    }

    enum Listen {
      // Socket is already connected.
      ALREADY_CONNECTED,
      // The accept loop fails for some reason.
      CONNECTION_FAILURE
    }

    enum Close {
      // Socket is already closed.
      SOCKET_CLOSED
    }
  }
}
