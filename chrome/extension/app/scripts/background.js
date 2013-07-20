'use strict';

/* jshint -W098 */

chrome.runtime.onInstalled.addListener(function (details) {
  console.log('previousVersion', details.previousVersion);
});


var popupListenerss = {};

//freedom.on('buddylist-update', function (msg) {
//  buddies = msg;
//});


function clearPopupListeners() {
  popupListenerss = {};
}

function addPopupListener(type, func) {
  if (popupListenerss[type]) {
    popupListenerss[type].push(func);
  } else {
    popupListenerss[type] = [func];
  }
}

function callPopupListener(type, data) {
  if (popupListenerss[type]) {
    for (var i = 0; i < popupListenerss[type].length; i++) {
      popupListenerss[type][i](data);
    }
  } else {
    console.log('Handler missing for: ' + type);
    console.log(popupListenerss);
  }
}

freedom.on('state-change', function (msg) {
  callPopupListener('state-change', msg);
});


freedom.emit('open-extension', '');
