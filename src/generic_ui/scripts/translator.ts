/// <reference path='../../../../../node_modules/i18next-client/typescript/i18next.d.ts' />
/// <reference path='../../../../third_party/typings/browser.d.ts' />

import i18next = require('i18next-client');
import xregexp = require('xregexp');

// Example usage of these tests:
//   isRightToLeft('hi') -> false
//   isRightToLeft('لك الوص') -> true
function isRightToLeft(lang :string): boolean {
  return xregexp.XRegExp('[\\p{Arabic}\\p{Hebrew}]').test(lang);
}

declare const window :I18nWindow;
declare const require :(path: string) => MessageResource;

interface I18nWindow extends Window {
  i18nResources: any;
}
interface MessageResource { [key: string]: Message }
interface Message {
  description: string;
  message: string;
}

var english_source = require('../locales/en/messages.json');
var arabic_source = require('../locales/ar/messages.json');
var farsi_source = require('../locales/fa/messages.json');
var chinese_source = require('../locales/zh/messages.json');

function createI18nDictionary(sourceFile :MessageResource): IResourceStoreKey {
  let i18nDictionary :IResourceStoreKey = {};
  for (let key in sourceFile) {
    i18nDictionary[key] = sourceFile[key]['message'];
  }
  return i18nDictionary;
}

window.i18nResources = {};
i18next.init({
  resStore: window.i18nResources,
  fallbackLng: 'en'
});

i18next.addResources('en', 'translation', createI18nDictionary(english_source));
i18next.addResources('zh', 'translation', createI18nDictionary(chinese_source));
i18next.addResources('ar', 'translation', createI18nDictionary(arabic_source));
i18next.addResources('fa', 'translation', createI18nDictionary(farsi_source));

export const i18n_t = (placeholder :string, params ?:any): string => {
  for (let p in params) {
    if (isRightToLeft(params[p])) {
      params[p] = '\u200F' + params[p] + '\u200F';
    } else {
      params[p] = '\u200E' + params[p] + '\u200E';
    }
  }
  return i18next.t(placeholder, params);
};

export const i18n_setLng = i18next.setLng;

export const i18n_languagesAvailable :string[] = Object.keys(window.i18nResources);
