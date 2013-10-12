// freedom-mocks.js
"use strict";

function MockStorage(init_store) {
  this._store = init_store;
}
MockStorage.prototype.get = function(key) {
  var v = this._store[key];
  return { done: function (callback) { callback(v); } };
};
MockStorage.prototype.set = function(key, value) {
  this._store[key] = value;
  return { done: function (callback) { callback(); } };
};
MockStorage.prototype.remove = function(key) {
  delete this._store[key];
  return { done: function (callback) { callback(); } };
};
MockStorage.prototype.clear = function() {
  this._store = {};
  return { done: function (callback) { callback(); } };
};

var storage = new MockStorage();
