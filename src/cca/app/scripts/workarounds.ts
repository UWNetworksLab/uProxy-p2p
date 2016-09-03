// CCA-specific workarounds.

(function () {
  // Force a repaint every 300 ms.
  // Extremely hacky workaround for https://crbug.com/612836

  let sendResize = true;

  setInterval(function () {
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
    // the uproxy root object instantiated in src/generic_ui/polymer/root.ts.
    console.debug('got uproxy-root-ready');
    let inviteButton = document.querySelector('uproxy-root /deep/ #inviteButton');
    if (!inviteButton) {
      console.error('#inviteButton missing:', inviteButton);
      return;
    }
    inviteButton.addEventListener('tap', function () {
      sendResize = false;
      setTimeout(function () { sendResize = true; }, 2000);
    });
  });
})();
