interface IBrowserProxyConfig {
  startUsingProxy(endpoint:Net.Endpoint) : void;
  stopUsingProxy() : void;
}
