// tcp-socket.ts
// from freedom/interface/core.js

// TODO: persuade freedom to use real enums.
// Note: Freedom only uses the string values. Don't use the int value.
// TODO: double-check and merge with Firefox usage.
module freedom_TcpSocket_Constants {
  enum onDisconnect {
    // close was called.
    SUCCESS,
    // Remote end of the TCP connection closed.
    CONNECTION_CLOSED,
    // Some other unkown reason.
    UNKOWN
  }

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
      // the socket trying to be secured is not yet connected.
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
