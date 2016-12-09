import { Server, ServerRepository } from '../model/server';

class ServerEntryComponent {
  private connectButton: HTMLButtonElement;
  private disconnectButton: HTMLButtonElement;

  constructor(private root: Element, private server: Server) {
    root.classList.add('server-entry-card');
    root.innerHTML = `
      <h2 id='server-name'></h2>
      <paper-button id='connect-button' raised>Connect</paper-button>
      <paper-button id='disconnect-button' raised disabled>Disconnect</paper-button>`;

    root.querySelector('#server-name').textContent = server.getIpAddress();
    this.connectButton = root.querySelector('#connect-button') as HTMLButtonElement;
    this.connectButton.addEventListener('tap', (ev) => {
      console.debug('Pressed Connect Button');
      this.pressStart();
    });

    this.disconnectButton = root.querySelector('#disconnect-button') as HTMLButtonElement;
    this.disconnectButton.addEventListener('tap', (ev) => {
      console.debug('Pressed Disconnect Button');
      this.pressStop();
    });
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
  private addTokenText: HTMLTextAreaElement;
  private addButton: HTMLButtonElement;
  private entryList: HTMLDivElement;

  // Servers currently shown, indexed by hostname.
  // Used to prevent listing servers more than once.
  private activeServerIds = new Set<String>();

  // Parameters:
  // - root: Where to attach the ServerListPage to
  // - servers: the repository of the servers we can connect to.
  constructor(private root: Element,
              private servers: ServerRepository) {
    this.addTokenText = root.querySelector('#token-text') as HTMLTextAreaElement;
    this.entryList = root.querySelector('#entry-list') as HTMLDivElement;

    this.addButton = root.querySelector('#add-server-button') as HTMLButtonElement;
    this.addButton.addEventListener('tap', (ev) => {
      console.debug('Pressed Add Button');
      this.pressAddServer();
    });

    servers.getServers().forEach((server) => {
      this.addServerCard(server);
    });
  }

  public enterAccessCode(code: string) {
    console.debug('Entered access code');
    this.addTokenText.value = code;
  }

  public pressAddServer(): ServerEntryComponent {
    console.debug(`Pressed Add Server with ${this.addTokenText.value}`);
    return this.addServerCard(this.servers.addServer(this.addTokenText.value));
  }

  private addServerCard(server: Server) {
    if (this.activeServerIds.has(server.getIpAddress())) {
      return;
    }

    this.activeServerIds.add(server.getIpAddress());
    const entryElement = this.root.ownerDocument.createElement('div');
    this.entryList.appendChild(entryElement);
    return new ServerEntryComponent(entryElement, server);
  }
}
