import { Server, ServerRepository } from '../model/server';

class ServerEntryComponent {
  private connectButton: HTMLButtonElement;
  private disconnectButton: HTMLButtonElement;

  constructor(private root: Element, private server: Server) {
    root.classList.add('server-card');
    root.innerHTML = `
      <div class='name'>${server.getIpAddress()}</div>
      <paper-button id='connect-button' raised>Connect</paper-button>
      <paper-button id='disconnect-button' raised disabled>Disconnect</paper-button>`;

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
  // Servers currently shown, indexed by hostname.
  // Used to prevent listing servers more than once.
  private activeServerIds = new Set<String>();

  // Parameters:
  // - root: Where to attach the ServerListPage to
  // - servers: the repository of the servers we can connect to.
  constructor(private root: Element,
              private servers: ServerRepository) {
    // for debugging!
    this.addServer({
      getIpAddress: () => {
        return '192.168.1.1';
      },
      connect: (onDisconnect: (msg: string) => void) => {
        return Promise.resolve();
      },
      disconnect: () => {
        return Promise.resolve();
      }
    });

    servers.getServers().then((restoredServers) => {
      restoredServers.forEach((server) => {
        this.addServer(server);
      });
    });
  }

  public addAccessCode(code:string): Promise<ServerEntryComponent> {
    return this.servers.addServer(code).then((server) => {
      this.addServer(server);
    });
  }

  private addServer(server: Server) {
    if (this.activeServerIds.has(server.getIpAddress())) {
      return;
    }

    this.activeServerIds.add(server.getIpAddress());
    const entryElement = this.root.ownerDocument.createElement('div');
    this.root.appendChild(entryElement);
    return new ServerEntryComponent(entryElement, server);
  }
}
