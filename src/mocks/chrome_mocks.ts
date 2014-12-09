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

module chrome.browserAction {

  export function setPopup(url) {
    console.log('Mock chrome.browserAction.setPopup.');
  }
  export function setIcon(filename) {
    console.log('Mock chrome.browserAction.setIcon.');
  }
}

/*
module chrome.windows {

  export function create(url) {
    console.log('Mock chrome.windows.create.');
  }
  export function remove(url) {
    console.log('Mock chrome.windows.remove.');
  }
  export function getLastFocused(url) {
    console.log('Mock chrome.windows.getLastFocused.');
  }
  export function onRemoved(url) {
    console.log('Mock chrome.windows.onRemoved.');
  }
}*/

