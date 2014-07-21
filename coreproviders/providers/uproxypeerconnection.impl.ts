class UproxyPeerConnection {
  constructor(
      private module_:any,
      private dispatchEvent_:any) {}

  public getName = (continuation:(name:string) => void) : void => {
    continuation('Mr. uProxyPeerConnection');
  }
}

declare var fdom:any;
fdom.apis.register('core.uproxypeerconnection', UproxyPeerConnection);
