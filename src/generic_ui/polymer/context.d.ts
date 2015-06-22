//TODO figure out why this line is causing compilation to fail
//import ui_constants = require('../../interfaces/ui');

interface UiGlobals {
  ui :any;
  core :any;
  model :any;
  browserApi :any;
  browserConnector :any
}

declare var ui_context :UiGlobals;
