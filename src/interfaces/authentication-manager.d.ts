/**
 * authentication-manager.d.ts
 *
 * Interface for AuthenticationManager, providing login and logout methods.
 * This interface is intended to be implemented for each social network.
 */


interface AuthenticationManager {
  login  :(interactive :boolean)=>void;
  logout :()=>Promise<void>;
  // TODO: credentials may need to change format for each XMPP network.
  credentialsCallback :(credentials :GoogleTalkCredentials)=>void;
  errorCallback :(errorText :string)=>void;
}

interface GoogleTalkCredentials {
  userId :string;
  jid :string;
  oauth2_token :string;
  oauth2_auth :string;
  host :string;
}