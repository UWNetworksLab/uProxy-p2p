/* jshint -W097 */
/* jshint -W083 */
'use strict';

// A little class that callbacks such that you can use it as the callback for
// many operations, but only when the last of the operations you started is
// completed, but the finalCallback actually get called.
function FinalCallback(finalCallback) {
  this.callsWaiting = 0;
  this.finalCallback = finalCallback;
  if(finalCallback && (typeof finalCallback != 'function')) {
    throw "FinalCallback: given a non-function: " + finalCallback;
  }
}

FinalCallback.prototype.makeCountedCallback = function () {
  if(!this.finalCallback) { return null; }
  // A way to make sure that we only call the callback once, and that
  // it happens only for the last callback. Assumes: callbacks happen
  // in call order.
  this.callsWaiting++;
  return this._oneOfManyCallbacks.bind(this);
};

FinalCallback.prototype._oneOfManyCallbacks = function () {
  this.callsWaiting--;
  if (!this.callsWaiting) this.finalCallback();
};

// Creates an object that has only the keys of |restrictionObject| and for each
// key, 'k', it has the value from |objectToRestrict| if it exists, else it has
// the valye from restrictionObject.
function restrictToObject(restrictionObject, objectToRestrict) {
  var selectedPartsOfObjectToRestrict = {};
  for (var k in restrictionObject) {
    if (objectToRestrict && k in objectToRestrict) {
      selectedPartsOfObjectToRestrict[k] = objectToRestrict[k];
    } else if (restrictionObject[k] !== null) {
      selectedPartsOfObjectToRestrict[k] = restrictionObject[k];
    } else {
      var err = new Error('Missing required key ' + k + '.\nObject: ' +
          JSON.stringify(objectToRestrict) + '\nRestriction: ' +
          JSON.stringify(restrictionObject));
      console.error("Failed object-restrict on " + err.stack);
      throw err;
    }
  }
  return selectedPartsOfObjectToRestrict;
}

/**
 * Convert a freedom promise-style interface into a
 * callback-style interface as used in the Chrome API.
 */
// TODO:
var promise2callback = function(object) {
  for (var prop in object) {
    if (object.hasOwnProperty(prop) && typeof object[prop] === 'function') {
      var orig = object[prop];
      var shim = function(base) {
        var args = [];
        for (var i = 1; i < arguments.length - 1; i++) {
          args.push(arguments[i]);
        }
        var cb = arguments[arguments.length - 1];
        if (typeof cb !== 'function') {
          args.push(cb);
          base.apply(object, args);
        } else {
          var promise = base.apply(object, args);
          promise.done(cb);
        }
      }.bind(object, orig);
      object[prop] = shim;
    }
  }
  return object;
};

/* jshint -W117 */
function makeLogger(level) {
  var logFunc = console[level];
  if (logFunc) {
    return logFunc.bind(console);
  }
  return function () {
    var s = '[' + level.toUpperCase() + '] ';
    for (var i=0, ii=arguments[i]; i<arguments.length; s+=ii+' ', ii=arguments[++i]) {
      ii = typeof ii === 'string' ? ii :
           ii instanceof Error ? ii.toString() :
           JSON.stringify(ii);
    }
    console.log(s);
  };
}
/* jshint +W117 */

//== XXX can get rid of these when we include lodash: ==//
function isUndefined(val) {
  return typeof val == 'undefined';
}

function isDefined(val) {
  return typeof val != 'undefined';
}

function cloneDeep(val) {
  return JSON.parse(JSON.stringify(val)); // quick and dirty
}

// returns object[key] if it exists, or default if it doesn't.
function getKeyWithDefault(object, key, def) {
  if (object[key] !== undefined) {
    return object[key];
  } else {
    return def;
  }
}

/**
 * This function extracts the cryptographic key used to encrypt the data media
 * type (mid:data) from the provided sdp headers string. If no key can be
 * determined, this function returns null.
 *
 * For example, given the below header:
 *
 * a=crypto:1 AES_CM_128_HMAC_SHA1_80
 * inline:FZoIzaV2KYVbd1mO445wH9NNIcE3tbKz0X0AtEok
 *
 * This function will return:
 *
 * FZoIzaV2KYVbd1mO445wH9NNIcE3tbKz0X0AtEok
 *
 * See http://tools.ietf.org/html/rfc4568#section-4 and
 * http://tools.ietf.org/html/rfc4568#section-9.1
 *
 * @param msg
 * @returns
 */
function extractCryptoKey(sdpHeaders) {
  // Process all the SDP header lines
  var lines = sdpHeaders.split(/\r?\n/),
      currentLine,
      midDataFound = false,
      keyParams,
      keyParam,
      i, j;

  for (i in lines) {
    currentLine = lines[i];
    if (!midDataFound) {
      if (currentLine === "a=mid:data") {
        midDataFound = true;
      }
    } else {
      if (currentLine.indexOf("a=crypto:1") === 0) {
        keyParams = currentLine.substring(currentLine.indexOf(" ", 11) + 1).split(" ");
        for (j in keyParams) {
          keyParam = keyParams[j];
          if (keyParam.indexOf("inline:" === 0)) {
            return keyParam.substring(7);
          }
        }
      }
    }
  }

  return null;
}
/* jshint +W097 */
/* jshint +W083 */
