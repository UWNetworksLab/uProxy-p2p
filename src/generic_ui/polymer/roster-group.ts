/// <reference path='../../../../third_party/polymer/polymer.d.ts' />
/// <reference path='../../../../third_party/typings/lodash/lodash.d.ts' />
/// <reference path='context.d.ts' />

import _ = require('lodash');
import ui_constants = require('../../interfaces/ui');
import user = require('../scripts/user');

var model = ui_context.model;

Polymer({
  sortedContacts: [],
  hideForSearch: function(name :string, query :string) {
    if (query.length === 0) {
      return false;
    }
    return name.toLowerCase().indexOf(query.toLowerCase()) === -1;
  },
  created: function() {
    // this gets expensive, especially during initialization, if we are calling
    // it on every event, so throttle it
    this.contactsChanged = _.throttle(this.contactsChanged.bind(this), 100);
  },
  contactsChanged: function() {
    var property = (this.mode == ui_constants.Mode.GET) ? 'isSharingWithMe' : 'isGettingFromMe';
    // TODO add typing for this to DefinitelyTyped
    this.sortedContacts = _.sortByOrder(this.contacts, [property, 'isOnline'], ['desc', 'desc']);
  },
});
