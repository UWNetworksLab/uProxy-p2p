import { Server, ServerRepository } from '../model/server';
import { ServerCard } from './server_card';

export class ServerList {
  // Servers currently shown.
  private serverCards: ServerCard[] = [];

  // Parameters:
  // - root: Where to attach the ServerListPage to
  // - servers: the repository of the servers we can connect to.
  constructor(private root: Element, private servers: ServerRepository) {
    servers.getServers().then((restoredServers) => {
      restoredServers.forEach((server) => {
        this.addServer(server);
      });
    }, (e) => {
      console.error('could not load servers', e);
    });
  }

  // https://developers.google.com/web/updates/2016/10/resizeobserver
  public resizeCards() {
    console.info('resizing server cards');
    // TODO: minimum height!
    const newCardHeight = this.root.clientHeight - (this.serverCards.length > 1 ? 30 : 0);
    this.serverCards.forEach(card => {
      card.setHeight(newCardHeight);
    });
  }

  public addByAccessCode(code: string) {
    return this.servers.addServerByAccessCode(code).then((server) => {
      this.addServer(server);
    });
  }

  private addServer(server: Server) {
    const entryElement = this.root.ownerDocument.createElement('div');
    this.root.appendChild(entryElement);
    const sec = new ServerCard(entryElement, server);
    this.serverCards.push(sec);
    // TODO: too easy?
    this.resizeCards();
    return sec;
  }
}
