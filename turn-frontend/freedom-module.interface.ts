import net = require('../net/net.types');

export interface IpcEventMessage {
  data: ArrayBuffer
}

export interface freedom_TurnFrontend {
  bind(address :string, port :number) : Promise<net.Endpoint>;

  handleIpc(data :ArrayBuffer) : Promise<void>;

  on(t:'ipc', f:(message:IpcEventMessage) => void) : void;
  on(t:string, f:Function) : void;
}
