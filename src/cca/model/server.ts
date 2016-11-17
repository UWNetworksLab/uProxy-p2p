export interface Server {
  // The IP Address of this server
  getIpAddress(): string;

  // Connects to the server, redirecting the device's traffic.
  connect(onDisconnect: (msg: string) => void): Promise<void>

  // Disconnects from the server and stoips any traffic redirection.
  disconnect(): Promise<void>
}

export type AccessCode = string;

export interface ServerRepository {
  addServer(code: AccessCode): Promise<Server>
  // Fetch the list of servers from storage.
  getSavedServers(): Promise<Server[]>;
}
