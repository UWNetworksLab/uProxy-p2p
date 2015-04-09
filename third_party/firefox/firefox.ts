export interface ContentScriptPort {
  emit(method :string, data ?:any);
  on(method :string, handler :Function);
}

declare var port :ContentScriptPort;
