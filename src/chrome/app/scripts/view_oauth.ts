/**
 * Hackety hack. Used by:
 *  - Google XMPP
 *  - Manual identity
 **/
/// <reference path='plumbing.ts'/>

declare var connector :ChromeUIConnector;

var View_oauth = function(app, dispatchEvent) {
  this.dispatchEvent = dispatchEvent;
  this.authMan = null;
  this.manualDialog = null;
  this.socialNetworkName = null;
  if (app.manifest.name == 'Google Social Provider') {
    this.socialNetworkName = 'Google';
  } else if (app.manifest.name == 'Facebook Social Provider') {
    this.socialNetworkName = 'Facebook';
  }
};

View_oauth.prototype.open = function(args, what, continuation) {
  // args and what are currently ignored, since they are always
  // ('XMPPLogin', {file: 'login.html'}) as set by freedom-social-xmpp's
  // socialprovider.js
  if (this.socialNetworkName == 'Google' ||
      this.socialNetworkName == 'Facebook') {
    connector.sendToUI(uProxy.Update.GET_CREDENTIALS, this.socialNetworkName);
    connector.setOnCredentials((results) => {
      this.dispatchEvent('message', results);
    });
  } else {
    console.warn(
        'Authentication view provider asked to serve unknown social network: ' +
        this.socialNetworkName);
  }
  continuation();
};

View_oauth.prototype.show = function(continuation) {
  continuation();
};

View_oauth.prototype.postMessage = function(args, continuation) {
  console.error("Unrecognized message to core.view: " + JSON.stringify(args));
  continuation();
};

View_oauth.prototype.close = function(continuation) {
  continuation();
};

/**
 *INTERNAL METHODS
 */
