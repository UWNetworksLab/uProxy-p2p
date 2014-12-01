/**
 * firewall.ts
 *
 * Simple network-input validation, with possible responses.
 *
 * Types of attacks:
 *  * Javascript attacks.
 *    See https://github.com/uProxy/uproxy/issues/443 Some values fed
 *    to uProxy over the wire are directly used to index into
 *    containers.
 *
 *  * Unicode attacks.
 *    Some displayed data may be made to impersonate a user with some
 *    visual trickery.  See http://www.unicode.org/reports/tr36/#visual_spoofing
 */

/// <reference path='../freedom/typings/social.d.ts' />

module Firewall {
  export enum Severity {
    // Incorrect input.  No claims on intent.
    MalformedInput,
    // Invoked when it looks like a pretty blatant attempt to force
    // a failure/explit in uProxy.  We have some heuristics for
    // determining likely attacks, such as identifiers that include
    // curly braces, or specialized JS keywords like __proto__.
    LikelyAttack,
  };

  export interface ResponsePolicy {
    onValidationFailure(s :string, level :Severity ) : void;
  };

  export class DefaultResponsePolicy implements ResponsePolicy {
    public onValidationFailure(s :string, level :Severity) {
      console.log("DROPPING MESSAGE ON VALIDATION FAILURE.  Severity: " + 
                  level + ", text: " + s);
    }
  }

  var DEFAULT_RESPONSE_POLICY = new DefaultResponsePolicy;

  // Whether |s| is some sort of keyword in JS.  We also include the
  // properties of Object.
  export function IsKeyword(s :string) : boolean {
    var keywords = [ "__proto__", "__noSuchMethod__", "__defineGetter__",
                     "__defineSetter__", "__lookupGetter__", "__lookupSetter__",
                     "constructor", "__count__", "__parent__",
                     "abstract", "else", "instanceof", "super", 
                     "boolean", "enum", "int", "switch", 
                     "break", "export", "interface", "synchronized", 
                     "byte", "extends", "let", "this", 
                     "case", "false", "long", "throw", 
                     "catch", "final", "native", "throws", 
                     "char", "finally", "new", "transient", 
                     "class", "float", "null", "true", 
                     "const", "for", "package", "try", 
                     "continue", "function", "private", "typeof", 
                     "debugger", "goto", "protected", "var", 
                     "default", "if", "public", "void", 
                     "delete", "implements", "return", "volatile", 
                     "do", "import", "short", "while", 
                     "double", "in", "static", "with" ];
    for (var k in keywords) {
      if (s == keywords[k]) {
        return true;
      }
    }
    return false;
  }

  export function HasBadChars(s :string) : boolean {
    // TODO: consider unicode-based attack vectors.
    return false;
  }

  export function IsObjectMethod(s :string) : boolean {
    // Returns whether 's' is a method on Object, which is just a little fishy.
    var tester = {};
    return (typeof(tester[s]) != 'undefined');
  }

  export function IsUserId(s :string, response :ResponsePolicy) : boolean {
    var USERID_PATTERN = new RegExp( '[a-z._0-9]+@[a-z.-_0-9]+', 'i');
    if (USERID_PATTERN.test(s)) {
      return true;
    } else {
      if (IsKeyword(s) || HasBadChars(s) || IsObjectMethod(s)) {
        response.onValidationFailure(s, Severity.LikelyAttack);
      } else {
        response.onValidationFailure(s, Severity.MalformedInput);
      }
      return false;
    }
  }

  export function IsClientId(s :string, response :ResponsePolicy) : boolean {
    // Split the string on the first /.  The left is a UserId, the
    // right is to be matched against a regex.
    if (s.split("/").length > 2) {
      response.onValidationFailure(s, Severity.MalformedInput);
      return false;
    }
    var id_left = s.split("/")[0];
    var id_right = s.split("/")[1];
    if (!IsUserId(id_left, response)) {
      return false;
    } else {
      var INSTANCEID_PATTERN = new RegExp( '[a-z_0-9]+', 'i');
      if (INSTANCEID_PATTERN.test(id_right)) {
        return true;
      } else {
        if (IsKeyword(s) || HasBadChars(s) || IsObjectMethod(s)) {
          response.onValidationFailure(s, Severity.LikelyAttack);
        } else {
          response.onValidationFailure(s, Severity.MalformedInput);
        }
        return false;
      }
    }
  }        
  var USER_PROFILE_SCHEMA = {
    'userId' : 'string',
    'timestamp' : 'number',
    'name' : '?string',
    'url' : '?string',
    'imageData' : '?string'
  };

  function CheckSchema(object, schema) : boolean {
    if (object === null || typeof object !== 'object') {
      return false;
    }
    var keys = Object.keys(schema);
    // We will reduce this value as we discover optional fields, and
    // as we find required fields that are present.
    var remaining_required = keys.length;

    // We will reduce this value as we discover fields that match the
    // schema.
    var object_keys_matched = Object.keys(object).length;

    for (var k in schema) {
      var type = schema[k];
      var optional = false;
      if (type[0] == '?') {
        optional = true;
        type = type.slice(1);
      }
      if (k in object) {
        remaining_required--;
        object_keys_matched--;
        if (typeof(object[k]) != type) {
          return false;
        }
      } else if (optional) {
        remaining_required--;
      } else {
        return false;
      }
    }

    return remaining_required == 0 && 
      object_keys_matched == 0;
  }

  export function IsValidUserProfile(profile :freedom_Social.UserProfile, 
                                     response :ResponsePolicy) : boolean {
    if (response == null) {
      response = DEFAULT_RESPONSE_POLICY;
    }

    function fail() {
      response.onValidationFailure(JSON.stringify(profile),
                                   Severity.MalformedInput);
    }

    // UserProfile can only have 5 properties.
    if (!CheckSchema(profile, USER_PROFILE_SCHEMA)) {
      fail();
      return false;
    }

    // Validate fields.
    if (!IsUserId(profile.userId, response)) {
      return false;
    }

    // TODO: Consider clamping timestamp to 'now' at the high end.
    if (profile.timestamp < 0) {
      fail();
      return false;
    }

    return true;
  }

  var CLIENT_STATE_SCHEMA = {
    'userId' : 'string',
    'clientId' : 'string',
    'status' : 'string',
    'timestamp' : 'number'
  };

  export function IsValidClientState(state :freedom_Social.ClientState,
                                     response :ResponsePolicy) : boolean {
    if (response == null) {
      response = DEFAULT_RESPONSE_POLICY;
    }

    function fail() {
      response.onValidationFailure(JSON.stringify(state), 
                                   Severity.MalformedInput);
    }

    if (!CheckSchema(state, CLIENT_STATE_SCHEMA)) {
      fail();
      return false;
    }

    if (!IsUserId(state.userId, response)) {
      return false;
    }
    
    if (!IsClientId(state.clientId, response)) {
      return false;
    }

    if (HasBadChars(state.status)) {
      fail();
      return false;
    }

    if (state.timestamp < 0) {
      fail();
      return false;
    }
    
    return true;
  }

  var INCOMING_MESSAGE_SCHEMA = {
    'from' : 'object',
    'message' : 'string'
  };

  export function IsValidIncomingMessage(state :freedom_Social.IncomingMessage, 
                                         response :ResponsePolicy) :boolean {
    if (response == null) {
      response = DEFAULT_RESPONSE_POLICY;
    }

    function fail() {
      response.onValidationFailure(JSON.stringify(state), 
                                   Severity.MalformedInput);
    }

    if (!CheckSchema(state, INCOMING_MESSAGE_SCHEMA)) {
      fail();
      return false;
    }

    if (!IsValidClientState(state.from, response)) {
      return false;
    }

    return true;
  }
}  // module Firewall