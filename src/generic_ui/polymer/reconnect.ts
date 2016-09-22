/// <reference path='./context.d.ts' />
import ui_constants = require('../../interfaces/ui');

Polymer('uproxy-reconnect', {
  logout: function() {
    ui_context.ui.stopReconnect();
    ui_context.ui.view = ui_constants.View.SPLASH;
  },
  ready: function() {
    this.model = ui_context.model;
  }
});
