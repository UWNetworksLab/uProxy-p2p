if (typeof org === 'undefined') var org = {};
if (!org.uproxy) org.uproxy = {};

(function setupCoreStorage(scope){

  var Storage_firefox = function() {
    var indexedDB = window.indexedDB || window.mozIndexedDB;
    var request = indexedDB.open("freedom_storage");
    // We queue calls until this.db is ready (ie no longer undefined).
    this.queue = [];

    var storage = this;
    request.onsuccess = function() {
      storage.db = this.result;
      while (storage.queue.length > 1) {
        storage.queue.shift().call();
      }
    };
    

    request.onerror = function(event) {
      console.error(event);
    };
    request.onupgradeneeded = function(event) {
      var db = event.target.result;
      var objectStore = db.createObjectStore("kv_storage", {keyPath: "key"});
    };
  };

  Storage_firefox.prototype.get = function(key, continuation) {
    if (typeof this.db === "undefined") {
      // The db is not ready. We push a thunk onto the queue.
      this.queue.push(function(){
        this.get(key, continuation);
      }.bind(this));
      return;
    }
    var transaction = this.db.transaction(["kv_storage"]);
    var objectStore = transaction.objectStore("kv_storage");
    var request = objectStore.get(key);
    request.onerror = function getError(event) {
      debugger;
      console.error(event);
      continuation(undefined);
    };
    request.onsuccess = function getSuccess(event) {
      if(request.result) {
        continuation(request.result.value);
      } else {
        debugger;
        continuation(undefined);
      }
    };
  };

  Storage_firefox.prototype.set = function(key, value, continuation) {
    if (typeof this.db === "undefined") {
      // The db is not ready. We push a thunk onto the queue.
      this.queue.push(function(){
        this.set(key, value, continuation);
      }.bind(this));
      return;
    }
    var transaction = this.db.transaction(["kv_storage"], "readwrite");
    var objectStore = transaction.objectStore("kv_storage");
    var getRequest = objectStore.get(key);
    // We get first to know if we need to do a put or an add.
    getRequest.onsuccess = function getToSetSuccess(event) {
      var request;
      if (getRequest.result){
        request = objectStore.put({key: key, value: value});
      } else {
        request = objectStore.add({key: key, value: value});
      }
      request.onerror = function(event) {
        console.error(event.target.error);
        continuation();
      };
      request.onsuccess = function(event) {
        continuation();
      };
    };
  };

  Storage_firefox.prototype.remove = function(key, continuation) {
    if (typeof this.db === "undefined") {
      // The db is not ready. We push a thunk onto the queue.
      this.queue.push(function(){
        this.remove(key, continuation);
      }.bind(this));
      return;
    }

    var transaction = this.db.transaction(["kv_storage"], "readwrite");
    var objectStore = transaction.objectStore("kv_storage");
    var request = objectStore.delete(key);
    request.onsuccess = function() {continuation();};
    request.onerror = function() {continuation();};
  };

  Storage_firefox.prototype.clear = function(continuation) {
    if (typeof this.db === "undefined") {
      // The db is not ready. We push a thunk onto the queue.
      this.queue.push(function(){
        this.clear(continuation);
      }.bind(this));
      return;
    }

    var transaction = this.db.transaction(["kv_storage"], "readwrite");
    var objectStore = transaction.objectStore("kv_storage");
    var request = objectStore.clear();
    request.onsuccess = function() {continuation();};
    request.onerror = function() {continuation();};
  };

  scope.Storage_firefox = Storage_firefox;
})(org.uproxy);
