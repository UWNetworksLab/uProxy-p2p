'use strict';

/* jshint -W098 */

chrome.runtime.onInstalled.addListener(function (details) {
  console.log('previousVersion', details.previousVersion);
});


var popupListeners = {};

//freedom.on('buddylist-update', function (msg) {
//  buddies = msg;
//});


function clearPopupListeners() {
  popupListeners = {};
}

function addPopupListener(type, func) {
  if (popupListeners[type]) {
    popupListeners[type].push(func);
  } else {
    popupListeners[type] = [func];
  }
}

function callPopupListener(type, data) {
  if (popupListeners[type]) {
    for (var i = 0; i < popupListeners[type].length; i++) {
      popupListeners[type][i](data);
    }
  } else {
    console.log('Handler missing for: ' + type);
    console.log(popupListeners);
  }
}

freedom.on('state-change', function (msg) {
  callPopupListener('state-change', msg);
});


freedom.emit('open-extension', '');
