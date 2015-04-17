//TODO figure out why this line is causing compilation to fail
//import ui_constants = require('../../interfaces/ui');

interface StaticInPanel {
  ui_constants: any;
  ui :any;
  core :any;
  model :any;
}

declare var browserified_exports :StaticInPanel;
