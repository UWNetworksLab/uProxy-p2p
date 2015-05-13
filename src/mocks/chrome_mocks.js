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
var chrome = {
  runtime:  {
    connect: function(connect) {
      console.log('Mock chrome.runtime.connect.');
    },
    onInstalled: {
      addListener: function() {}
    },
    onSuspend: {
      addListener: function() {}
    },
    onMessage: {
      addListener: function() {}
    },
    onMessageExternal: {
      addListener: function() {}
    }
  },

  browserAction: {
    onClicked: {
      addListener: function() {}
    },
    setIcon: function() {}
  },
  windows: {
    onRemoved: {
      addListener: function() {}
    },
    WINDOW_ID_NONE: 0
  },
  proxy: {
    settings: {
      clear: function() {}
    }
  }
}
