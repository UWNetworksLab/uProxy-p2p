/*
 * background.ts is evaluated when the chrome app is loaded.
 */
/// <reference path='../../../third_party/typings/chrome/chrome-app.d.ts' />

// Do nothing when the user tries to launch the application.
chrome.app.runtime.onLaunched.addListener(() => {});
