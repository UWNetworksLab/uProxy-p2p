UProxy
======

Tagline Coming Soon


### Layout

This is the top-level [UProxy
repository](https://github.com/UWNetworksLab/UProxy). It contains all code for
UProxy. Browser-dependent components live in "chrome" and "firefox"
subdirectories. Browser-independent components live in the
[uproxy-common](https://github.com/UWNetworksLab/uproxy-common) repository,
which is included via git submodule in each of the browser-specific
directories.

uproxy-common in turn includes the
[freedom](https://github.com/UWNetworksLab/freedom) repository, again included
via git submodule. Freedom is a generic framework and modularization for
building browser-based distributed applications. A *Freedom module* is a module
that can run on any Freedom-supporting platform and be migrated to any other.


### Tools

UProxy is built with the following tools:

- [bower](http://bower.io)
- [yeoman](http://yeoman.io)
- [generator-angular](https://github.com/yeoman/generator-angular)
- [generator-chrome-extension](https://github.com/yeoman/generator-chrome-extension)
- [grunt](http://gruntjs.com)
- [AngularJS](http://angularjs.org)
- [oauth2-extensions](https://github.com/borismus/oauth2-extensions)

Before jumping in, it's worth familiarizing yourself with any of these you may
not have used before.


### Development setup

#### Pre-Requirements

Note: you will either need to run these as root, or set the directories they modify (/usr/local) to being editable by your user.

- [node](http://nodejs.org/) + npm: `brew install node # or similar for your
  system`

    - Also make sure your $NODE_PATH environment variable is set correctly
      (e.g. /usr/local/share/npm/lib/node_modules).

- [grunt](http://gruntjs.com/): `npm install -g grunt-cli`

- [bower](http://bower.io/) 1.0: `npm install -g bower`. If you already have
  bower installed at a lower version, run `npm update -g bower`.

    - To run binaries from globally-installed npm packages without
      fully-qualifying paths, add your npm bin directory to your path
      (e.g. /usr/local/share/npm/bin/grunt).

- [compass](http://compass-style.org/):
  `gem install compass` (requires ruby, often comes installed)


#### Installation

1. Clone UProxy and its submodules (and its submodules' submodules...): `git
   clone --recursive https://github.com/UWNetworksLab/UProxy.git`

1. Run `LOCAL=yes make` in each of the Freedom submodules
   (chrome/app/submodules/uproxy-common/submodules/freedom and
   firefox/submodules/uproxy-common/submodules/freedom). We intend to make this
   more automated.

1. Anywhere there's a package.json (currently just chrome/extension), run `npm
   install` to fetch required npm packages.

1. Anywhere there's a bower.json (currently just chrome/extension), run `bower
   install` to fetch required bower packages.


#### Development

- A number of grunt tasks are set up for the chrome extension to aid
  development. Currently `grunt jshint` (a javascript linting task) is the only
  development task that's useful, but once there are tests, `grunt test` will
  run them for you. In the next version of generator-chrome-extension, `grunt
  watch` will be supported, which does things like monitor for changes to
  scripts, and when detected, linting them + running tests automatically,
  monitoring changes to sass stylesheets and compiling them to css when
  detected, etc. For now, compiling the sass to css can be accomplished via
  `grunt compass:dist`, and then manually copying chrome/extension/.tmp/styles/\*.css
  to chrome/extension/src/styles/. :\


#### Testing in Chrome

1. In Chrome, navigate to chrome://extensions, check 'Developer Mode'.

1. Click 'Load unpacked extension...' and select the 'chrome/app' directory.

1. Click 'Load unpacked extension...' and select the 'chrome/extension/src' directory.


#### Firefox Add-on

1. TODO


#### Building Chrome Extension

- Run `grunt build` from the chrome/extension directory to lint the script, run tests,
  and if those go well, build a packed extension. To test the built extension, go to
  chrome://extensions and load it unpacked from the chrome/extension/dist
  directory, or packed from the chrome/extension/package directory.
