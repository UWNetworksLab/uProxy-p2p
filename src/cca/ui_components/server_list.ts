import { Server, ServerRepository } from '../model/server';

class ServerEntryComponent {
  private connectButton: HTMLButtonElement;
  private disconnectButton: HTMLButtonElement;

  constructor(private root: Element, private server: Server) {
    root.classList.add('server-entry');
    root.innerHTML = `
      <h2>${server.getIpAddress()}</h2>
      <button id='connect-button'>Connect</button>
      <button id='disconnect-button' disabled>Disconnect</button>`;

    this.connectButton = root.querySelector('#connect-button') as HTMLButtonElement;
    this.connectButton.onclick = (ev) => {
      console.debug('Pressed Connect Button');
      this.pressStart();
    };

    this.disconnectButton = root.querySelector('#disconnect-button') as HTMLButtonElement;
    this.disconnectButton.onclick = (ev) => {
      console.debug('Pressed Disconnect Button');
      this.pressStop();
    }
  }

  public pressStart() {
    if (!this.server) {
      throw new Error('No proxy set');
    }
    this.connectButton.disabled = true;
    return this.server.connect((msg) => {
      console.debug(`Server disconnected: ${msg}`);
    }).catch((error) => {
      console.error(error);
    }).then((port) => {
      this.disconnectButton.disabled = false;
    });
  }

  public pressStop() {
    if (!this.server) {
      throw new Error('No proxy set');
    }
    console.debug('Disconnecting server');
    this.server.disconnect().then(() => {
      this.connectButton.disabled = false;
      this.disconnectButton.disabled = true;
    }).catch(console.error);
  }
}

export class ServerListPage {
  private addWidget: HTMLDivElement;
  private addTokenText: HTMLTextAreaElement;
  private addButton: HTMLButtonElement;
  private entryList: HTMLDivElement;

  // Hostnames of servers currently displayed.
  // Used to prevent listing servers more than once.
  private activeServerIds: String[] = [];

  // Parameters:
  // - root: Where to attach the ServerListPage to
  // - servers: the repository of the servers we can connect to.
  constructor(private root: Element,
    private servers: ServerRepository) {
    this.addWidget = root.querySelector('#setup-widget') as HTMLDivElement;
    this.addTokenText = root.querySelector('#token-text') as HTMLTextAreaElement;
    this.entryList = root.querySelector('#entry-list') as HTMLDivElement;

    this.addButton = root.querySelector('#add-server-button') as HTMLButtonElement;
    this.addButton.onclick = (ev) => {
      console.debug('Pressed Add Button');
      this.pressAddServer();
    };

    servers.getSavedServers().then((restoredServers) => {
      restoredServers.forEach((server) => {
        this.addServer(server);
      });
    });
  }

  public enterAccessCode(code: string) {
    console.debug('Entered access code');
    this.addTokenText.value = code;
  }

  public pressAddServer(): Promise<ServerEntryComponent> {
    return this.servers.addServer(this.addTokenText.value).then((server) => {
      this.addServer(server);
    });
  }

  private addServer(server: Server) {
    if (this.activeServerIds.indexOf(server.getIpAddress()) > -1) {
      return;
    }
    this.activeServerIds.push(server.getIpAddress());

    const entryElement = this.root.ownerDocument.createElement('div');
    this.entryList.appendChild(entryElement);
    return new ServerEntryComponent(entryElement, server);
  }
}
