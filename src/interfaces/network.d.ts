/// <reference path='persistent.d.ts' />

declare module Social {

  interface NetworkState {
    name     :string;
    remember :boolean;    // TODO: Remember what?
    userIds  :string[];
  }

  /**
   * Social.Network - represents a single network and the local uProxy client's
   * interaction as a user on the network.
   *
   * NOTE: All JSON stringify / parse happens automatically through the
   * network's communication methods. The rest of the code should deal purely
   * with the data objects.
   *
   * Furthermore, at the Social.Network level, all communications deal directly
   * with the clientIds. This is because instanceIds occur at the User level, as
   * the User manages the instance <--> client mappings (see 'user.ts').
   */
  interface Network extends Core.Persistent {
    name       :string;
    // TODO: Review visibility of these attributes and the interface.
    roster     :{[userId:string]:Core.User};
    // TODO: Make this private. Have other objects use getLocalInstance
    // instead.
    myInstance :Core.LocalInstance;

    /**
     * Logs in to the network. Updates the local client information, as
     * appropriate, and sends an update to the UI upon success. Does nothing if
     * already logged in.
     */
    login :(remember:boolean) => Promise<void>;

    /**
     * Does nothing if already logged out.
     */
    logout :() => Promise<void>;

    isOnline :() => boolean;

    /**
     * Returns true iff a login is pending (e.g. waiting on user's password).
     */
    isLoginPending :() => boolean;

    getLocalInstance :() => Core.LocalInstance;

    /**
     * Returns the User corresponding to |userId|.
     */
    getUser :(userId :string) => Core.User;

    /**
     * Notifies the UI about the existence & status of this network. Should be
     * called only upon logging in/out. Does not tell the UI about the roster.
     *
     * TODO: If this method should be called only upon logging in/out, why is
     * it a public method at all (vs. having login & logout call it
     * internally)? And why does code in other files call it directly?
     *
     * TODO: Consider removing this method and replacing it with a
     * general-purpose event-listener mechanism, through which any component
     * (not only the UI) can subscribe to change notifications.
     */
    //notifyUI :() => void;

    /**
     * Notifies a remote uProxy installation that we are also a uProxy
     * installation.
     *
     * Sends this network's instance handshake to a target clientId.
     * Assumes that clientId is ONLINE.
     *
     * NOTE: This is one of the few cases where we send a Message directly to a
     * |clientId| rather than |instanceId|. This is because there is not yet a
     * known instanceId, and also because this is internal to
     * Social.FreedomNetwork mechanics.
     *
     * TODO: Clarify terminology. "Handshake" implies participation and
     * agreement of two parties, but here "handshake" is something that can be
     * unilaterally sent.
     */
    sendInstanceHandshake :(clientId:string) => Promise<void>;

    /**
     * Oftentimes, network will receive client IDs belonging to remote
     * contacts known to be uProxy-enabled. This may happen prior to receiving
     * the local vcard, which is required for constructing the local Instance
     * Message. In this case, those instance messages must be queued.
     */
    flushQueuedInstanceMessages :() => void;

    /**
     * Sends a message to a remote client.
     *
     * Assumes that |clientId| is valid. Implementations of Social.Network do
     * not manually manage lists of clients or instances. (That is handled in
     * user.ts, which calls Network.send after doing the validation checks
     * itself.)
     *
     * Still, it is expected that if there is a problem, such as the clientId
     * being invalid / offline, the promise returned from the social provider
     * will reject.
     */
    send :(clientId:string, msg:uProxy.Message) => Promise<void>;
  }

}  // module Social
