// Chrome-specific dependencies.
'use strict';

angular.module('dependencyInjector', [])
  .filter('i18n', function () {
    var getMessage = chrome.i18n.getMessage;
    return function (key) {
      return getMessage(key);
    };
  })
  .constant('freedom', chrome.extension.getBackgroundPage().freedom)
  .constant('onFreedomStateChange', chrome.extension.getBackgroundPage().onFreedomStateChange)
  // Singleton model lives in chrome extension's background page.
  .constant('model', chrome.extension.getBackgroundPage().model);


var initialProxySettings = null;

function saveProxySettings () {
  chrome.proxy.settings.get({incognito:false},
    function(details) { initialProxySettings = details.value; } );
}

saveProxySettings();

// TODO: take options.
// TODO: Move generic stuff to common.
function startUsingUProxyProxy () {
  // From:
  //   http://en.wikipedia.org/wiki/Private_network
  //   http://en.wikipedia.org/wiki/Reserved_IP_addresses
  var auto_conf_addresses = ["169.254.0.0/16", "fe80::/10"];
  var local_network_addresses = ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "fc00::/7"];
  var other_non_routable = ["0.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8", "192.0.0.0/29", "192.0.2.0/24", "198.18.0.0/15", "198.51.100.0/24", "203.0.113.0/24", "2001:10::/28", "2001:db8::/32"]

  var config = {
    mode: "fixed_servers",
    rules: {
      singleProxy: {
        scheme: "socks5",
        host: "127.0.0.1"
      },
      // List of domains to bypass the proxy
      bypassList: ["<local>"]
    }
  };
  chrome.proxy.settings.set(
      {value: config, scope: 'regular'},
      function() {});
}

function stopUsingUProxyProxy () {
    chrome.proxy.settings.set(
      {value: initialProxySettings, scope: 'regular'},
      function() {});
}

function clearUProxyProxy () {
    chrome.proxy.settings.clear({scope: 'regular'}, function() {});
}

