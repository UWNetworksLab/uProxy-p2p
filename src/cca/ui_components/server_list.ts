import { Server, ServerRepository } from '../model/server';
import { ServerCard } from './server_card';

export class ServerListPage {
  // Servers currently shown, indexed by hostname.
  // Used to prevent listing servers more than once.
  private activeServerIds = new Set<String>();

  // Parameters:
  // - root: Where to attach the ServerListPage to
  // - servers: the repository of the servers we can connect to.
  constructor(private root: Element,
              private servers: ServerRepository) {
    servers.getServers().then((restoredServers) => {
      restoredServers.forEach((server) => {
        this.addServer(server);
      });
    }, (e) => {
      console.error('could not load servers', e);
    });
  }

  public enterAccessCode(code: string) {
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
    return new ServerCard(entryElement, server);
  }
}
