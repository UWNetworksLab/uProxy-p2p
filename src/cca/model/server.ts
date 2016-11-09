export interface Server {
  connect(onDisconnect: (msg: string) => void): Promise<void>
  disconnect(): Promise<void>
}

export type AccessCode = string;

export interface ServerRepository {
  addServer(code: AccessCode): Promise<Server>
}
