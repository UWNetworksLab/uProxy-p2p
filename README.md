# uProxy

[uProxy](uproxy.org) is a browser extension that lets users share their internet connection.

## Build Status

Dev: [![Build Status](https://travis-ci.org/uProxy/uproxy.svg?branch=dev)](https://travis-ci.org/uProxy/uproxy)
[![Build Status](https://api.shippable.com/projects/54c823bf5ab6cc135289fbdc/badge?branchName=dev)](https://app.shippable.com/projects/54c823bf5ab6cc135289fbdc/builds/latest)
Master: [![Build Status](https://travis-ci.org/uProxy/uproxy.svg?branch=master)](https://travis-ci.org/uProxy/uproxy)

## Tools

uProxy is built using the following tools:
 - [Grunt](http://gruntjs.com/) to write the tasks that build uProxy
 - [TypeScript](http://www.typescriptlang.org/) as the primary language we code in; this compiles to JavaScript. It gives us type-checking and has some syntax improvements on JS, while letting us incrementally migrate and easily include external JS packages and frameworks.
 - [Jasmine](http://pivotal.github.io/jasmine/) for testing
 - [Polymer](http://www.polymer-project.org/) for UI
 
To manage dependencies we use:
 - [npm](https://www.npmjs.org/) for installing node modules that we use for our build process.  (Specified in `package.json`)
 - [Bower](http://bower.io) to install libraries that we use in the UI
   (specified in `bower.json`) including AngularJS.


## Development setup

Please read the [uProxy Coding Guide](https://docs.google.com/document/d/12RfgwSLnEm-X5Knj1xFVGpp-MH7BdWjuzzo_g7xabro/edit) to learn more about contributing to uProxy. 

### Pre-Requirements to build uProxy

Note: you will either need to run these as root, or set the directories they
modify (`/usr/local`) to being editable by your user (sudo chown -R $USER /usr/local)

- [node](http://nodejs.org/) and npm (Node's package manager):

    - On Mac with Brew, you can do: `brew install node` (You may need to update your brew package manager, e.g. `brew update`). You can also install directly from a Mac package off the [NodeJS Website](http://nodejs.org/).

    - On Ubuntu, you can do `apt-get install nodejs`.
    - We also need to create symlink ( if we are not running legacy node) <br>
      Use this: <br>
      ln -s /usr/bin/nodejs /usr/bin/node 

    - On Archlinux, you can do 'pacman -S nodejs'.

    - You may need to set your `$NODE_PATH` environment variable appropriately
      (e.g. it might be: `/usr/local/share/npm/lib/node_modules`).

    - If you install npm things globally, you'll need to do so as the
      appropriate super-user.

    - To run binaries from globally-installed npm packages without
      fully-qualifying paths, make sure you have added your npm bin directory to your path (e.g. `export PATH=$PATH:/usr/local/share/npm/bin/grunt`).

- [Grunt](http://gruntjs.com/): Install globally with `npm install -g grunt-cli`

### Building uProxy from source

 1. Clone uProxy and its submodules (and its submodules' submodules...): `git clone https://github.com/uProxy/uProxy.git` or `git clone git@github.com:uProxy/uproxy.git` if you have your ssh access to github set up (useful if you use 2-step auth for github, which you should do).

 1. In the root uProxy directory, run:
   * `npm install` - this will install all node npm module development dependencies; you'll see lots of npm messages. (watch out for errors; sometimes npm module installation is broken, downloads fail etc).  This will also install the static content dependencies (mostly Polymer components).
   * `./setup.sh install` - this will set up build tools and third-party dependencies.
   * `grunt` - this will build everything, including uProxy for Chrome and Firefox.

Note that if any local dependencies have changed (i.e. changes to bower dependencies, updates to FreeDOM), you will have to run `npm update` and/or `bower install` to update these dependencies, then rerun `grunt`

### Installing and running

*Please don’t submit uProxy to the Chrome Web Store or Firefox Marketplace*. uProxy is under active development and the team takes its responsibility to provide security very seriously; we don’t want at-risk groups that may not be technically sophisticated — journalists, human-rights workers, et al — to rely on uProxy until we feel it’s ready. Prematurely making uProxy available could have very serious real world ramifications. Before we release uProxy to the browser stores, we want the source code examined and reviewed so that the community as a whole can help us make sure that we haven’t overlooked anything in our implementation. Once we feel that uProxy is ready, we will release it via the browser web stores ourselves.

#### Chrome

These are the steps to try uProxy in the Chrome browser.

- In Chrome, go to `chrome://extensions`, make sure 'Developer mode' is enabled
- Click 'Load unpacked extension...' and select `build/dev/chrome/app`
- Click 'Load unpacked extension...' and select `build/dev/chrome/extension`

You need both the uProxy Chrome App and the uProxy Extension.

You can use `grunt build_chrome` from the root directory of the repository to re-compile just Chrome components.

#### Firefox

These are the steps to try uProxy in the Firefox browser.

- To run the add-on you need to have the Firefox add-on SDK installed.
Instructions can be found here: https://developer.mozilla.org/en-US/Add-ons/SDK/Tutorials/Installation
    - A quick way to get started is to download/extract the zip mentioned in "Prerequisites"

- Run `cd build/dev/firefox`

- Run `cfx run` and Firefox should launch with the uProxy add-on installed

You can use `grunt build_firefox` from the root directory of the repository to compile just Firefox comonents.


#### Starting two instances of Chrome on the same machine

To test proxying without using multiple computers, you can launch two separate instances of Chrome (specifying different directories for user-data-dir).  To launch a new instance of Chrome on Mac, run:
```"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --user-data-dir=${DIR_NAME}/.chrome-beta-test-user```
where DIR_NAME is set to the name of a directory where you want to store custom chrome profiles, e.g. `/tmp/`.

In each instance of Chrome, load the uProxy app and extension as describe above. 

You can also test between one instance of Chrome and one instance in Firefox. 

Then in each instance, within uProxy, sign into Google with gmail accounts that have already added each other as contacts.  After sign-in both contacts should be visible on each other's roster.  Once proxying is started in the UI, try visiting any web page from the client's Chrome window.  To verify that traffic is actually being proxied, open the debug console for the server's uProxy Chrome App. You should see traces indicating the flow of traffic through the proxy.

### Development and re-building uProxy

uProxy uses the Grunt build system for its build tasks. Here is a list
of uProxy's Grunt commands:

 *  `build` - Builds everything, making stuff in the `build` directory (and runs tests).
   *  `build_chrome` - Build Chrome app and extension
   *  `build_chrome_app` - Build just Chrome app
   *  `build_chrome_extension` - Build just Chrome extension
   *  `build_firefox` - Build just Firefox
   *  `build_uistatic` - Build the static UI.
 *  `clean` - Cleans up
 *  `watch` - Watch for changes and recompile as needed.
 *  `test` - Run unit tests
 *  `xpi` - Generates an .xpi for installation to Firefox.
 *  `run_uistatic` - Run the standalone UI on a local webserver.
 *  `everything` - 'test', then 'build'

The easiest way to stay current is to pull changes, run `grunt build` to build
your distribution, then run `grunt watch`, which will rebuild as you make changes. (TODO: grunt watch is broken; fix it!)

Before submitting any changes to the repository, make sure to run `grunt test`
to make sure it passes all unit tests. Failing tests are cause to immediately
reject submissions. :)


### Fixing compilation and setup

The following hints may help you if it goes wrong and you need to debug and fix it.

- The file called `package.json` provides details of node packages used to build uProxy. To download and install them in the right place (typically a subdirectory called `node_packages`) run `npm install`.

- A file called `bower.json` provides details of packages for the UI, typically JavaScript for the browser. Run `bower install` to download and install the dependencies. They are typically installed in a directory called `lib` (as defined by a local file called `.bowerrc`).

- If bower fails, it doesn't tell you. Sometimes things don't work because it failed to install something that you need. When you run `bower install`, look out for error messages.

- If things are not working, check that you have recent versions of bower, npm, and node.


## Layout of files

Configuration and setup files
 * `Gruntfile.js` a file that specifies common tasks, e.g. how to build and package uProxy.
 * `bower.json` specifies dependent libraries from Bower.
 * `package.json` specifies dependent libraries from NPM.
 * `.gitignore` what git should ignore
 * `.bowerrc` tells bower where to put files
 * `.travis.yml` Travis auto-testing
* `tools` directory contains some typescript and javascript to help Grunt.

Source code
 * `src` holds all source code; no compiled files
 * `src/generic_ui` generic user interface code
 * `src/generic_core` generic uproxy core-functionality code
 * `src/chrome_app` code specific to the chrome app
 * `src/chrome_extension` code specific to the chrome extension
 * `src/firefox` code specific to firefox
 * `third_party` holds external libraries we depend on that are copied into this repository
 * `node_modules` dynamically generated npm module dependencies
 * `scraps` temporary holding for sharing scraps of code

Dynamically created directories (`grunt clean` should remove them)
 * `build` created by grunt tasks; holds the built code, but none of the code that was compiled.
 * `dist` created by grunt tasks; holds final distribution versions
 * `test_output` created by grunt tasks; holds test-output files
 * `.grunt` holds grunt cache stuff

## Glossary of frameworks you need to know about

 * [Bower](http://bower.io) (and the `bower.json` file) - a package manager for the web. Used for javascript and web-libraries that the extension uses (e.g. angular). Note: this uses the file .bowerrc to specify where bower components get installed (in third_party/bower_components)
 * [Coveralls](https://coveralls.io/): a continuous coverage checking system
 * [Grunt](http://gruntjs.com/) (and the `Gruntfile.js` file) - a JavaScript task runner, used for compilation/building
 * [Jasmine](http://pivotal.github.io/jasmine/) - a testing framework for JavaScript.
 * [Karma](http://karma-runner.github.io/) - a test runner
 * [NPM](https://www.npmjs.org/) (and the `package.json` file): NPM (node package manager) us used to specify dependencies on node modules we use for compilation, e.g. typescript and grunt. These dependencies get places in the `node_modules` directory
 * [Travis](https://travis-ci.org/): a continuous build system
 * [TypeScript](http://www.typescriptlang.org/) as the primary language, which compiles to JavaScript. This does type checking and has some syntax improvements on JS, while letting us incrementally migrate and easily include external JS packages and frameworks
