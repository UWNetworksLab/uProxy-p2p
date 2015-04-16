/**
 * Send POST requests from Firefox add-on.
 */

var Request = require("sdk/request").Request;

var xhr = {
  var frontDomain_ = 'https://a0.awsstatic.com/';

  var httpPost = function (url, data, useDomainFronting) {
    var requestHeaders = {};
    var removeSendHeaderListener = function(){};

    if (useDomainFronting) {
      requestHeaders = {'Host': url};
      url = frontDomain_;
    }

    return new Promise(function (fulfill, reject) {
      Request({
        url: url,
        content: JSON.stringify(data),
        headers: requestHeaders,
        onComplete: function (response) {
          if (response.status == 200) {
            fulfill();
          } else {
            reject(new Error('POST failed with HTTP code ' + response.status));
          }
        }
      }).post();
    });
  }
};

exports.xhr = xhr
