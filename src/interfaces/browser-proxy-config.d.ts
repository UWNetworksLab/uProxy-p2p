interface IBrowserProxyConfig {
  startUsingProxy(endpoint:Net.Endpoint) : void;
  stopUsingProxy(askUser:boolean) : void;
}
