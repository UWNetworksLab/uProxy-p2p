function launchWindow(launchData) { 
	console.log(launchData);
	chrome.app.window.create('launch.html', {
		  width: 800,
		  height: 600,
		  minWidth: 640,
		  minHeight: 480,
			type: 'shell'
	});
}

chrome.app.runtime.onLaunched.addListener(launchWindow);
