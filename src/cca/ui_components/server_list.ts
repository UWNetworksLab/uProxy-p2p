import { Server, ServerRepository } from '../model/server';
import { ServerCard } from './server_card';

// Cards will not be resized any shorter than this.
// This is a ballpark figure, chosen to be comfortably
// more than the combined height of the toolbar, button,
// and status. Really only relevant for testing since
// virtually no real Android device will be this short.
const MINIMUM_CARD_HEIGHT_PX = 300;

// Amount by which, when there are multiple cards, cards will
// be shorter than the available area. The idea is to allow
// the toolbar of the next card peek through:
//   gap between cards (12px) +
//   vertical padding (24px) +
//   toolbar font size (20px) +
//   1/2 vertical padding (12px) = 68px
const CARD_PEEKTHROUGH_PX = 68;

export class ServerListPage {
  // Server cards currently displayed, keyed by hostname.
  private cards = new Map<String, ServerCard>();

  // Parameters:
  // - root: Where to attach the ServerListPage to
  // - servers: the repository of the servers we can connect to.
  constructor(private root: Element, private servers: ServerRepository) {
    servers.getServers().then((restoredServers) => {
      restoredServers.forEach((server) => {
        this.addServerCard(server);
      });
    }, (e) => {
      console.error('could not load servers', e);
    });
  }

  // This should be called whenever the size of the root element
  // has changed. It will update the height of all the server cards.
  // TODO: This, once accepted into Chrome, would be a nice way
  //       to encapsulate the listener within this class:
  //       https://developers.google.com/web/updates/2016/10/resizeobserver
  public resizeCards() {
    let newHeight = this.root.clientHeight;
    if (this.cards.size > 1) {
      newHeight -= CARD_PEEKTHROUGH_PX;
    }
    newHeight = Math.max(MINIMUM_CARD_HEIGHT_PX, newHeight);

    this.cards.forEach(card => {
      card.setHeight(newHeight);
    });
  }

  public addServer(code: string) {
    return this.servers.addServer(code).then((server) => {
      this.addServerCard(server);
    });
  }

  private addServerCard(server: Server) {
    if (this.cards.has(server.getIpAddress())) {
      return;
    }

    const entryElement = this.root.ownerDocument.createElement('div');
    this.root.appendChild(entryElement);
    const card = new ServerCard(entryElement, server);
    this.cards.set(server.getIpAddress(), card);
    this.resizeCards();

    return card;
  }
}
