// Interface definition for cordova-plugin-ssh
interface SshPluginInterface {
  connect(host:string, port:number, username:string, privateKey:string, password:string) : Promise<void>
  startProxy(port: number): Promise<void>
  stopProxy(): Promise<void>
  disconnect(): Promise<void>
}

declare var cordova: {
  plugins: {
    SshPlugin: SshPluginInterface;
  }
}
