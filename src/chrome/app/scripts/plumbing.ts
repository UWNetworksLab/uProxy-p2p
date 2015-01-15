/**
 * plumbing.ts
 *
 * This file must be included *after* the freedom script and manifest are
 * loaded.
 */
/// <reference path='chrome_oauth.ts' />
/// <reference path='chrome_ui_connector.ts' />
/// <reference path='../../../uproxy.ts' />
/// <reference path='../../../freedom/typings/freedom.d.ts' />
/// <reference path='../../util/chrome_glue.ts' />
/// <reference path='../../../third_party/typings/chrome/chrome-app.d.ts'/>

// Remember which handlers freedom has installed.
var installedFreedomHooks = [];
var connector :ChromeUIConnector;
var uProxyAppChannel : OnAndEmit<any,any>;

var uproxyModule = new freedom('scripts/freedom-module.json', {
  oauth: [Chrome_oauth]
}).then(function(UProxy : () => void) {
  uProxyAppChannel = new UProxy();
  connector = new ChromeUIConnector();
  console.log('Starting uProxy app...');
});
