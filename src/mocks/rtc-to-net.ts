import handler_queue = require('../../../third_party/uproxy-lib/handler/queue');

export class RtcToNetMock { // TODO implements rtc_to_net.RtcToNet {
  public signalsForPeer = new handler_queue.Queue<Object, void>();
  public bytesReceivedFromPeer = new handler_queue.Queue<number, void>();
  public bytesSentToPeer = new handler_queue.Queue<number, void>();

  public resolveReady :() => void;
  public rejectReady :(v :Object) => void;
  public resolveStopped :() => void;
  public rejectStopped :(v :Object) => void;

  public onceReady :Promise<void>;
  public onceStopped :Promise<void>;

  constructor() {
    this.onceReady = new Promise<void>((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
    });

    this.onceStopped = new Promise<void>((resolve, reject) => {
      this.resolveStopped = resolve;
      this.rejectStopped = reject;
    });

  }

  public start = () => {}

  public stop = () => {}

  public handleSignalFromPeer = () => {}

  public toString = () => {
  }
}
