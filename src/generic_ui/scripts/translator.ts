/// <reference path='../../../../third_party/polymer/polymer.d.ts' />
/// <reference path='../../../../third_party/typings/i18next/i18next.d.ts' />
/// <reference path='../../../../third_party/typings/xregexp/xregexp.d.ts' />

// IMPORTANT:
// In order for this to compile, add two definitions to I18nextStatic in i18next.d.ts:
// addResources(language: string, namespace: string, resources :IResourceStoreKey): void;
// addResourceBundle(language: string, namespace: string, resources :IResourceStoreKey): void;

import i18n = require('i18next-client');
import regEx = require('xregexp');
import XRegExp = regEx.XRegExp;

// Example usage of these tests:
// isRightToLeft('hi') --> false
// isRightToLeft('لك الوص') --> true
function isRightToLeft(lang :string) :boolean {
  return XRegExp('[\\p{Arabic}\\p{Hebrew}]').test(lang);
}

declare var window: I18nWindow;
declare var require :(path :string) => MessageResource;

interface I18nWindow extends Window { i18nResources: any; }
interface MessageResource { [key: string]: Message }
interface Message {
  description :string;
  message :string;
}

var english_source = require('../locales/en/messages.json');
var turkish_source = require('../locales/tr/messages.json');
var vietnamese_source = require('../locales/vi/messages.json');
var arabic_source = require('../locales/ar/messages.json');
var farsi_source = require('../locales/fa/messages.json');

function createI18nDictionary(sourceFile :MessageResource) : IResourceStoreKey {
  var i18nDictionary :IResourceStoreKey = {};
  for (var key in sourceFile) {
    i18nDictionary[key] = sourceFile[key]['message'];
  }
  return i18nDictionary;
}

window.i18nResources = {};
i18n.init({
  resStore: window.i18nResources,
  fallbackLng: 'en'
});

i18n.addResources('en', 'translation', createI18nDictionary(english_source));
i18n.addResources('tr', 'translation', createI18nDictionary(turkish_source));
i18n.addResources('vi', 'translation', createI18nDictionary(vietnamese_source));
i18n.addResources('ar', 'translation', createI18nDictionary(arabic_source));
i18n.addResources('fa', 'translation', createI18nDictionary(farsi_source));

export var i18n_t = (placeholder :string, params?: any) :string => {
  for (var p in params) {
    if (isRightToLeft(params[p])) {
      params[p] = "\u200F" + params[p] + "\u200F";
    } else {
      params[p] = "\u200E" + params[p] + "\u200E";
    }
  }
  return i18n.t(placeholder, params);
};
export var i18n_setLng = i18n.setLng;
