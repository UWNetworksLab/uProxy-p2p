/**
 * Send POST requests from Firefox add-on.
 */

const {XMLHttpRequest} = require("sdk/net/xhr");

var xhr = {
  frontedPost : function (data,
                          externalDomain,
                          cloudfrontDomain,
                          cloudfrontPath) {
    return new Promise(function (fulfill, reject) {
      var request = new XMLHttpRequest();
      request.onload = function(){
        fulfill();
      };
      request.onerror = function(){
        reject(new Error('POST failed with HTTP code ' + request.status));
      };
      var params = JSON.stringify(data);
      cloudfrontPath = cloudfrontPath || '';
      // Only the front domain is exposed on the wire. The cloudfrontPath
      // should be encrypted. The cloudfrontPath needs to be here and not
      // in the Host header, which can only take a host name.
      request.open('POST', externalDomain + cloudfrontPath, true);
      // The true destination address is set as the Host in the header.
      request.setRequestHeader('Host', cloudfrontDomain);
      request.send(params);
    });
  }
};

exports.xhr = xhr
