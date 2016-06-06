export interface ReceivedDataEvent {
  connectionId: string;
  response: ArrayBuffer;
}

export interface ProxyIntegrationTester {
  startEchoServer() :Promise<number>;
  // Returns a unique identifier for the connection (the connectionId).
  connect(port:number, address?:string) :Promise<string>;
  // Sets the number of concatenated copies of the input to echo.  (default: 1)
  setRepeat(repeat:number) :Promise<void>;
  echo(connectionId:string, content:ArrayBuffer) :Promise<ArrayBuffer>;
  echoMultiple(connectionId:string, contents:ArrayBuffer[]) :Promise<ArrayBuffer[]>;
  sendData(connectionId:string, content:ArrayBuffer) :Promise<void>;
  on(name:'receivedData', listener:(event:ReceivedDataEvent) => void) :void;
  on(name:string, listener:(event:Object) => void) :void;
  closeEchoConnections() : Promise<void>;
  shutdown() : Promise<void>;
}
