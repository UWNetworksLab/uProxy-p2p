/// <reference path='../../../../third_party/i18n/i18n.d.ts' />

// A little utility library for managing translation strings.

module i18nUtil {

  // Map of the supported languages to whether they are left-to-right or
  // right-to-left languages.
  // TODO: use enum instead of string for ltr/rtl.
  var languageDirection :{[index:string]:string} = {
    'en' : 'ltr',
    'it' : 'ltr',
    'ar' : 'rtl',
    'fa' : 'rtl'
  };

  // UI strings in the language selected by the user.
  var translatedStrings :{[index:string]:string} = {};

  // Clears the dictionary of UI strings (i.e. before a new language dictionary
  // is loaded).
  function clearTranslatedStrings() : void {
    for (var key in translatedStrings) {
      delete translatedStrings[key];
    }
  }

  // Given a Document, add translated strings to any text-containing child nodes.
  export function translateStrings(node:Element) : void {
    i18nTemplate.process(node, translatedStrings);
  }

  // Retrieve messages.json file of the appropriate language and insert strings
  // into the application's UI.
  export function changeLanguage(language:string) : void {
    clearTranslatedStrings();
    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'uproxy-lib/copypaste-socks/locales/' + language + '/messages.json', true);

    xhr.onload = function() {
      if (this.readyState != 4) {
        return;
      }
      // Translate the JSON format to a simple { key : value, ... } dictionary.
      var retrievedMessages = JSON.parse(xhr.responseText);
      for (var key in retrievedMessages) {
        if (retrievedMessages.hasOwnProperty(key)) {
          translatedStrings[key] = retrievedMessages[key].message;
        }
      }
      var htmlNode = document.querySelector('html');
      translateStrings(htmlNode);
      htmlNode.setAttribute('dir', languageDirection[language]);
    }
    xhr.send(null);
  }

  // Return the language of the user's browser.
  //
  // TODO (lucyhe): find a better way to do this.
  export function getBrowserLanguage() : string {
    return navigator.language.substring(0, 2);
  }

}
