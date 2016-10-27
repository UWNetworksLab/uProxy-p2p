import * as net from '../../../lib/net/net.types';

// A Socks proxy server that we can control. 
export interface SocksProxyServer {
  // Starts the Socks server.
  // Returns the Endpoint for the server that was started.
  //
  // You can test it with
  // curl -v -x socks5h://localhost:52612 www.example.com
  start(): Promise<net.Endpoint>;

  // Stops the Socks server.
  stop(): Promise<void>;
}

interface SocksProxyServerRepository {
  addProvider(inviteUrl: string): Promise<SocksProxyServer>;
}
