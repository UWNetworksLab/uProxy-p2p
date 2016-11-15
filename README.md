# uProxy

[uProxy](https://www.uproxy.org) is a browser extension that lets users share their internet connection.

## Status

[![Slack Status](https://uproxy-slack.herokuapp.com/badge.svg)](https://uproxy-slack.herokuapp.com/)
[![Travis Status](https://travis-ci.org/uProxy/uproxy.svg?branch=dev)](https://travis-ci.org/uProxy/uproxy)

Please read the [uProxy Coding Guide](https://docs.google.com/document/d/12RfgwSLnEm-X5Knj1xFVGpp-MH7BdWjuzzo_g7xabro/edit) to learn more about contributing to uProxy. For a high level technical overview of uProxy, see the [uProxy Design Doc](https://docs.google.com/document/d/1t_30vX7RcrEGuWwcg0Jub-HiNI0Ko3kBOyqXgrQN3Kw/edit#).

## Tools

uProxy is built using the following tools:
 - [Grunt](http://gruntjs.com/) to write the tasks that build uProxy
 - [TypeScript](http://www.typescriptlang.org/) as the primary language we code in; this compiles to JavaScript. It gives us type-checking and has some syntax improvements on JS, while letting us incrementally migrate and easily include external JS packages and frameworks.
 - [Jasmine](http://jasmine.github.io/) for testing
 - [Polymer](http://www.polymer-project.org/) for UI
 - [Travis](https://travis-ci.org/) for continuous integration

To manage dependencies we use:
 - [npm](https://www.npmjs.org/) to install node modules that we use for our build process.  (Specified in `package.json`)
 - [Bower](http://bower.io) to install libraries that we use in the UI
   (specified in `bower.json`) including Polymer.

## Build

### Prerequisites

 * [Yarn](https://yarnpkg.com/en/docs/install). If you have npm, you can install with `npm install -g --production yarn`.
 * [grunt-cli](https://www.npmjs.com/package/grunt-cli) (once you've installed NPM, simply execute `yarn global add --prod grunt-cli`)

### Building

First, to install required NPMs and configure the `build/` directory for TypeScript compilation, execute:
```bash
yarn
```

Then, to compile the TypeScript code and build uProxy and all of the demo apps, execute:
```bash
grunt
```

Having problems? To clean up from a partial, broken, or extremely out-dated build, try executing this command before repeating the above steps:
```bash
yarn run clean
```

### IDE

[Visual Studio Code](https://code.visualstudio.com/) supports TypeScript compilation, search, and refactoring out of the box - just point it at the directory containing your uProxy clone.


## Run

### uProxy

#### Chrome

These are the steps to try uProxy in the Chrome browser.

- In Chrome, go to `chrome://extensions`, make sure 'Developer mode' is enabled
- Click 'Load unpacked extension...' and select `build/src/chrome/app`
- Click 'Load unpacked extension...' and select `build/src/chrome/extension`

You need both the uProxy Chrome App and the uProxy Extension.

You can use `grunt build_chrome` from the root directory of the repository to re-compile just Chrome components.

#### Firefox

These are the steps to try uProxy in the Firefox browser.

- To run the add-on you need to have the Firefox add-on SDK installed.
Instructions can be found here: https://developer.mozilla.org/en-US/Add-ons/SDK/Tutorials/Installation
    - A quick way to get started is to download/extract the zip mentioned in "Prerequisites"

- Run `cd build/src/firefox`

- Run `cfx run` and Firefox should launch with the uProxy add-on installed

You can use `grunt build_firefox` from the root directory of the repository to compile just Firefox comonents.

### Demo apps

These can be found at `build/src/samples/`. They are a mix of web sites, browser extensions (Chrome and Firefox), and Node.js apps.

To run web apps:
 * start a webserver, e.g. `python -m SimpleHTTPServer`
 * open the relevant HTML file in your browser, e.g. http://localhost:8000/build/src/samples/simple-freedom-chat/main.html.

To run Chrome apps:
 - open `chrome://extensions`, enable check Developer Mode, and load the unpacked extension from the relevant directory, e.g. `build/src/samples/simple-socks-chromeapp/`.

To run Firefox add-ons:
- install [jpm](https://developer.mozilla.org/en-US/Add-ons/SDK/Tools/jpm) via NPM, e.g. `yarn install jpm -g`, `cd` to the relevant directory, e.g. `build/src/samples/simple-socks-firefoxapp/`, and execute ``jpm run -b `which firefox` ``.

To run Node.js apps:
 - Directly run `node` with the entry point, e.g. `node build/src/samples/zork-node/index.js`

**Note: until freedom-for-node supports core.rtcpeerconnection, this sample will not work**

More on the demo apps themselves:

 * **simple-freedom-chat** is a WebRTC-powered chat client, with both peers on the same page. This is the simplest possible demo `src/peerconnection`.
 * **copypaste-freedom-chat** is the simplest possible, distributed, `src/peerconnection` demo in which text boxes
act as the signalling channel between two peers. Messages can be exchanged by
email, IM, shared doc, etc.
 * **echo-server** starts a TCP echo server on port 9998. Run `telnet 127.0.0.1 9998` and then
type some stuff to verify that echo server echoes what you send it. Press ctrl-D to have the echo server terminate the connection or press `ctrl-]` then type `quit` to exit telnet.
 * **Simple SOCKS** is the simplest possible, single-page, demo of the SOCKS proxy (`socks-to-rtc` and
`rtc-to-net` directories). This command may be used to test the proxy: `curl -x socks5h://localhost:9999 www.example.com` (`-h` indicates that DNS requests are made through the proxy too)
 * **Zork** is a distributed SOCKS proxy with a telnet-based signalling channel, intended for use with [our Docker-based integration testing](https://github.com/uProxy/uproxy-docker). Try connecting to Zork with `telnet localhost 9000`.
 * **uProbe** guess-timates your NAT type.
 * **copypaste-socks** is a distributed SOCKS proxy demo. This is essentially uProxy without any social network integration.
 * **simple-churn-chat** is just like simple-freedom-chat, except WebRTC traffic between the two peers is obfuscated. Wireshark may be used to verify that the traffic is obfuscated; the endpoints in use - along with a lot of debugging information - may be determined by examining the Javascript console.
 * **copypaste-freedom-chat** is just like copypaste-fredom-chat, except WebRTC traffic between the two peers is obfuscated.

### Development and re-building uProxy

uProxy uses the Grunt build system for its build tasks. Here is a list
of uProxy's Grunt commands:

 *  `build` - Builds everything, making stuff in the `build` directory (and runs tests).
   *  `build_chrome` - Build Chrome app and extension
     *  `build_chrome_app` - Build just Chrome app
     *  `build_chrome_ext` - Build just Chrome extension
   *  `build_firefox` - Build just Firefox
 *  `dist` - Generates distribution files, including the Firefox xpi
 *  `clean` - Cleans up
 *  `test` - Run unit tests
 *  `integration_test` - Run integration tests
 *  `everything` - 'build', 'test' and then 'integration_test'

The easiest way to stay current is to pull changes, run `grunt build` to build
your distribution, and re-run as you make changes to the files.

Before submitting any changes to the repository, make sure to run `grunt test`
to make sure it passes all unit tests. Failing tests are enough to immediately
reject submissions. :)

## uProxy for Mobile

The development for mobile platforms uses the Cordova Chrome Apps (CCA) tool, also known as the [Chrome Apps for Mobile Toolchain](https://github.com/MobileChromeApps/mobile-chrome-apps). You can find the platform-specific information below:

* [Android Development](https://github.com/uProxy/uproxy/wiki/Android-Development)

## Layout of files

Configuration and setup files
 * `Gruntfile.js` a file that specifies common tasks, e.g. how to build and package uProxy.
 * `bower.json` specifies dependent libraries from Bower.
 * `package.json` specifies dependent libraries from NPM.
 * `.gitignore` what git should ignore
 * `.bowerrc` tells bower where to put files
 * `.travis.yml` Travis auto-testing
 * `tools` directory contains some typescript and javascript to help Grunt.
 * `third_party/tsd.json` specifies the typescript definitions to use

Source code
 * `src` holds all source code; no compiled files
 * `src/generic_ui` generic user interface code
 * `src/generic_core` generic uproxy core-functionality code
 * `src/chrome/app` code specific to the chrome app
 * `src/chrome/extension` code specific to the chrome extension
 * `src/firefox` code specific to firefox
 * `third_party` holds external libraries we depend on that are copied into this repository
 * `node_modules` dynamically generated npm module dependencies
 * `scraps` temporary holding for sharing scraps of code

Dynamically created directories (`grunt clean` should remove them)
 * `build` created by grunt tasks; holds the built code, but none of the code that was compiled.
 * `build/dist` created by grunt tasks; holds final distribution versions
 * `.grunt` holds grunt cache stuff
 * `.tscache` holds typescript cache stuff
