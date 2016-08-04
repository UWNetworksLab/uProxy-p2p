
// Interface definition for cordova-plugin-tun2socks
interface Tun2Socks {
  start(socksServerAddress:string) : Promise<string>;
  stop(): Promise<string>;
  onDisconnect(): Promise<string>;
}

interface Window {
  tun2socks: Tun2Socks;
}
