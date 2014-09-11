/*
 * background.ts is evaluated when the chrome app is loaded.
 */
/// <reference path='../../../third_party/typings/chrome/chrome-app.d.ts' />

// We use the launch window for debugging.
// TODO: Have a version of the UI here also.
function launchDebugWindow(launchData) {
  chrome.app.window.create('debug.html', {
    id: 'uproxy',
    minWidth: 640,
    minHeight: 480
  });
}
chrome.app.runtime.onLaunched.addListener(launchDebugWindow);
