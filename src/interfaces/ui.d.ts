/// <reference path='notify.d.ts' />
/// <reference path='core.d.ts' />

  // export interface IUI {
interface IUI {

  // constructor(
      // notifier :INotifications,
      // core:Interfaces.ICore);

  // new(
      // notifier:INotifications,
      // core:Interfaces.ICore):IUI;

  // Global sync of all state.
  sync(state? : string) : void;

  // Update an instance.
  syncInstance(instance : any) : void;
  updateMappings() : void;

  updateIdentity(identity) : void;
  sendConsent() : void;
  addNotification() : void;
}

interface CUI {
  new(n:INotifications, c:Interfaces.ICore):IUI;
}

// declare class UI implements IUI {
  // constructor(n:INotifications, c:Interfaces.ICore);
  // sync();
// }


  // export class UI implements IUI {
    // :void;
    // public notify: INotifications;
    // public networks: string[];
    // public notifications: number;
    // public accessView: boolean;
    // public splashPage: boolean;
    // public advancedOptions: boolean;
    // public searchBar: boolean;
    // public search: string;
    // public chatView: boolean;
    // public numClients: number;
    // public myName: string;
    // public myPic;
    // public pendingProxyTrustChange: boolean;
    // public pendingClientTrustChange: boolean;
    // public isProxying: boolean;
    // public accessIds: number;
    // constructor(notifier);
    // public contact;
    // public contactUnwatch;
    // public instance;
    // public instanceUnwatch;
    // public proxy;
    // public oldDescription: string;
    // public filters: {
        // 'online': boolean;
        // 'myAccess': boolean;
        // 'friendsAccess': boolean;
        // 'uproxy': boolean;
    // };
    // public refreshDOM(): void;
    // public setProxying(isProxying: boolean): void;
    // public setClients(numClients): void;
    // public toggleFilter(filter): boolean;
    // public contactIsFiltered(c): boolean;
    // public focusOnContact(contact): void;
    // public returnToRoster(): void;
    // public setNotifications(n): void;
    // public decNotifications(): void;
    // public notificationSeen(user): void;
    // public syncMe(): void;
    // public syncUser(user): void;
    // public synchronize(previousPatch?: any): boolean;
  // }
