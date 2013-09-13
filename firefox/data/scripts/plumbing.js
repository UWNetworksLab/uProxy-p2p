'use strict';

window.freedomcfg = function(register) {
    register("core.view", View_oauth);
    register('core.socket', Socket_firefox);
};
