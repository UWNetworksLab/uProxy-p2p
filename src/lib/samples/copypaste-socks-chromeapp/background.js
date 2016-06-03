chrome.app.runtime.onLaunched.addListener(function() {
  chrome.app.window.create('main.html', {
    id: 'main',
    bounds: {
      width: 450,
      height: 625
    }
  });
});
