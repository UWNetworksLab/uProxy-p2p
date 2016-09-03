(function () {
  'use strict';

  // Force a repaint every 300 ms.
  // Extremely hacky workaround for https://crbug.com/612836

  var sendResize = true;

  setInterval(function() {
    if (sendResize) {
      window.dispatchEvent(new Event('resize'));
    } else {
      console.debug('suppressed resize event');
    }
  }, 300);

  // Workaround for janky inviteUserPanel transition,
  // which is caused by the workaround above.
  // https://github.com/uProxy/uproxy/issues/2659
  document.addEventListener('uproxy-root-ready', function () {
    // The 'uproxy-root-ready' event is dispatched in the `ready()` method of
    // the uproxy root object instantiated in generic_ui/polymer/root.ts.
    console.debug('got uproxy-root-ready');
    var inviteButton = document.querySelector('uproxy-root /deep/ #inviteButton');
    var inviteUserPanel = document.querySelector('uproxy-root /deep/ #inviteUserPanel');
    if (!inviteButton || !inviteUserPanel) {
      console.error('#inviteButton or #inviteUserPanel missing:', inviteButton, inviteUserPanel);
      return;
    }
    inviteButton.addEventListener('tap', function () {
      sendResize = false;
      setTimeout(function () { sendResize = true; }, 2000);
    });
  });
})();
