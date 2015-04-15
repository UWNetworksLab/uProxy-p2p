class SocksToRtcMock { // TODO implements SocksToRtc.SocksToRtc {
  public events :{ [event :string] :(...args :Object[]) => void } = {};

  public resolveStart :(v :Object) => void;
  public rejectStart :(v :Object) => void;

  public start = () => {
    return new Promise<net.Endpoint>((resolve, reject) => {
      this.resolveStart = resolve;
      this.rejectStart = reject;
    });
  }

  public stop = () => {
  }

  public handleSignalFromPeer = () => {
  }

  public on = (name :string, fn) => {
    this.events[name] = fn;
  }
}
