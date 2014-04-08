/**
 * chrome_mocks.ts
 *
 * For jasmine tests in the Chrome Extension, mock out the interactions with the
 * chrome API.
 *
 * TODO: Reorganize the Chrome directory so that it looks like:
 *  chrome/
 *    app/
 *    extension/
 *    common/
 *    ...
 * Because there are already a bunch of files which are common to the app and
 * extension, but only for chrome. (Like the Chrome Glue, and now the mocks...)
 */

// Mock out chrome.
module chrome.runtime {

  export function connect() {//  appId?, options?) {
    console.log('Mock chrome.runtime.connect.');
  }
}
