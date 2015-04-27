interface ContentScriptPort {
  emit(method :string, data ?:Object) :void;
  on(method :string, handler :Function) :void;
  once(method :string, handler :Function) :void;
  removeListener(method :string, handler :Function) :void;
}
