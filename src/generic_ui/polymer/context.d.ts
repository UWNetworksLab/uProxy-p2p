// TODO: figure out why this line is causing compilation to fail
//import ui_constants = require('../../interfaces/ui');

// TODO: replace any types with real interfaces.

interface UiGlobals {
  // Corresponds to generic_ui/scripts/ui.ts class: UserInterface
  ui :any;

  // Corresponds to CoreConnector, defined in:
  //   generic_ui/scripts/core_connector.ts
  core: any;

  // Corresponds to generic_ui/scripts/ui.ts class: Model
  model :any;

  // Corresponds to interfaces/browser_api.ts Interface: BrowserAPI
  browserApi :any;

  // Corresponds to interfaces/browser_connector.ts Interface: CoreBrowserConnector
  browserConnector :any;

  // Firefox only, hack for background UI
  panelConnector: any;
}

// Defined in: firefox and chrome specific background pages.
declare var ui_context :UiGlobals;
