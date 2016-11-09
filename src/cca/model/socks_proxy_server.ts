// A Socks proxy server that we can control. 
export interface SocksProxy {
  // Starts the Socks server.
  // Returns the number of the port for the server that was started.
  //
  // You can test it with
  // curl -v -x socks5h://localhost:52612 www.example.com
  start(): Promise<number>;

  // Stops the Socks server.
  stop(): Promise<void>;
}

