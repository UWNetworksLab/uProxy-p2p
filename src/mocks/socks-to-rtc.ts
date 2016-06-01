import net = require('../lib/net/net.types');

export class SocksToRtcMock { // TODO implements SocksToRtc.SocksToRtc {
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

  public on = (name :string, fn :(...args :Object[]) => void) => {
    this.events[name] = fn;
  }

  // TODO: remove onceStopping_ when
  // https://github.com/uProxy/uproxy/issues/1264 is resolved.
  private onceStopping_ = new Promise(() => {});

  public onceStopped = new Promise(() => {});
}
