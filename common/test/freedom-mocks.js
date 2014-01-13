// freedom-mocks.js
/* global console: false */
"use strict";

function MockStorage(init_store) {
  this._store = init_store;
}
MockStorage.prototype.get = function(key) {
  var v = this._store[key];
  //console.log("\nMockStorage.prototype.get(" + key + "): " + this._store[key]);
  return { done: function (callback) { if(callback) callback(v); } };
};
MockStorage.prototype.set = function(key, value) {
  this._store[key] = value;
  //console.log("\nMockStorage.prototype.set(" + key + "): " + this._store[key]);
  return { done: function (callback) { if(callback) callback(); } };
};
MockStorage.prototype.remove = function(key) {
  //console.log("\nMockStorage.prototype.remove(" + key + ").");
  delete this._store[key];
  return { done: function (callback) { if(callback) callback(); } };
};
MockStorage.prototype.clear = function() {
  this._store = {};
  //console.log("\nMockStorage.prototype.clear.");
  return { done: function (callback) { if(callback) callback(); } };
};

// --
function MockChannel() {}
MockChannel.prototype.on = function (eventTypeString, callback) {
  return null;
};
MockChannel.prototype.emit = function (eventTypeString, value) {
  return null;
};

var freedom = new MockChannel();
freedom.storage = function () { return new MockStorage({}); };

freedom.identity = function () { return new MockChannel(); };
freedom.uproxyclient = function () { return new MockChannel(); };
freedom.uproxyserver = function () { return new MockChannel(); };

var DEBUG = true;

var log = console;
