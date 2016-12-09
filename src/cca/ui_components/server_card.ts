import { Server } from '../model/server';

enum State {
  DISCONNECTED,
  CONNECTING,
  CONNECTED,
  DISCONNECTING
}

// An entry in a ServerList.
export class ServerCard {
  private state = State.DISCONNECTED;

  private title: HTMLElement;
  private button: HTMLButtonElement;
  private status: HTMLElement;

  constructor(private root: HTMLElement, private server: Server) {
    root.classList.add('server-card');
    root.innerHTML = `
      <div class='toolbar'>
        <div class='paper-font-title'></div>
      </div>
      <div class='button'>
        <paper-icon-button class='connect-button'></paper-icon-button>
      </div>
      <div class='status paper-font-subhead'></div>`;

    this.title =  root.querySelector('.paper-font-title') as HTMLElement;
    this.button = root.querySelector('.connect-button') as HTMLButtonElement;
    this.status = root.querySelector('.status') as HTMLElement;

    this.title.textContent = server.getIpAddress();

    this.disconnected();

    this.button.addEventListener('tap', (e) => {
      this.press();
    });
  }

  private switchState(newState: State) {
    if (!(newState in State)) {
      throw new Error('unknown state ' + newState);
    }
    console.info(State[this.state] + ' -> ' + State[newState]);
    this.state = newState;
  }

  // TODO: Disable the button in every other card in the
  //       parent server list. 
  private connect() {
    if (this.state !== State.DISCONNECTED) {
      console.warn('can only connect while disconnected');
      return;
    }

    this.switchState(State.CONNECTING);
    this.status.textContent = 'Connecting...';

    return this.server.connect((msg) => {
      this.disconnected();
    }).then((port) => {
      this.switchState(State.CONNECTED);
      this.status.textContent = 'Connected';
      this.button.setAttribute('src', '../../assets/button/connected.svg');
    }, (e) => {
      this.disconnected(e.message);
    });
  }

  private disconnect() {
    if (this.state !== State.CONNECTED) {
      console.warn('can only disconnect while connected');
      return;
    }

    this.switchState(State.DISCONNECTING);
    this.status.textContent = 'Disconnecting...';
    this.button.setAttribute('src', '../../assets/button/disconnected.svg');

    return this.server.disconnect().then(() => {
      this.disconnected();
    }, (e) => {
      console.warn('something weird happened while disconnecting', e);
      this.disconnected();
    });
  }

  private disconnected(msg = 'Tap to connect') {
    this.switchState(State.DISCONNECTED);
    this.status.textContent = msg;
    this.button.setAttribute('src', '../../assets/button/disconnected.svg');
  }

  public press() {
    // TODO: cancellation!
    switch (this.state) {
      case State.DISCONNECTED:
        this.connect();
        break;
      case State.CONNECTING:
        console.warn('cannot cancel');
        break;
      case State.CONNECTED:
        this.disconnect();
        break;
      default:
        console.error('ignoring press while ' + State[this.state]);
    }
  }
}
