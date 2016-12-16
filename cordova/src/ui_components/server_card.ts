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
  private onTap: () => Promise<void>;

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
    this.setState(State.DISCONNECTED);
    this.button.addEventListener('tap', (e) => {
      this.onTap();
    });
  }

  private setState(newState: State) {
    switch (this.state) {
      case State.CONNECTING:
        this.button.classList.remove('pulse');
        break;
      case State.CONNECTED:
        this.button.classList.remove('spin');
        break;
    }

    switch (newState) {
      case State.DISCONNECTED:
        this.status.textContent = 'Tap to connect';
        this.button.setAttribute('src', 'assets/button/disconnected.svg');
        this.button.disabled = false;
        this.onTap = this.connect;
        break;
      case State.CONNECTING:
        this.status.textContent = 'Connecting';
        this.button.setAttribute('src', 'assets/button/disconnected.svg');
        this.button.classList.add('pulse');
        this.button.disabled = true;
        break;
      case State.CONNECTED:
        this.status.textContent = 'Connected';
        this.button.setAttribute('src', 'assets/button/connected.svg');
        this.button.disabled = false;
        this.button.classList.add('spin');
        this.onTap = this.disconnect;
        break;
      case State.DISCONNECTING:
        this.status.textContent = 'Disconnecting...';
        this.button.setAttribute('src', 'assets/res/button/connected.svg');
        this.button.disabled = true;
        break;
      default:
        throw new Error('unknown state ' + newState);
    }
    console.info(State[this.state] + ' -> ' + State[newState]);
    this.state = newState;
  }

  private connect(): Promise<void> {
    this.setState(State.CONNECTING);
    return this.server.connect((msg) => {
      this.setState(State.DISCONNECTED);
    }).then((port) => {
      this.setState(State.CONNECTED);
    }, (e) => {
      this.setState(State.DISCONNECTED);
      console.warn('Failed to connect: ', e);
    });
  }

  private disconnect(): Promise<void> {
    this.setState(State.DISCONNECTING);
    return this.server.disconnect().then(() => {
      this.setState(State.DISCONNECTED);
    }, (e) => {
      console.warn('something weird happened while disconnecting', e);
      this.setState(State.DISCONNECTED);
    });
  }
}
