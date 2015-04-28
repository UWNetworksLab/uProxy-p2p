/// <reference path='./context.d.ts' />

import social = require('../../interfaces/social');
import ui_constants = require('../../interfaces/ui');
import net = require('../../../../third_party/uproxy-networking/net/net.types');
import user_interface = require('../scripts/ui');

var ui = ui_context.ui;
var core = ui_context.core;
var model = ui_context.model;

Polymer({
  aborted: false, // did the user manually cancel the last connection
  ready: function() {
    this.path = <social.InstancePath>{
      network : {
       name: this.network.name,
       userId: this.network.userId
      },
      userId: this.user.userId,
      instanceId: this.instance.instanceId
    };
    // Expose global ui object and UI module in this context. This allows the
    // hidden? watch for the get/give toggle to actually update.
    this.ui = ui;
    this.ui_constants = ui_constants;
    this.GettingState = social.GettingState;
    this.model = model;
  },
  start: function() {
    if (!this.instance.isOnline) {
      this.ui.toastMessage = this.user.name + ' is offline';
      return;
    }

    this.fire('set-trying-to-get', {isTryingToGet: true});
    console.log('[polymer] calling core.start(', this.path, ')');

    this.aborted = false;
    core.start(this.path).then((endpoint :net.Endpoint) => {
      console.log('[polymer] received core.start promise fulfillment.');
      console.log('[polymer] endpoint: ' + JSON.stringify(endpoint));
      this.ui.startGettingInUiAndConfig(this.instance.instanceId, endpoint);
      this.fire('set-trying-to-get', {isTryingToGet: false});
    }).catch((e :Error) => {
      if (this.aborted) {
        // if the failure is because of a user action, do nothing
        return;
      }
      ui.toastMessage = user_interface.GET_FAILED_MSG + this.user.name;
      ui.bringUproxyToFront();
      console.error('Unable to start proxying ', e);
      this.fire('set-trying-to-get', {isTryingToGet: false});
    });
  },
  stop: function() {
    this.fire('set-trying-to-get', {isTryingToGet: false});
    this.aborted = true;
    console.log('[polymer] calling core.stop()');
    core.stop();
  }
});
