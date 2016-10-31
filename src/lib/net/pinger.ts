import * as logging from '../logging/logging';
import * as promises from '../promises/promises';

declare const freedom: freedom.FreedomInModuleEnv;

var log: logging.Log = new logging.Log('pinger');

const DEFAULT_TIMEOUT_SECS = 60;
const DEFAULT_INTERVAL_MS = 1000;

// "Pings" - in an nmap sense - a port until a TCP connection can be established.
export default class Pinger {
  constructor(
    private host_: string,
    private port_: number,
    private timeout_= DEFAULT_TIMEOUT_SECS) { }

  // Resolves once a connection has been established, rejecting if
  // no connection can be made within the timeout.
  public ping = (): Promise<void> => {
    log.debug('pinging %1:%2...', this.host_ , this.port_);

    return promises.retry(this.pingOnce.bind(this),
        this.timeout_, DEFAULT_INTERVAL_MS);
  }

  public pingOnce = () : Promise<void> => {
    const socket = freedom['core.tcpsocket']();

    const destructor = () => {
      try {
        freedom['core.tcpsocket'].close(socket);
      } catch (e) {
        log.warn('error destroying socket: ' + e.message);
      }
    };

    // TODO: Worth thinking about timeouts here but because this times
    //       out almost immediately if nothing is listening on the port,
    //       it works well for our purposes.
    return socket.connect(this.host_, this.port_).then((unused: any) => {
      log.debug('connected to ' + this.host_ + ':' + this.port_ + '...');
      destructor();
    }, (e: Error) => {
      log.debug('connection failed to ' + this.host_ + ':' + this.port_ + '...');
      destructor();
      throw e;
    });
  }
}
