
declare module Social {

  interface NetworkState {
    name     :string;
    profile :UI.UserProfileMessage;
    roster : {[userId :string] : UI.UserMessage};
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
  interface Network {
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

    getStorePath :() => string;

    /**
     * Does nothing if already logged out.
     */
    logout :() => Promise<void>;

    /**
     * Returns true iff a login is pending (e.g. waiting on user's password).
     */
    getLocalInstanceId :() => string;

    /**
     * Returns the User corresponding to |userId|.
     */
    getUser :(userId :string) => Core.User;

    /**
      * Resends the instance handeshake to all uProxy instances.
      */
    resendInstanceHandshakes :() => void;

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
    send :(user :Core.User, clientId:string, msg:uProxy.Message)
        => Promise<void>;

    getNetworkState : () => NetworkState;
  }

}  // module Social
