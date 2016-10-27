import * as background_ui from '../../../generic_ui/scripts/background_ui';
import CoreConnector from '../../../generic_ui/scripts/core_connector';
import FirefoxBrowserApi from './firefox_browser_api';
import FirefoxCoreConnector from './firefox_connector';
import * as ui_model from '../../../generic_ui/scripts/model';
import * as panel_connector from '../../../interfaces/panel_connector';
import port from './port';
import * as same_context_panel_connector from '../../../generic_ui/scripts/same_context_panel_connector';
import * as user_interface from '../../../generic_ui/scripts/ui';

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
