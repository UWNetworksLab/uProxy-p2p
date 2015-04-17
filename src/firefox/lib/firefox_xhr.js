/**
 * Send POST requests from Firefox add-on.
 */

const {XMLHttpRequest} = require("sdk/net/xhr");

var frontDomain = 'https://a0.awsstatic.com/';

var xhr = {
  httpPost : function (url, data, cloudfrontDomain, cloudfrontPath) {
    return new Promise(function (fulfill, reject) {
      var request = new XMLHttpRequest();
      request.onreadystatechange = function() {
        if (request.readyState == 4) {
          if (request.status == 200) {
            fulfill();
          } else {
            reject(new Error('POST failed with HTTP code ' + request.status));
          }
        }
      }
      var params = JSON.stringify(data);

      if (cloudfrontDomain) {
        cloudfrontPath = cloudfrontPath || '';
        // Only the front domain is exposed on the wire. The cloudfrontPath
        // should be encrypted. The cloudfrontPath needs to be here and not
        // in the Host header, which can only take a host name.
        request.open('POST', frontDomain + cloudfrontPath, true);
        request.setRequestHeader('Host', cloudfrontDomain);
      } else {
        request.open('POST', url, true);
      }
      request.send(params);
    });
  }
};

exports.xhr = xhr
