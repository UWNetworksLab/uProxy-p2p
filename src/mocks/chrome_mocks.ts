/**
 * chrome_mocks.ts
 *
 * For jasmine tests in the Chrome Extension, mock out the interactions with the
 * chrome API.
 *
 * Because there are already a bunch of files which are common to the app and
 * extension, but only for chrome. (Like the Chrome Glue, and now the mocks...)
 */

// Mock out chrome.
module chrome.runtime {
  export function connect(connect) {
    console.log('Mock chrome.runtime.connect.');
  }
}

module chrome.runtime.onSuspend {
  export function addListener(listener) {
    console.log('Mock chrome.runtime.onSuspend.addListener.');
  }
}

module chrome.runtime.onInstalled {
  export function addListener(listener) {
    console.log('Mock chrome.runtime.onInstalled.addListener.');
  }
}

module chrome.browserAction {
  export function setPopup(url) {
    console.log('Mock chrome.browserAction.setPopup.');
  }
  export function setIcon(filename) {
    console.log('Mock chrome.browserAction.setIcon.');
  }
}

module chrome.browserAction.onClicked {
  export function addListener(listener) {
    console.log('Mock chrome.browserAction.onClicked.addListener.');
  }
}

module chrome.windows {
  export var WINDOW_ID_NONE = -1;
  export function create(options, callback) {
    console.log('Mock chrome.windows.create.')
  }
  export function update(windowId, options) {
    console.log('Mock chrome.windows.update.')
  }
  export function get(windowId, callback) {
    console.log('Mock chrome.windows.get.')
  }
  export function get(windowId, options, callback) {
    console.log('Mock chrome.windows.get.')
  }
}

module chrome.windows.onRemoved {
  export function addListener(listener) {
    console.log('Mock chrome.windows.onRemoved.addListener.')
  }
}

module chrome.extension {
  export function getURL(url) {
    console.log("Mock chrome.extension.getURL.");
  }
}

module chrome.proxy {
  export var ProxyConfig = null;
}

module chrome.proxy.settings {
  export function clear(options) {
    console.log('Mock chrome.proxy.settings.clear.');
  }
  export function get(options, callback) {
    console.log('Mock chrome.proxy.settings.get.');
  }
  export function set(options) {
    console.log('Mock chrome.proxy.settings.set.');
  }
}

module chrome.tabs {
  export function create(options) {
    console.log('Mock chrome.tabs.create.')
  }
  export function query(options, callback) {
    console.log('Mock chrome.tabs.query.')
  }
  export function update(tabId, options) {
    console.log('Mock chrome.tabs.update.')
  }
}

module chrome.webRequest.onBeforeRequest {
  export function addListener(listener) {
    console.log('Mock chrome.webRequest.onBeforeRequest.addListener.');
  }
}