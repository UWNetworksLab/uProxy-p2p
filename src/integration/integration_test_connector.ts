import * as browser_connector from '../interfaces/browser_connector';
import * as uproxy_core_api from '../interfaces/uproxy_core_api';

/**
 * Integration test connector.  This class is modeled after FirefoxConnector.
 * Rather than pass messages between different JS contexts, it simply calls
 * .on and .emit methods on the freedomModule_ given to its constructor.
 * This allows us to use a CoreConnector in our integration tests, rather than
 * just making .on and .emit calls.
 */
class IntegrationTestConnector implements browser_connector.CoreBrowserConnector {
  public status :browser_connector.StatusObject;
  public onceConnected :Promise<void>;

  constructor(private freedomModule_ :any) {
    this.status = { connected: true };
  }

  public connect = () :Promise<void> => {
    this.onceConnected = Promise.resolve();
    return Promise.resolve();
  }

  public onUpdate = (update :uproxy_core_api.Update, handler :Function) => {
    this.freedomModule_.on(update.toString(), handler);
  }

  public send = (payload :browser_connector.Payload,
                 skipQueue :Boolean = false) => {
    this.freedomModule_.emit(
        payload.type.toString(),
        {data: payload.data, promiseId: payload.promiseId});
  }

  public restart = () => {}

  private events_ :{[name :string] :Function} = {};

  public on = (name :string, callback :Function) => {
    this.events_[name] = callback;
  }

  private emit = (name :string, ...args :Object[]) => {
    if (name in this.events_) {
      this.events_[name].apply(null, args);
    }
  }
}  // class IntegrationTestConnector

export = IntegrationTestConnector;
