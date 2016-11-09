import { Server, ServerRepository } from '../model/server';

export class ServerListPage {
  private selectedServerPromise: Promise<Server> = null;

  private addWidget: HTMLDivElement;
  private addTokenText: HTMLTextAreaElement;
  private addButton: HTMLButtonElement;
  private connectButton: HTMLButtonElement;
  private disconnectButton: HTMLButtonElement;
  private startVpnButton: HTMLButtonElement;
  private stopVpnButton: HTMLButtonElement;

  // Parameters:
  // - root: Where to attach the ServerListPage to
  // - servers: the repository of the servers we can connect to.
  constructor(private root: Element,
              private servers: ServerRepository) {
    this.addWidget = root.querySelector('#setup-widget') as HTMLDivElement;
    this.addTokenText = root.querySelector('#token-text') as HTMLTextAreaElement;

    this.addButton = root.querySelector('#set-proxy-button') as HTMLButtonElement;
    this.addButton.onclick = (ev) => {
      console.debug('Pressed Add Button');
      this.pressAddServer();
    };

    this.connectButton = root.querySelector('#connect-button') as HTMLButtonElement;
    this.connectButton.onclick = (ev) => {
      console.debug('Pressed Connect Button');
      this.pressStart();
    };

    this.disconnectButton = root.querySelector('#disconnect-button') as HTMLButtonElement;
    this.disconnectButton.onclick = (ev) => {
      console.debug('Pressed Disconnect Button');
      this.pressStop();
    };
  }

  public enterAccessCode(code: string) {
    console.debug('Entered access code');
    this.addTokenText.value = code;
  }

  public pressAddServer() {
    this.selectedServerPromise = this.servers.addServer(this.addTokenText.value);
    this.selectedServerPromise.then((server) => {
      this.connectButton.disabled = false;
    }).catch((error) => {
      console.error(error);
    });
  }

  public pressStart() {
    if (!this.selectedServerPromise) {
      throw new Error('No proxy set');
    }
    this.selectedServerPromise.then((server) => {
      this.connectButton.disabled = true;
      return server.connect((msg) => {
        console.debug(`Server disconnected: ${msg}`);
      });
    }).catch((error) => {
      console.error(error);
    }).then((port) => {
      this.disconnectButton.disabled = false;
    });
  }

  public pressStop() {
    if (!this.selectedServerPromise) {
      throw new Error('No proxy set');
    }
    this.selectedServerPromise.then((server) => {
      console.debug('Proxy stopped');
      return server.disconnect();
    }).then(() => {
      this.connectButton.disabled = false;
      this.disconnectButton.disabled = true;
    }).catch(console.error);
  }
}
