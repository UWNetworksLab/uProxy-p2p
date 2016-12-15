(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.ui_context = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";
// A VpnDevice that does nothing.
var NoOpVpnDevice = (function () {
    function NoOpVpnDevice() {
    }
    // Starts the VPN, redirecting the traffic to a Socks proxy running on the given port.
    // You can pass a callback to be notified when it gets disconnected.
    NoOpVpnDevice.prototype.start = function (port, onDisconnect) {
        console.debug("Would start VPN talking to port " + port);
        return Promise.resolve('Started');
    };
    // Stops the VPN. No more traffic will be rerouted.
    NoOpVpnDevice.prototype.stop = function () {
        return Promise.resolve('Stopped');
    };
    ;
    return NoOpVpnDevice;
}());
exports.NoOpVpnDevice = NoOpVpnDevice;

},{}],2:[function(require,module,exports){
/// <reference path='../../../third_party/cordova/splashscreen.d.ts'/>
/// <reference types="chrome/chrome-app" />
"use strict";
var uproxy_server_1 = require('./uproxy_server');
var cordova_core_connector_1 = require('./cordova_core_connector');
var tun2socks_vpn_device_1 = require('./tun2socks_vpn_device');
var vpn_device = require('../model/vpn_device');
console.debug('Background loaded into webview');
// https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API
function getLocalStorage() {
    try {
        var storage = window['localStorage'];
        var x = '__storage_test__';
        storage.setItem(x, x);
        storage.removeItem(x);

        return localStorage;
    }
    catch (e) {
        throw new Error('localStorage unavailable');
    }
}
// We save this reference to allow inspection of the context state from the browser debuggin tools.
window.context = this;
// TODO(fortuna): Get rid of core connector and talk to the core directly.
var corePromise = cordova_core_connector_1.MakeCoreConnector();
var ACCESS_CODE = "https://www.uproxy.org/invite/?v=2&networkName=Cloud&networkData=~'*7b*22host*22*3a*22188.166.131.247*22*2c*22user*22*3a*22getter*22*2c*22key*22*3a*22LS0tLS1CRUdJTiBSU0EgUFJJVkFURSBLRVktLS0tLQpNSUlEZlFJQkFBS0J3UUMrL3hNRkExQjVTeWVCaFRDMitZYVFQdUF3WllGVlRHd29QNVVXVTlLTVRiZTQrbStwCnZCbmYwQXlpNFJhclM2UVhpZFZ5QWR4V3ZWM0VzOUZhVmFGY1lia3dPa0RxcGZvakR3bjh5VDlqY2V2SklQOGYKRDVZczFWOCsrNkRKaWpTeG8xRUdBbU5veW1KRkFqdWk5VmVoMElrQWVKTlBHSHp4TFlXR05rSTBIeG1tT1RRdgppZWs0S3FIOUJZc2p6RGZ2aENqNUFQeWwxVlBaWDdmRGRUT2paWGR6SXJxUXZrbm8xdDFvWkdwWnJpZG1nLzhMCnJvRTVMUHMwc1c1UjY1TUNBd0VBQVFLQndCVGhsRFcvR0FRNnlEWHIxdGlhVFREbC91S3Jwa2txRXNVUHRuLzcKYUJCNHlyWkpndjIrbCtHVlFGeHFXVzBlMXZEUDIrc2I4dmYwdWhTd1NCb2xOSUFDR3huL3RHc3kvRGJyQlArRApEUkFWTzE4QTRZT0cwN2RSR0ptdEx2WDV5dnFNSnJwVk9kSS9pTWhIeWVFUjBlc29SenNSV3pTVGluL3l1NWM0CkxOdjJ4QW0xOVBJMmtHTVZsY2JjMXExb0txUEphRTJucUF5OUI1bFJNdUw2R09rdHBIa0ZuZ2FMWkxTbXl0QUsKUk5BYy9XbDNYQWFPdlFQNXFrZjN3UFdVSVFKaEFPMVUzYnc0TFU0UTQ2TlZMWjYzdGIwRjRJQ3hqbFNMOHJ4bApnb2VUWTdpV1dsbDI3Q3RYTTRDeG1yWmxiZVQwWkpPWGtYeERjbjV3MzdDYmZIdENKcmtWRTZFTVhsQmpKNHBHCko5ZWJmb2o0NU9nMWtnc3RQdm41eUI5RVp1cWVvd0poQU00RktPc2I2eW5LSkxVcDdEakdBdVkvM3psVmlKdU4KMHNwZkRrQkhlSXJFcWtZbU1VbGFCcm81bEFoNFpsYTNQU2V2dExZb29YaVEvdjJjNHVyVzZLUG9XOTF5THN4SwozbGJkbmlJWHZyOCtWWVZSUkR6bFVON1FYUUhZVTVEK1VRSmhBTmJWQjVLbFYzMWZGSEI1WGo1YUZZenhrUE50CnhtVUorY1JJTHd3Q2d6WklBNmtRV1dBeUkxRFBkRGkvUCtjTXd5NUcrVTcrenRsZDIxN0dvTHdDZVlMNGJUaFAKTmVDV29PZ3Q4VXJlV29BcXJTcjFzeW1pMzJyd2pCS2huSGVzK1FKZ0pxSnRFL24rVmEza3lGeCtRZjlRRitHdQplTkFEZURoV2FVRCtLU3U5L1RmNFBvTjNCcXh0U29yMXFjajZXQlN3MFRwd0J5RURkdHFxRnVGTzVIODh6VkFMCnVqRnBlVUlwQTkwM2hHa3ppaVdrWUFYbmFBd1E2RmZtdVN2YUwveWhBbUVBcVJwREphZWJPSDRnMGwzTDlPejgKT0pJR1NEUWpxK0U0Z1ZKZHdsc0crZVFnMks5eUxhNWxiSU9UR2U2YTJhRmtMa2t5RzVTSVFsbnRYaEpFU095TwpNNndiNFdnNjhkUFFxRmFTdXlRelpGeEUxZEkxYytHRjUwc2NXeDdFY1NpQwotLS0tLUVORCBSU0EgUFJJVkFURSBLRVktLS0tLQo*3d*22*7d";
var serversPromise = tun2socks_vpn_device_1.GetGlobalTun2SocksVpnDevice().then(function (vpnDevice) {
    console.debug('Device supports VPN');
    return vpnDevice;
}).catch(function (error) {
    console.error(error);
    return new vpn_device.NoOpVpnDevice();
}).then(function (vpnDevice) {
    return new uproxy_server_1.UproxyServerRepository(getLocalStorage(), corePromise, vpnDevice);
}).then(function (servers) {
    console.debug('Adding server');
    return servers.addServer(ACCESS_CODE);
}).then(function (server) {
    console.debug('Connecting to server');
    server.connect(function (msg) {
        console.log("disconnected: " + msg);
    });
});
// Create UI.
// let serversListPagePromise: Promise<ServerListPage> = new Promise((resolve, reject) => {
//   chrome.app.runtime.onLaunched.addListener(() => {
//     console.debug('Chrome onLaunched fired');
//     chrome.app.window.create('index_vulcanized.html', null, (appWindow) => {
//       console.debug('window created');
//       let document = appWindow.contentWindow.document;
//       document.addEventListener('DOMContentLoaded', function (event) {
//         console.debug('dom ready');
//         serversPromise.then((servers) => {
//           console.debug('servers ready');
//           resolve(new ServerListPage(appWindow.contentWindow.document.body, servers));
//         });
//       });
//     });
//   });
// });
// // Register for url intents.
// Promise.all([serversListPagePromise, intents.GetGlobalIntentInterceptor()]).then(
//   ([serverListPage, intentInterceptor]) => {
//     intentInterceptor.addIntentListener((url: string) => {
//       console.debug(`[App] Url: ${url}`);
//       serverListPage.enterAccessCode(url);
//     });
//     if (navigator.splashscreen) {
//       navigator.splashscreen.hide();
//     }
//   }
// );

},{"../model/vpn_device":1,"./cordova_core_connector":4,"./tun2socks_vpn_device":5,"./uproxy_server":6}],3:[function(require,module,exports){
"use strict";
function MakeCloudSocksProxy(corePromise, cloudTokens) {
    var coreAcceptedPromise = corePromise.then(function (core) {
        return core.acceptInvitation({
            network: {
                name: 'Cloud'
            },
            tokenObj: {
                networkData: cloudTokens,
            }
        }).then(function () {
            return core;
        });
    });
    return new CloudSocksProxy(coreAcceptedPromise, cloudTokens.host);
}
exports.MakeCloudSocksProxy = MakeCloudSocksProxy;
// A local Socks server that provides access to a remote uProxy Cloud server via RTC.
var CloudSocksProxy = (function () {
    // Constructs a server that will use the given CoreApi to start the local proxy.
    // It takes the IP address of the uProxy cloud server it will use for Internet access.
    function CloudSocksProxy(corePromise, remoteIpAddress) {
        this.corePromise = corePromise;
        this.remoteIpAddress = remoteIpAddress;
        this.instancePath = {
            network: {
                name: 'Cloud',
                userId: 'me'
            },
            userId: remoteIpAddress,
            instanceId: remoteIpAddress
        };
    }
    // Returns the IP address of the cloud server this proxy is connecting to.
    CloudSocksProxy.prototype.getRemoteIpAddress = function () {
        return this.remoteIpAddress;
    };
    CloudSocksProxy.prototype.start = function () {
        var _this = this;
        console.debug('Starting proxy');
        return this.corePromise.then(function (core) {
            return core.start(_this.instancePath);
        }).then(function (endpoint) {
            console.debug("Local Socks proxy running on port " + endpoint.port + ", talking to IP " + _this.remoteIpAddress);
            return endpoint.port;
        });
    };
    CloudSocksProxy.prototype.stop = function () {
        var _this = this;
        console.debug('Stopping proxy');
        return this.corePromise.then(function (core) {
            return core.stop(_this.instancePath);
        });
    };
    return CloudSocksProxy;
}());
exports.CloudSocksProxy = CloudSocksProxy;

},{}],4:[function(require,module,exports){
/**
 * cordova_core_connector.ts
 *
 * Runs in the UI context, proxying on() and emit() calls to the Freedom app in the
 * core context.
 */
"use strict";
var uproxy_core_api = require('../../interfaces/uproxy_core_api');
var core_connector_1 = require('../../generic_ui/scripts/core_connector');
;
;
console.log('Loading core');
// export var uProxyAppChannelPromise = //new Promise<freedom.OnAndEmit<any, any>>((F, R) => {});
exports.uProxyAppChannelPromise = freedom('generic_core/freedom-module.json', {
    'logger': 'lib/loggingprovider/freedom-module.json',
    'debug': 'debug',
    'portType': 'worker'
}).then(function (uProxyModuleFactory) {
    console.log('Core loading complete');
    return uProxyModuleFactory();
});
function MakeCoreConnector() {
    return exports.uProxyAppChannelPromise.then(function (channel) {
        var browserConnector = new CordovaCoreConnector(channel, { name: 'uproxy-ui-to-core-connector' });
        var core = new core_connector_1.default(browserConnector);
        return core.login({
            network: 'Cloud',
            loginType: uproxy_core_api.LoginType.INITIAL,
        }).then(function (loginResult) {
            console.debug("Logged in to Cloud network. userId: " + loginResult.userId + ", instanceId: " + loginResult.instanceId);
            return core;
        });
    });
}
exports.MakeCoreConnector = MakeCoreConnector;
var CordovaCoreConnector = (function () {
    function CordovaCoreConnector(appChannel, options) {
        var _this = this;
        this.appChannel = appChannel;
        this.options = options;
        this.onceConnected = new Promise(function (F, R) {
            _this.fulfillConnect = F;
        });
        // --- Connectivity methods ---
        /**
         * Connect the UI to the Freedom module.
         *
         * Returns a promise fulfilled upon connection.
         */
        this.connect = function () {
            console.log('CordovaCoreConnector.connect()');
            if (!_this.status.connected) {
                _this.fulfillConnect();
                _this.emit('core_connect');
                _this.status.connected = true;
            }
            return Promise.resolve();
        };
        // --- Communication ---
        /**
         * Attach handlers for updates emitted from the uProxy Core.
         */
        this.onUpdate = function (update, handler) {
            _this.onceConnected.then(function () {
                var type = '' + update;
                _this.appChannel.on(type, handler);
            });
        };
        /**
         * Send a payload to the Chrome app.  Only "emit" messages are allowed.
         * If currently connected to the App, immediately send. Otherwise, queue
         * the message until connection completes.
         * If skipQueue==true, payloads will not be enqueued disconnected.
         */
        this.send = function (payload, skipQueue) {
            if (skipQueue === void 0) { skipQueue = false; }
            if (payload.cmd !== 'emit') {
                throw new Error('send can only be used for emit');
            }
            if (skipQueue) {
                return;
            }
            _this.onceConnected.then(function () {
                _this.appChannel.emit('' + payload.type, { data: payload.data, promiseId: payload.promiseId });
            });
        };
        this.flushQueue = function () {
        };
        this.events = {};
        this.on = function (name, callback) {
            _this.events[name] = callback;
        };
        this.emit = function (name) {
            var args = [];
            for (var _i = 1; _i < arguments.length; _i++) {
                args[_i - 1] = arguments[_i];
            }
            if (name in _this.events) {
                _this.events[name].apply(null, args);
            }
        };
        this.status = { connected: false };
    }
    CordovaCoreConnector.prototype.restart = function () {
    };
    return CordovaCoreConnector;
}()); // class CordovaCoreConnector

},{"../../generic_ui/scripts/core_connector":7,"../../interfaces/uproxy_core_api":8}],5:[function(require,module,exports){
/// <reference path='../../../third_party/cordova/tun2socks.d.ts'/>
"use strict";
// A VpnDevice that routes the traffic through a Socks server that is running locally.
var Tun2SocksVpnDevice = (function () {
    function Tun2SocksVpnDevice(tun2socks) {
        var _this = this;
        this.tun2socks = tun2socks;
        this.onDisconnect = function () { };
        this.tun2socks.onDisconnect().then(function (msg) {
            _this.onDisconnect(msg);
        });
    }
    // TODO: What's the return string?
    Tun2SocksVpnDevice.prototype.start = function (port, onDisconnect) {
        this.onDisconnect = onDisconnect;
        // TODO: Is stop() called?
        return this.tun2socks.start("127.0.0.1:" + port);
    };
    // TODO: What's the return string?
    Tun2SocksVpnDevice.prototype.stop = function () {
        return this.tun2socks.stop();
    };
    return Tun2SocksVpnDevice;
}());
var globalTun2SocksVpnDevice = new Promise(function (resolve, reject) {
    if (!window.tun2socks) {
        reject('Device does not support VPN');
        return;
    }
    window.tun2socks.deviceSupportsPlugin().then(function (supportsVpn) {
        if (!supportsVpn) {
            reject("Device does not support VPN");
            return;
        }
        resolve(new Tun2SocksVpnDevice(window.tun2socks));
    }).catch(function (reason) {
        reject("Error calling window.tun2socks.deviceSupportsPlugin(): " + reason);
    });
});
function GetGlobalTun2SocksVpnDevice() {
    return globalTun2SocksVpnDevice;
}
exports.GetGlobalTun2SocksVpnDevice = GetGlobalTun2SocksVpnDevice;

},{}],6:[function(require,module,exports){
"use strict";
var uparams = require('uparams');
var jsurl = require('jsurl');
var cloud_socks_proxy_server_1 = require('./cloud_socks_proxy_server');
// A local Socks server that provides access to a remote uProxy Cloud server via RTC.
var UproxyServer = (function () {
    // Constructs a server that will use the given CoreApi to start the local proxy.
    // It takes the IP address of the uProxy cloud server it will use for Internet access.
    function UproxyServer(proxy, vpnDevice, remoteIpAddress) {
        this.proxy = proxy;
        this.vpnDevice = vpnDevice;
        this.remoteIpAddress = remoteIpAddress;
    }
    UproxyServer.prototype.getIpAddress = function () {
        return this.remoteIpAddress;
    };
    UproxyServer.prototype.connect = function (onDisconnect) {
        var _this = this;
        console.debug('Connecting to server');
        return this.proxy.start().then(function (port) {
            _this.vpnDevice.start(port, onDisconnect);
        });
    };
    UproxyServer.prototype.disconnect = function () {
        console.debug('Disconnecting from server');
        return Promise.all([this.proxy.stop(), this.vpnDevice.stop()]);
    };
    return UproxyServer;
}());
exports.UproxyServer = UproxyServer;
// Name by which servers are saved to storage.
var SERVERS_STORAGE_KEY = 'servers';
// Maintains a persisted set of servers and liases with the core.
var UproxyServerRepository = (function () {
    function UproxyServerRepository(storage,
        // Must already be logged into social networks.
        corePromise, vpnDevice) {
        this.storage = storage;
        this.corePromise = corePromise;
        this.vpnDevice = vpnDevice;
    }
    UproxyServerRepository.prototype.getServers = function () {
        var _this = this;
        var servers = this.loadServers();
        return Promise.all(Object.keys(servers).map(function (host) {
            return _this.createServer(servers[host].cloudTokens);
        }));
    };
    UproxyServerRepository.prototype.addServer = function (accessCode) {
        // This is inspired by ui.ts but note that uProxy Air only
        // supports v2 access codes which have just three fields:
        //  - v
        //  - networkName
        //  - networkData
        // TODO: accept only cloud access codes
        var params = uparams(accessCode);
        if (!(params || params.v ||
            params.networkName || params.networkData)) {
            throw new Error('could not decode URL');
        }
        var cloudTokens = JSON.parse(jsurl.parse(params.networkData));
        this.saveServer(cloudTokens);
        // TODO: only notify the core when connecting, and delete it afterwards
        return this.createServer(cloudTokens);
    };
    UproxyServerRepository.prototype.loadServers = function () {
        return JSON.parse(this.storage.getItem(SERVERS_STORAGE_KEY)) || {};
    };
    // Saves a server to storage, merging it with any already found there.
    // Returns true if the server was not already in storage.
    UproxyServerRepository.prototype.saveServer = function (cloudTokens) {
        var savedServers = this.loadServers();
        savedServers[cloudTokens.host] = {
            cloudTokens: cloudTokens
        };
        this.storage.setItem(SERVERS_STORAGE_KEY, JSON.stringify(savedServers));
    };
    UproxyServerRepository.prototype.createServer = function (cloudTokens) {
        var proxy = cloud_socks_proxy_server_1.MakeCloudSocksProxy(this.corePromise, cloudTokens);
        return new UproxyServer(proxy, this.vpnDevice, cloudTokens.host);
    };
    return UproxyServerRepository;
}());
exports.UproxyServerRepository = UproxyServerRepository;

},{"./cloud_socks_proxy_server":3,"jsurl":9,"uparams":11}],7:[function(require,module,exports){
/**
 * core_connector.ts
 *
 * Handles all connection and communication with the uProxy core.
 */
"use strict";
var uproxy_core_api = require('../../interfaces/uproxy_core_api');
;
/**
 * This class hides all cross backend-ui communication wiring so that the
 * uProxy UI may speak through this connector as if talking directly to Core.
 *
 * Propagates these messages:
 *    Core --[ UPDATES  ]--> UI
 *    UI   --[ COMMANDS ]--> Core
 */
var CoreConnector = (function () {
    function CoreConnector(browserConnector_) {
        var _this = this;
        this.browserConnector_ = browserConnector_;
        // Global unique promise ID.
        this.promiseId_ = 1;
        this.mapPromiseIdToFulfillAndReject_ = {};
        this.on = function (name, callback) {
            _this.browserConnector_.on(name, callback);
        };
        this.connect = function () {
            return _this.browserConnector_.connect();
        };
        this.connected = function () {
            return _this.browserConnector_.status.connected;
        };
        this.onUpdate = function (update, handler) {
            _this.browserConnector_.onUpdate(update, handler);
        };
        /**
         * Send a Command from the UI to the Core, as a result of some user
         * interaction.
         */
        this.sendCommand = function (command, data) {
            var payload = {
                cmd: 'emit',
                type: command,
                data: data,
                promiseId: 0
            };
            console.log('UI sending Command ' +
                JSON.stringify(payload));
            _this.browserConnector_.send(payload);
        };
        /**
         * Send a Command from the UI to the Core, as a result of some user
         * interaction.  Command returns a promise that fulfills/rejects upon
         * an ack/reject from the backend.
         */
        this.promiseCommand = function (command, data) {
            var promiseId = ++(_this.promiseId_);
            var payload = {
                cmd: 'emit',
                type: command,
                data: data,
                promiseId: promiseId
            };
            console.log('UI sending Promise Command ' + uproxy_core_api.Command[command], JSON.stringify(payload));
            // Create a new promise and store its fulfill and reject functions.
            var fulfillFunc;
            var rejectFunc;
            var promise = new Promise(function (F, R) {
                fulfillFunc = F;
                rejectFunc = R;
            });
            // TODO: we may want to periodically remove garbage from this table
            // e.g. if the app restarts, all promises should be removed or reject.
            // Also we may want to reject promises after some timeout.
            _this.mapPromiseIdToFulfillAndReject_[promiseId] = {
                fulfill: fulfillFunc,
                reject: rejectFunc
            };
            // Send request to backend.
            _this.browserConnector_.send(payload);
            return promise;
        };
        this.handleRequestFulfilled_ = function (data) {
            var promiseId = data.promiseId;
            console.log('promise command fulfilled ' + promiseId);
            if (_this.mapPromiseIdToFulfillAndReject_[promiseId]) {
                _this.mapPromiseIdToFulfillAndReject_[promiseId]
                    .fulfill(data.argsForCallback);
                delete _this.mapPromiseIdToFulfillAndReject_[promiseId];
            }
            else {
                console.warn('fulfill not found ' + promiseId);
            }
        };
        this.handleRequestRejected_ = function (data) {
            var promiseId = data.promiseId;
            console.log('promise command rejected ' + promiseId);
            if (_this.mapPromiseIdToFulfillAndReject_[promiseId]) {
                _this.mapPromiseIdToFulfillAndReject_[promiseId]
                    .reject(data.errorForCallback);
                delete _this.mapPromiseIdToFulfillAndReject_[promiseId];
            }
            else {
                console.warn('reject not found ' + promiseId);
            }
        };
        // --- CoreApi interface requirements (sending COMMANDS) ---
        this.getFullState = function () {
            return _this.promiseCommand(uproxy_core_api.Command.GET_FULL_STATE);
        };
        // TODO: Reconnect this hook, which while we're testing, sends a new instance
        // message anytime we click on the user in the UI.
        this.sendInstance = function (clientId) {
            _this.sendCommand(uproxy_core_api.Command.SEND_INSTANCE_HANDSHAKE_MESSAGE, clientId);
        };
        this.modifyConsent = function (command) {
            console.log('Modifying consent.', command);
            _this.sendCommand(uproxy_core_api.Command.MODIFY_CONSENT, command);
        };
        this.start = function (path) {
            console.log('Starting to proxy through ' + path);
            return _this.promiseCommand(uproxy_core_api.Command.START_PROXYING, path);
        };
        this.stop = function (path) {
            console.log('Stopping proxy session.');
            return _this.promiseCommand(uproxy_core_api.Command.STOP_PROXYING, path);
        };
        this.updateGlobalSettings = function (newSettings) {
            console.log('Updating global settings to ' + JSON.stringify(newSettings));
            _this.sendCommand(uproxy_core_api.Command.UPDATE_GLOBAL_SETTINGS, newSettings);
        };
        this.updateGlobalSetting = function (change) {
            _this.sendCommand(uproxy_core_api.Command.UPDATE_GLOBAL_SETTING, change);
        };
        this.login = function (loginArgs) {
            return _this.promiseCommand(uproxy_core_api.Command.LOGIN, loginArgs);
        };
        this.logout = function (networkInfo) {
            return _this.promiseCommand(uproxy_core_api.Command.LOGOUT, networkInfo);
        };
        this.inviteGitHubUser = function (data) {
            return _this.promiseCommand(uproxy_core_api.Command.INVITE_GITHUB_USER, data);
        };
        this.getInviteUrl = function (data) {
            return _this.promiseCommand(uproxy_core_api.Command.GET_INVITE_URL, data);
        };
        this.sendEmail = function (emailData) {
            _this.sendCommand(uproxy_core_api.Command.SEND_EMAIL, emailData);
        };
        this.restart = function () {
            _this.browserConnector_.restart();
        };
        this.getLogs = function () {
            return _this.promiseCommand(uproxy_core_api.Command.GET_LOGS);
        };
        this.getNatType = function () {
            return _this.promiseCommand(uproxy_core_api.Command.GET_NAT_TYPE);
        };
        this.getPortControlSupport = function () {
            return _this.promiseCommand(uproxy_core_api.Command.GET_PORT_CONTROL_SUPPORT);
        };
        this.checkReproxy = function (port) {
            return _this.promiseCommand(uproxy_core_api.Command.CHECK_REPROXY, port);
        };
        this.pingUntilOnline = function (pingUrl) {
            return _this.promiseCommand(uproxy_core_api.Command.PING_UNTIL_ONLINE, pingUrl);
        };
        this.getVersion = function () {
            return _this.promiseCommand(uproxy_core_api.Command.GET_VERSION);
        };
        this.acceptInvitation = function (data) {
            return _this.promiseCommand(uproxy_core_api.Command.ACCEPT_INVITATION, data);
        };
        this.cloudUpdate = function (args) {
            return _this.promiseCommand(uproxy_core_api.Command.CLOUD_UPDATE, args);
        };
        this.removeContact = function (args) {
            return _this.promiseCommand(uproxy_core_api.Command.REMOVE_CONTACT, args);
        };
        this.postReport = function (args) {
            return _this.promiseCommand(uproxy_core_api.Command.POST_REPORT, args);
        };
        this.verifyUser = function (inst) {
            return _this.promiseCommand(uproxy_core_api.Command.VERIFY_USER, inst);
        };
        this.finishVerifyUser = function (args) {
            return _this.promiseCommand(uproxy_core_api.Command.VERIFY_USER_SAS, args);
        };
        this.browserConnector_.onUpdate(uproxy_core_api.Update.COMMAND_FULFILLED, this.handleRequestFulfilled_);
        this.browserConnector_.onUpdate(uproxy_core_api.Update.COMMAND_REJECTED, this.handleRequestRejected_);
        this.connect();
    }
    return CoreConnector;
}());
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = CoreConnector; // class CoreConnector

},{"../../interfaces/uproxy_core_api":8}],8:[function(require,module,exports){
"use strict";
(function (UserFeedbackType) {
    UserFeedbackType[UserFeedbackType["USER_INITIATED"] = 0] = "USER_INITIATED";
    UserFeedbackType[UserFeedbackType["PROXYING_FAILURE"] = 1] = "PROXYING_FAILURE";
    UserFeedbackType[UserFeedbackType["CLOUD_CONNECTIONS_DISCONNECTED"] = 2] = "CLOUD_CONNECTIONS_DISCONNECTED";
    UserFeedbackType[UserFeedbackType["CLOUD_SERVER_NO_CONNECT"] = 3] = "CLOUD_SERVER_NO_CONNECT";
    UserFeedbackType[UserFeedbackType["CLOUD_SERVER_NO_START"] = 4] = "CLOUD_SERVER_NO_START";
    UserFeedbackType[UserFeedbackType["TROUBLE_SIGNING_IN"] = 5] = "TROUBLE_SIGNING_IN";
    UserFeedbackType[UserFeedbackType["NO_FRIENDS"] = 6] = "NO_FRIENDS";
    UserFeedbackType[UserFeedbackType["TROUBLE_STARTING_CONNECTION"] = 7] = "TROUBLE_STARTING_CONNECTION";
    UserFeedbackType[UserFeedbackType["DISCONNECTED_FROM_FRIEND"] = 8] = "DISCONNECTED_FROM_FRIEND";
    UserFeedbackType[UserFeedbackType["OTHER_FEEDBACK"] = 9] = "OTHER_FEEDBACK";
})(exports.UserFeedbackType || (exports.UserFeedbackType = {}));
var UserFeedbackType = exports.UserFeedbackType;
exports.FEATURE_VERIFY = 'verify';
// --- Communications ---
// Commands are sent from the UI to the Core due to a user interaction.
// This fully describes the set of commands that Core must respond to.
//
// Enum value names should be verb phrases that clearly describe the action
// being requested.
//
// TODO: Finalize which of these can be removed, then clean up accordingly.
(function (Command) {
    Command[Command["GET_INITIAL_STATE_DEPRECATED_0_8_10"] = 1000] = "GET_INITIAL_STATE_DEPRECATED_0_8_10";
    Command[Command["RESTART"] = 1001] = "RESTART";
    Command[Command["LOGIN"] = 1002] = "LOGIN";
    Command[Command["LOGOUT"] = 1003] = "LOGOUT";
    Command[Command["SEND_INSTANCE_HANDSHAKE_MESSAGE"] = 1004] = "SEND_INSTANCE_HANDSHAKE_MESSAGE";
    Command[Command["START_PROXYING"] = 1005] = "START_PROXYING";
    Command[Command["STOP_PROXYING"] = 1006] = "STOP_PROXYING";
    Command[Command["MODIFY_CONSENT"] = 1007] = "MODIFY_CONSENT";
    Command[Command["SEND_CREDENTIALS"] = 1014] = "SEND_CREDENTIALS";
    Command[Command["UPDATE_GLOBAL_SETTINGS"] = 1015] = "UPDATE_GLOBAL_SETTINGS";
    Command[Command["GET_LOGS"] = 1016] = "GET_LOGS";
    Command[Command["GET_NAT_TYPE"] = 1017] = "GET_NAT_TYPE";
    Command[Command["PING_UNTIL_ONLINE"] = 1018] = "PING_UNTIL_ONLINE";
    Command[Command["GET_FULL_STATE"] = 1019] = "GET_FULL_STATE";
    Command[Command["GET_VERSION"] = 1020] = "GET_VERSION";
    Command[Command["HANDLE_CORE_UPDATE"] = 1021] = "HANDLE_CORE_UPDATE";
    Command[Command["REFRESH_PORT_CONTROL"] = 1022] = "REFRESH_PORT_CONTROL";
    Command[Command["CREDENTIALS_ERROR"] = 1023] = "CREDENTIALS_ERROR";
    Command[Command["GET_INVITE_URL"] = 1025] = "GET_INVITE_URL";
    Command[Command["SEND_EMAIL"] = 1026] = "SEND_EMAIL";
    Command[Command["ACCEPT_INVITATION"] = 1027] = "ACCEPT_INVITATION";
    Command[Command["INVITE_GITHUB_USER"] = 1028] = "INVITE_GITHUB_USER";
    Command[Command["CLOUD_UPDATE"] = 1029] = "CLOUD_UPDATE";
    Command[Command["UPDATE_ORG_POLICY"] = 1030] = "UPDATE_ORG_POLICY";
    Command[Command["REMOVE_CONTACT"] = 1031] = "REMOVE_CONTACT";
    Command[Command["POST_REPORT"] = 1032] = "POST_REPORT";
    Command[Command["VERIFY_USER"] = 1033] = "VERIFY_USER";
    Command[Command["VERIFY_USER_SAS"] = 1034] = "VERIFY_USER_SAS";
    Command[Command["GET_PORT_CONTROL_SUPPORT"] = 1035] = "GET_PORT_CONTROL_SUPPORT";
    Command[Command["UPDATE_GLOBAL_SETTING"] = 1036] = "UPDATE_GLOBAL_SETTING";
    Command[Command["CHECK_REPROXY"] = 1037] = "CHECK_REPROXY";
})(exports.Command || (exports.Command = {}));
var Command = exports.Command;
// Updates are sent from the Core to the UI, to update state that the UI must
// expose to the user.
(function (Update) {
    Update[Update["INITIAL_STATE_DEPRECATED_0_8_10"] = 2000] = "INITIAL_STATE_DEPRECATED_0_8_10";
    Update[Update["NETWORK"] = 2001] = "NETWORK";
    Update[Update["USER_SELF"] = 2002] = "USER_SELF";
    Update[Update["USER_FRIEND"] = 2003] = "USER_FRIEND";
    Update[Update["COMMAND_FULFILLED"] = 2005] = "COMMAND_FULFILLED";
    Update[Update["COMMAND_REJECTED"] = 2006] = "COMMAND_REJECTED";
    Update[Update["START_GIVING_TO_FRIEND"] = 2009] = "START_GIVING_TO_FRIEND";
    Update[Update["STOP_GIVING_TO_FRIEND"] = 2010] = "STOP_GIVING_TO_FRIEND";
    // TODO: "Get credentials" is a command, not an "update". Consider
    // renaming the "Update" enum.
    Update[Update["GET_CREDENTIALS"] = 2012] = "GET_CREDENTIALS";
    Update[Update["LAUNCH_UPROXY"] = 2013] = "LAUNCH_UPROXY";
    Update[Update["SIGNALLING_MESSAGE"] = 2014] = "SIGNALLING_MESSAGE";
    Update[Update["START_GETTING"] = 2015] = "START_GETTING";
    Update[Update["START_GIVING"] = 2017] = "START_GIVING";
    Update[Update["STOP_GIVING"] = 2018] = "STOP_GIVING";
    Update[Update["STATE"] = 2019] = "STATE";
    Update[Update["FAILED_TO_GIVE"] = 2020] = "FAILED_TO_GIVE";
    Update[Update["CORE_UPDATE_AVAILABLE"] = 2024] = "CORE_UPDATE_AVAILABLE";
    Update[Update["PORT_CONTROL_STATUS"] = 2025] = "PORT_CONTROL_STATUS";
    // Payload is a string, obtained from the SignalBatcher in uproxy-lib.
    Update[Update["ONETIME_MESSAGE"] = 2026] = "ONETIME_MESSAGE";
    // Deprecated: CLOUD_INSTALL_STATUS = 2027,
    Update[Update["REMOVE_FRIEND"] = 2028] = "REMOVE_FRIEND";
    // Deprecated: CLOUD_INSTALL_PROGRESS = 2029,
    Update[Update["REFRESH_GLOBAL_SETTINGS"] = 2030] = "REFRESH_GLOBAL_SETTINGS";
    Update[Update["REPROXY_ERROR"] = 2031] = "REPROXY_ERROR";
    Update[Update["REPROXY_WORKING"] = 2032] = "REPROXY_WORKING";
})(exports.Update || (exports.Update = {}));
var Update = exports.Update;
// Action taken by the user. These values are not on the wire. They are passed
// in messages from the UI to the core. They correspond to the different
// buttons that the user may be clicking on.
(function (ConsentUserAction) {
    // Actions made by user w.r.t. remote as a proxy
    ConsentUserAction[ConsentUserAction["REQUEST"] = 5000] = "REQUEST";
    ConsentUserAction[ConsentUserAction["CANCEL_REQUEST"] = 5001] = "CANCEL_REQUEST";
    ConsentUserAction[ConsentUserAction["IGNORE_OFFER"] = 5002] = "IGNORE_OFFER";
    ConsentUserAction[ConsentUserAction["UNIGNORE_OFFER"] = 5003] = "UNIGNORE_OFFER";
    // Actions made by user w.r.t. remote as a client
    ConsentUserAction[ConsentUserAction["OFFER"] = 5100] = "OFFER";
    ConsentUserAction[ConsentUserAction["CANCEL_OFFER"] = 5101] = "CANCEL_OFFER";
    ConsentUserAction[ConsentUserAction["IGNORE_REQUEST"] = 5102] = "IGNORE_REQUEST";
    ConsentUserAction[ConsentUserAction["UNIGNORE_REQUEST"] = 5103] = "UNIGNORE_REQUEST";
})(exports.ConsentUserAction || (exports.ConsentUserAction = {}));
var ConsentUserAction = exports.ConsentUserAction;
(function (LoginType) {
    LoginType[LoginType["INITIAL"] = 0] = "INITIAL";
    LoginType[LoginType["RECONNECT"] = 1] = "RECONNECT";
    LoginType[LoginType["TEST"] = 2] = "TEST";
})(exports.LoginType || (exports.LoginType = {}));
var LoginType = exports.LoginType;
;
;
;
;
(function (PortControlSupport) {
    PortControlSupport[PortControlSupport["PENDING"] = 0] = "PENDING";
    PortControlSupport[PortControlSupport["TRUE"] = 1] = "TRUE";
    PortControlSupport[PortControlSupport["FALSE"] = 2] = "FALSE";
})(exports.PortControlSupport || (exports.PortControlSupport = {}));
var PortControlSupport = exports.PortControlSupport;
;
(function (ReproxyCheck) {
    ReproxyCheck[ReproxyCheck["PENDING"] = 0] = "PENDING";
    ReproxyCheck[ReproxyCheck["TRUE"] = 1] = "TRUE";
    ReproxyCheck[ReproxyCheck["FALSE"] = 2] = "FALSE";
    ReproxyCheck[ReproxyCheck["UNCHECKED"] = 3] = "UNCHECKED";
})(exports.ReproxyCheck || (exports.ReproxyCheck = {}));
var ReproxyCheck = exports.ReproxyCheck;
;
(function (CloudOperationType) {
    CloudOperationType[CloudOperationType["CLOUD_INSTALL"] = 0] = "CLOUD_INSTALL";
})(exports.CloudOperationType || (exports.CloudOperationType = {}));
var CloudOperationType = exports.CloudOperationType;
;
;
;
;

},{}],9:[function(require,module,exports){
module.exports = require('./lib/jsurl');
},{"./lib/jsurl":10}],10:[function(require,module,exports){
/**
 * Copyright (c) 2011 Bruno Jouhier <bruno.jouhier@sage.com>
 *
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following
 * conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 * OTHER DEALINGS IN THE SOFTWARE.
 */
//
(function(exports) {
  "use strict";
  exports.stringify = function stringify(v) {
    function encode(s) {
      return !/[^\w-.]/.test(s) ? s : s.replace(/[^\w-.]/g, function(ch) {
        if (ch === '$') return '!';
        ch = ch.charCodeAt(0);
        // thanks to Douglas Crockford for the negative slice trick
        return ch < 0x100 ? '*' + ('00' + ch.toString(16)).slice(-2) : '**' + ('0000' + ch.toString(16)).slice(-4);
      });
    }

    var tmpAry;

    switch (typeof v) {
      case 'number':
        return isFinite(v) ? '~' + v : '~null';
      case 'boolean':
        return '~' + v;
      case 'string':
        return "~'" + encode(v);
      case 'object':
        if (!v) return '~null';

        tmpAry = [];

        if (Array.isArray(v)) {
          for (var i = 0; i < v.length; i++) {
            tmpAry[i] = stringify(v[i]) || '~null';
          }

          return '~(' + (tmpAry.join('') || '~') + ')';
        } else {
          for (var key in v) {
            if (v.hasOwnProperty(key)) {
              var val = stringify(v[key]);

              // skip undefined and functions
              if (val) {
                tmpAry.push(encode(key) + val);
              }
            }
          }

          return '~(' + tmpAry.join('~') + ')';
        }
      default:
        // function, undefined
        return;
    }
  };

  var reserved = {
    "true": true,
    "false": false,
    "null": null
  };

  exports.parse = function(s) {
    if (!s) return s;
    s = s.replace(/%27/g, "'");
    var i = 0,
      len = s.length;

    function eat(expected) {
      if (s.charAt(i) !== expected) throw new Error("bad JSURL syntax: expected " + expected + ", got " + (s && s.charAt(i)));
      i++;
    }

    function decode() {
      var beg = i,
        ch, r = "";
      while (i < len && (ch = s.charAt(i)) !== '~' && ch !== ')') {
        switch (ch) {
          case '*':
            if (beg < i) r += s.substring(beg, i);
            if (s.charAt(i + 1) === '*') r += String.fromCharCode(parseInt(s.substring(i + 2, i + 6), 16)), beg = (i += 6);
            else r += String.fromCharCode(parseInt(s.substring(i + 1, i + 3), 16)), beg = (i += 3);
            break;
          case '!':
            if (beg < i) r += s.substring(beg, i);
            r += '$', beg = ++i;
            break;
          default:
            i++;
        }
      }
      return r + s.substring(beg, i);
    }

    return (function parseOne() {
      var result, ch, beg;
      eat('~');
      switch (ch = s.charAt(i)) {
        case '(':
          i++;
          if (s.charAt(i) === '~') {
            result = [];
            if (s.charAt(i + 1) === ')') i++;
            else {
              do {
                result.push(parseOne());
              } while (s.charAt(i) === '~');
            }
          } else {
            result = {};
            if (s.charAt(i) !== ')') {
              do {
                var key = decode();
                result[key] = parseOne();
              } while (s.charAt(i) === '~' && ++i);
            }
          }
          eat(')');
          break;
        case "'":
          i++;
          result = decode();
          break;
        default:
          beg = i++;
          while (i < len && /[^)~]/.test(s.charAt(i)))
          i++;
          var sub = s.substring(beg, i);
          if (/[\d\-]/.test(ch)) {
            result = parseFloat(sub);
          } else {
            result = reserved[sub];
            if (typeof result === "undefined") throw new Error("bad value keyword: " + sub);
          }
      }
      return result;
    })();
  }
})(typeof exports !== 'undefined' ? exports : (window.JSURL = window.JSURL || {}));
},{}],11:[function(require,module,exports){
/**/ void function(scope) {
/**/
/**/   // CommonJS
/**/   if (typeof module === 'object' && !!module.exports) return scope(function(name, dependencies, factory) {
/**/     if(factory === void 0) factory = dependencies, dependencies = [];
/**/     var args;
/**/     args = [  ];
/**/     module.exports = factory.apply(module.exports, args) || module.exports;
/**/   });
/**/
/**/   // AMD, wrap a 'String' to avoid warn of fucking webpack
/**/   if (String(typeof define) === 'function' && !!define.amd) return scope(define);
/**/
/**/   // Global
/**/   scope(function(name, dependencies, factory) {
/**/     if(factory === void 0) factory = dependencies, dependencies = [];
/**/     /**/ try { /* Fuck IE8- */
/**/     /**/   if(typeof execScript === 'object') execScript('var ' + name);
/**/     /**/ } catch(error) {}
/**/     window[name] = {};
/**/     var args = [];
/**/     for(var i = 0; i < dependencies.length; i++) args[i] = window[dependencies[i]];
/**/     window[name] = factory.apply(window[name], args) || window[name];
/**/   });
/**/
/**/ }(function(define) {

'use strict';

define('UParams', function() {

  // To check special keys
  var isSpecialKey = RegExp.prototype.test.bind(/^(?:toString|valueOf)$/);

  // Main Constructor
  var UParams = function(target) {
    // Auto new
    if (!(this instanceof UParams)) return new UParams(target);
    // Default parameter
    if (!target) target = location.search + location.hash;
    var that = this;
    switch (typeof target) {
      case 'object':
        // Copy properties from target
        for (var i in target) {
          if (!isSpecialKey(i)) that[i] = target[i] + '';
        }
        break;
      case 'string':
        // Match parameters
        target.replace(/([^=?#&]*)=([^?#&]*)/g, function(e, $1, $2) {
          if (!isSpecialKey($1)) that[decodeURIComponent($1)] = decodeURIComponent($2);
        });
    }
  };

  // Define the hidden toString method
  Object.defineProperty(UParams.prototype, 'toString', {
    enumerable: false,
    configurable: true,
    writable: true,
    value: function() {
      var that = this;
      // Join to a http query string
      return Object.keys(that).map(function(key) {
        return encodeURIComponent(key) + '=' + encodeURIComponent(that[key]);
      }).join('&');
    }
  });

  return UParams;

});

/**/ });

},{}]},{},[2])(2)
});
