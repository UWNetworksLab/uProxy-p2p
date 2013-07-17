function launchWindow(launchData) {
  chrome.app.window.create('launch.html', {
    id: "uproxy",
    minWidth: 640,
    minHeight: 480
  });
}

chrome.app.runtime.onLaunched.addListener(launchWindow);
