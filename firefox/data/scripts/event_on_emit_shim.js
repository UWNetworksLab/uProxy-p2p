'use strict';

if ((typeof document) !== 'undefined' &&
   (typeof document.documentElement) !== 'undefined') {
  var eventShim = {
    emit: function(event, data) {
      var eventObj = new CustomEvent(event, {detail: data});
      document.documentElement.dispatchEvent(eventObj);
    },
    on: function(event, callback) {
      var eventDemarshalling = function eventDemarshalling(eventObj) {
	callback(eventObj.detail);
      };
      document.documentElement.addEventListener(event,
						eventDemarshalling,
						false);
    }
  };
}
