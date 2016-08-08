/// <reference path='../../../../third_party/polymer/polymer.d.ts' />
/// <reference path='../../../../third_party/typings/index.d.ts' />
/// <reference path='context.d.ts' />

import _ = require('lodash');
import ui_constants = require('../../interfaces/ui');
import user = require('../scripts/user');

var model = ui_context.model;

Polymer({
  sortedContacts: [],
  created: function() {
    // this gets expensive, especially during initialization, if we are calling
    // it on every event, so throttle it
    this.contactsChanged = _.throttle(this.contactsChanged.bind(this), 100);
  },
  contactsChanged: function() {
    var property = (this.mode == ui_constants.Mode.GET) ? 'isSharingWithMe' : 'isGettingFromMe';
    // TODO: upgrade to lodash 4.x
    this.sortedContacts = (<any>_).sortByOrder(this.contacts, [property, 'isOnline'], ['desc', 'desc']);
  },
});
