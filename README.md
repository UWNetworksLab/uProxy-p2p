# uProxy

[uProxy](https://www.uproxy.org) is a browser extension that lets users share their internet connection.

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
 - [npm](https://www.npmjs.org/) to install node modules that we use for our build process.  (Specified in `package.json`)
 - [Bower](http://bower.io) to install libraries that we use in the UI
   (specified in `bower.json`) including Polymer.


## Development setup

Please read the [uProxy Coding Guide](https://docs.google.com/document/d/12RfgwSLnEm-X5Knj1xFVGpp-MH7BdWjuzzo_g7xabro/edit) to learn more about contributing to uProxy.

### Prerequisites to build uProxy

Note: you will either need to run these as root, or set the directories they
modify (`/usr/local`) to being editable by your user (`sudo chown -R $USER /usr/local`)

- [git](https://git-scm.com/)
    - Most machines will have git pre-installed. If you need to install git, you can find instructions from the [git website](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git).

- [node](http://nodejs.org/) and npm (Node's package manager):

    - On **Mac** with Brew, you can do: `brew install node` (You may need to update your brew package manager, e.g. `brew update`). You can also install directly from a Mac package off the [NodeJS Website](http://nodejs.org/).
        - If you do not have [Homebrew](http://brew.sh), you can install it by running `ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"`

    - On **Ubuntu**, you can do `apt-get install nodejs`.
    - You may need to create a symlink (if we are not running legacy node) <br>
      Use this: <br>
      ln -s /usr/bin/nodejs /usr/bin/node

    - On **Archlinux**, you can do 'pacman -S nodejs'.

    - On **Windows**, you can download the installer from the [NodeJS Website](http://nodejs.org/).

    - You may need to set your `$NODE_PATH` environment variable appropriately
      (e.g. it might be: `/usr/local/share/npm/lib/node_modules`).

    - To run binaries from globally-installed npm packages without
      fully-qualifying paths, make sure you have added your npm bin directory to your path (e.g. `export PATH=$PATH:/usr/local/share/npm/bin/grunt`).

- [Grunt](http://gruntjs.com/): Install globally with `npm install -g grunt-cli`

### Building uProxy from source

 1. In your terminal, navigate to a directory where you would like to download uProxy. E.g., `cd ~/uProxy`

 1. Clone the uProxy repository: `git clone https://github.com/uProxy/uProxy.git` or `git clone git@github.com:uProxy/uproxy.git` if you have your ssh access to GitHub set up (useful if you use 2-step auth for GitHub, which you should do).

 1. Navigate into uProxy's root directory with `cd uproxy`

 1. Setup build tools and third-party dependencies:
   * In OS X or Linux, run `./setup.sh install`
   * In Windows, run `.\setup.cmd install` instead (in cmd or PowerShell).
 1. Run `grunt` - this will build everything, including uProxy for Chrome and Firefox.

Note that if any local dependencies have changed (i.e. changes to bower dependencies, updates to FreeDOM), you will have to run `./setup.sh install` to update these dependencies, then rerun `grunt`

### Installing and running

#### Chrome

These are the steps to try uProxy in the Chrome browser.

- In Chrome, go to `chrome://extensions`, make sure 'Developer mode' is enabled
- Click 'Load unpacked extension...' and select `build/dev/uproxy/chrome/app`
- Click 'Load unpacked extension...' and select `build/dev/uproxy/chrome/extension`

You need both the uProxy Chrome App and the uProxy Extension.

You can use `grunt build_chrome` from the root directory of the repository to re-compile just Chrome components.

#### Firefox

These are the steps to try uProxy in the Firefox browser.

- To run the add-on you need to have the Firefox add-on SDK installed.
Instructions can be found here: https://developer.mozilla.org/en-US/Add-ons/SDK/Tutorials/Installation
    - A quick way to get started is to download/extract the zip mentioned in "Prerequisites"

- Run `cd build/dev/uproxy/firefox`

- Run `cfx run` and Firefox should launch with the uProxy add-on installed

You can use `grunt build_firefox` from the root directory of the repository to compile just Firefox comonents.

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


### Fixing compilation and setup

- If something is going wrong during the build process, please try running `grunt
clean`, `./setup.sh clean`, and re-running `./setup.sh install`

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

## Glossary of frameworks you need to know about

 * [Bower](http://bower.io) (and the `bower.json` file) - a package manager for the web. Used for javascript and web-libraries that the extension uses (e.g. angular). Note: this uses the file .bowerrc to specify where bower components get installed (in third_party/bower_components)
 * [Coveralls](https://coveralls.io/): a continuous coverage checking system
 * [Grunt](http://gruntjs.com/) (and the `Gruntfile.js` file) - a JavaScript task runner, used for compilation/building
 * [Jasmine](http://pivotal.github.io/jasmine/) - a testing framework for JavaScript.
 * [Karma](http://karma-runner.github.io/) - a test runner
 * [NPM](https://www.npmjs.org/) (and the `package.json` file): NPM (node package manager) us used to specify dependencies on node modules we use for compilation, e.g. typescript and grunt. These dependencies get places in the `node_modules` directory
 * [Travis](https://travis-ci.org/): a continuous build system
 * [TypeScript](http://www.typescriptlang.org/) as the primary language, which compiles to JavaScript. This does type checking and has some syntax improvements on JS, while letting us incrementally migrate and easily include external JS packages and frameworks
