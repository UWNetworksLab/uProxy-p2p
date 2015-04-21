import net = require('../../../third_party/uproxy-networking/net/net.types');

export class SocksToRtcMock { // TODO implements SocksToRtc.SocksToRtc {
  public events :{ [event :string] :(...args :Object[]) => void } = {};

  public resolveStart :(v :Object) => void;
  public rejectStart :(v :Object) => void;

  public start = () => {
  }

  public stop = () => {
  }

  public handleSignalFromPeer = () => {
  }

  public on = (name :string, fn :(...args :Object[]) => void) => {
    this.events[name] = fn;
  }

  public startFromConfig = () => {
    return new Promise<net.Endpoint>((resolve, reject) => {
      this.resolveStart = resolve;
      this.rejectStart = reject;
    });
  }

  // TODO: remove onceStopping_ when
  // https://github.com/uProxy/uproxy/issues/1264 is resolved.
  private onceStopping_ = new Promise(() => {});

  public onceStopped = new Promise(() => {});
}
