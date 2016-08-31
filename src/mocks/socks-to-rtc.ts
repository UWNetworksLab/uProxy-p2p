import handler = require('../lib/handler/queue');
import net = require('../lib/net/net.types');

export class SocksToRtcMock { // TODO implements SocksToRtc.SocksToRtc {
  public resolveStart :(v :Object) => void;
  public rejectStart :(v :Object) => void;

  public signalsForPeer = new handler.Queue<Object, void>();

  public bytesReceivedFromPeer = new handler.Queue<number, void>();
  public bytesSentToPeer = new handler.Queue<number, void>();

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

  // TODO: remove onceStopping_ when
  // https://github.com/uProxy/uproxy/issues/1264 is resolved.
  private onceStopping_ = new Promise(() => {});

  public onceStopped = new Promise(() => {});
}
