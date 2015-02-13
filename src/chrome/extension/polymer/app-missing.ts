/// <reference path='../../../interfaces/ui-polymer.d.ts' />
/// <reference path='../../../uproxy.ts' />

Polymer({
  downloadApp: function() {
    openDownloadAppPage();
  },
  ready: function() {
    splashIfAppNotMissing();
  }
});
