/// <reference path='../../../../third_party/polymer/polymer.d.ts' />
/// <reference path='../../../../third_party/typings/i18next/i18next.d.ts' />

// IMPORTANT:
// In order for this to compile, add two definitions to I18nextStatic in i18next.d.ts:
// addResources(language: string, namespace: string, resources :IResourceStoreKey): void;
// addResourceBundle(language: string, namespace: string, resources :IResourceStoreKey): void;

import i18n = require('i18next');

declare var window: I18nWindow;
declare var require :(path :string) => Object;

interface I18nWindow extends Window { i18nResources: any; }
interface MessageResource { [key: string]: Message }
interface Message {
  description :string;
  message :string;
}

var english_source :MessageResource = <MessageResource>require('../locales/en/messages.json');
var french_source :MessageResource = <MessageResource>require('../locales/fr/messages.json');
var arabic_source :MessageResource = <MessageResource>require('../locales/ar/messages.json');

function createI18nDictionary(sourceFile :MessageResource) : IResourceStoreKey {
  var i18nDictionary :IResourceStoreKey = {};
  for (var key in sourceFile) {
    i18nDictionary[key] = sourceFile[key]['message'];
  }
  return i18nDictionary;
}

window.i18nResources = {};
i18n.init({
  resStore: window.i18nResources
});

i18n.addResources('en-US', 'translation', createI18nDictionary(english_source));
i18n.addResources('fr', 'translation', createI18nDictionary(french_source));
i18n.addResources('ar', 'translation', createI18nDictionary(arabic_source));

export var i18n_t = i18n.t;
