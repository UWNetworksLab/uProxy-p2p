/// <reference path='./context.d.ts' />
import * as ui_constants from '../../interfaces/ui';

Polymer({
  logout: function() {
    ui_context.ui.stopReconnect();
    ui_context.ui.view = ui_constants.View.SPLASH;
  },
  ready: function() {
    this.model = ui_context.model;
  }
});
