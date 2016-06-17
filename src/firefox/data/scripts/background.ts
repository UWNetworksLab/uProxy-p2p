import background_ui = require('../../../generic_ui/scripts/background_ui');
import CoreConnector = require('../../../generic_ui/scripts/core_connector');
import FirefoxBrowserApi = require('./firefox_browser_api');
import FirefoxCoreConnector = require('./firefox_connector');
import ui_model = require('../../../generic_ui/scripts/model');
import panel_connector = require('../../../interfaces/panel_connector');
import port = require('./port');
import same_context_panel_connector = require('../../../generic_ui/scripts/same_context_panel_connector');
import user_interface = require('../../../generic_ui/scripts/ui');

export var ui   :user_interface.UserInterface;
export var core :CoreConnector;
export var browserConnector :FirefoxCoreConnector;
export var model :ui_model.Model;
export var panelConnector: panel_connector.BrowserPanelConnector;
var firefoxBrowserApi :FirefoxBrowserApi;

function initUI() {
    browserConnector = new FirefoxCoreConnector();
    core = new CoreConnector(browserConnector);
    firefoxBrowserApi = new FirefoxBrowserApi();
    panelConnector = new same_context_panel_connector.SameContextPanelConnector();
    var backgroundUi = new background_ui.BackgroundUi(panelConnector, core);

    return new user_interface.UserInterface(core, firefoxBrowserApi, backgroundUi);
}

if (undefined === ui) {
    ui = initUI();
    model = ui.model;
}

port.on('newlyInstalled', function() {
  firefoxBrowserApi.hasInstalledThenLoggedIn = false;
});
