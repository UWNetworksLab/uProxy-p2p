import user_interface = require('../../../generic_ui/scripts/ui');
import CoreConnector = require('../../../generic_ui/scripts/core_connector');
import FirefoxCoreConnector = require('./firefox_connector');
import FirefoxBrowserApi = require('./firefox_browser_api');

export import model = user_interface.model;
export var ui   :user_interface.UserInterface;
export var core :CoreConnector;
function initUI() {
    var firefoxCoreConnector = new FirefoxCoreConnector();
    core = new CoreConnector(firefoxCoreConnector);
    var firefoxBrowserApi = new FirefoxBrowserApi();

    return new user_interface.UserInterface(core, firefoxBrowserApi);
}

if (undefined === ui) {
    ui = initUI();
}

ui.browser = 'firefox';
