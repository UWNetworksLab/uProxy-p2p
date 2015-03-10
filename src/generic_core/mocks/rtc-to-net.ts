class MockSyncHandler<T> implements Handler.Queue<T,void> {
  public syncHandler :(data :T) => void;

  public setSyncHandler = (fn :(...data :Object[]) => void) => {
    this.syncHandler = fn;
  }

  public handle = (x :T) => {
    this.syncHandler(x);
    return Promise.resolve<void>();
  }

  public getLength = () => { return 0; }
  public isHandling = () => { return this.syncHandler !== null; }
  public clear = () => {}
  public setHandler = (handler) => {}
  public stopHandling = () => {}
  public setNextHandler = (handler) => { return Promise.resolve<void>(); }
  public setSyncNextHandler = (handle) => { return Promise.resolve<void>(); }
}

class RtcToNetMock { // TODO implements RtcToNet.RtcToNet {
  public signalsForPeer = new MockSyncHandler<WebRtc.SignallingMessage>();
  public bytesReceivedFromPeer = new MockSyncHandler<number>();
  public bytesSentToPeer = new MockSyncHandler<number>();

  public resolveReady :() => void;
  public rejectReady :(v :Object) => void;
  public resolveClosed :() => void;
  public rejectClosed :(v :Object) => void;

  public onceReady :Promise<void>;
  public onceClosed :Promise<void>;

  constructor() {
    this.onceReady = new Promise<void>((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
    });

    this.onceClosed = new Promise<void>((resolve, reject) => {
      this.resolveClosed = resolve;
      this.rejectClosed = reject;
    });

  }

  public start = () => {}

  public stop = () => {}

  public handleSignalFromPeer = () => {}

  public toString = () => {
  }
}
