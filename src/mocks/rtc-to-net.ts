import handler_queue = require('../../../third_party/uproxy-lib/handler/queue');
import signals = require('../../../third_party/uproxy-lib/webrtc/signals');

export class RtcToNetMock { // TODO implements rtc_to_net.RtcToNet {
  public signalsForPeer = new handler_queue.Queue<signals.Message, void>();
  public bytesReceivedFromPeer = new handler_queue.Queue<number, void>();
  public bytesSentToPeer = new handler_queue.Queue<number, void>();

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

  public startFromConfig = () => {}

  public onceStopped = new Promise(() => {});

}
