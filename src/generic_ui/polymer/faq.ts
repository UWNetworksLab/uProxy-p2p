/// <reference path='./context.d.ts' />
/// <reference path='../../../../third_party/polymer/polymer.d.ts' />

import uproxy_core_api = require('../../interfaces/uproxy_core_api');

var ui = ui_context.ui;

Polymer({
  close: function() {
    this.$.faqPanel.close();
  },
  open: function(e :Event, detail :{anchor :string}) {
    // Since opening the FAQ panel is async, set the openingAnchor,
    // and then scrollAfterOpening will scroll to openingAnchor after
    // the panel has finished opening.
    if (detail.anchor === '') {
      this.openingAnchor = 'header';
    } else {
      this.openingAnchor = detail.anchor;
    }

    this.$.faqPanel.open();
  },
  scrollAfterOpening: function() {
    var anchorElem = this.$[this.openingAnchor];
    anchorElem.scrollIntoView();
  },
  scroll: function(e :Event) {
    var elemTapped = <HTMLElement>e.target;
    var anchor = elemTapped.getAttribute('data-anchor');
    var anchorElem = this.$[anchor];
    anchorElem.scrollIntoView();
  },
  openTab: function(e :Event) {
    var elemTapped = <HTMLElement>e.target;
    var url = elemTapped.getAttribute('data-url');
    this.ui.openTab(url);
  },
  sanitize: function(i18nMessage :string) {
    var sanitizedMessage = ui.i18nSanitizeHtml(i18nMessage);

    // Replace all links with openTab events
    sanitizedMessage = sanitizedMessage
        .replace(/<a([^>]+)>(.+?)<\/a>/g,
            function(p0 :string, p1 :string, p2 :string) {
      // p0 is the full string matched: e.g. <a href="...">Click Me!</a>
      // p1 is the first matching group: e.g. href="..."
      // p2 is the second matching group: e.g. Click Me!
      var regexToGetUrl =
          /href\s*=\s*(\"([^"]*\")|'[^']*'|([^'">\s]+))/g;
      var url = regexToGetUrl.exec(p1)[1];
      return '<a on-tap="{{openTab}}" data-url=' + url + '>' + p2 + '</a>';
    });
    return sanitizedMessage;
  },
  translateElements: function() {
    var textElements = document.querySelectorAll('html /deep/ .i18n');
    for (var i = 0; i < textElements.length; i++) {
      var element = <HTMLElement>(textElements[i]);
      var i18nKey = element.getAttribute('data-i18n');
      var i18nMessage = ui.i18n_t(i18nKey);
      if (i18nMessage.indexOf('<') > -1) {
        i18nMessage = this.sanitize(i18nMessage);
      }
      this.injectBoundHTML(i18nMessage, element);
    }
  },
  ready: function() {
    this.openingAnchor = '';
    this.ui = ui_context.ui;
    this.model = ui_context.model;
  },
  domReady: function() {
    this.translateElements();
  },
  observe: {
    'model.globalSettings.language': 'translateElements'
  }
});
