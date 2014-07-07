var BrowserProxyConfig = (function () {
    function BrowserProxyConfig() {
        var _this = this;
        this.preUproxyConfig_ = null;
        this.uproxyConfig_ = null;
        this.running_ = false;
        this.startUsingProxy = function () {
          /*
            if (_this.running_ == false) {
                console.log('Directing Chrome proxy settings to UProxy');
                _this.running_ = true;
                chrome.proxy.settings.get({ incognito: false }, function (details) {
                    _this.preUproxyConfig_ = details.value;
                    chrome.proxy.settings.set({
                        value: _this.uproxyConfig_,
                        scope: 'regular'
                    }, function () {
                        console.log('Successfully set proxy');
                    });
                });
            }a
          */
        };
        this.stopUsingProxy = function () {
          /*
            if (_this.running_ == true) {
                console.log('Reverting Chrome proxy settings');
                _this.running_ = false;
                chrome.proxy.settings.set({
                    value: _this.preUproxyConfig_,
                    scope: 'regular'
                });
            }
          */
        };
        this.uproxyConfig_ = {
            mode: "fixed_servers",
            rules: {
                singleProxy: {
                    scheme: "socks5",
                    host: "127.0.0.1",
                    port: 9999
                },
                bypassList: [
                    "<local>", "www.googleapis.com", "graph.facebook.com",
                    "computeengineondemand.appspot.com"]
            }
        };

        //chrome.proxy.settings.clear({ scope: 'regular' });
    }
    return BrowserProxyConfig;
})();
;
