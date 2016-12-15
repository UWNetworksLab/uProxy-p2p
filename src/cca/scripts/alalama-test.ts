interface Device {
  platform: String;
  version: String;
}

interface Window {
  device: Device;
}

var bg = {
    init: function() {
        console.log("init alalama test script");
        document.addEventListener('deviceready', this.onDeviceReady, false);
    },

    onDeviceReady: function() {
        setInterval(function() {
            console.log('DEVICE: ' + window.device.platform + ' ' + window.device.version);
        }, 5000);
    }
};

bg.init();
