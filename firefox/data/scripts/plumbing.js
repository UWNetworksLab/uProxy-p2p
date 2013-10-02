'use strict';

window.freedomcfg = function(register) {
  // register("core.view", View_oauth);
  try {
    register('core.socket', Socket_firefox);
    console.log('Sockets provider registered.');
  } catch (e) {
    console.error(e);
  }
};
