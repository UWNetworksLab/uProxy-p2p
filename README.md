UProxy
======



### Layout

This is the top-level [UProxy
repository](https://github.com/UWNetworksLab/UProxy). It contains all code for
UProxy. Browser-dependent components live in "chrome" and "firefox"
subdirectories. Browser-independent components live in the 'common' subdirectory.

UProxy current has 1 git submodule, 
[freedom](https://github.com/UWNetworksLab/freedom), located in "common/freedom".
Freedom is a generic framework and modularization for
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

Before jumping in, it's worth familiarizing yourself with any of these you may
not have used before.


### Development setup

#### Pre-Requirements

Note: you will either need to run these as root, or set the directories they
modify (/usr/local) to being editable by your user.

- [node](http://nodejs.org/) + npm: `brew install node # or similar for your
  system`

    - You may need to set your $NODE_PATH environment variable appropriately
      (e.g. /usr/local/share/npm/lib/node_modules).

    - If you install npm things globally, you'll need to do so as the
      appropriate super-user.

- [grunt](http://gruntjs.com/): `npm install -g grunt-cli`

- [bower](http://bower.io/) 1.0: `npm install -g bower`. If you already have
  bower installed at a lower version, run `npm update -g bower`.

    - To run binaries from globally-installed npm packages without
      fully-qualifying paths, add your npm bin directory to your path
      (e.g. /usr/local/share/npm/bin/grunt).

- [compass](http://compass-style.org/):
  `gem install compass` (requires ruby, often comes installed, may need to be installed as super-user)

    - This is assuming you have `ruby` and `rubygems` installed. 

- [icu](https://sites.google.com/site/icuprojectuserguide/): Needed for
  StringPrep.  sudo apt-get install icu-dev.

#### Installation, setup, compilation, updating

1. Clone UProxy and its submodules (and its submodules' submodules...): 
`git clone https://github.com/UWNetworksLab/UProxy.git`

2. Run `./setup.sh`. This will install all local dependencies,
as appropriate to run in Chrome.
The first time you run this, you'll see lots of npm, bower and grunt
messages. Check the last couple of lines in case there is an error. 

Note that if any local dependencies have changed (i.e. changes to bower dependencies,
updates to FreeDOM), you will have to run `./setup.sh` to update these dependencies.


#### Running in Chrome

1. In Chrome, navigate to chrome://extensions, check 'Developer Mode'.

2. Click 'Load unpacked extension...' and select the 'chrome/app' directory.

3. Click 'Load unpacked extension...' and select the 'chrome/extension/src' directory.

#### Development

UProxy uses the Grunt build system for development. Here are a list
of supported Grunt commands:
 *  build - Builds Chrome and Firefox extensions
 *  setup - Installs local dependencies and sets up environment
 *  test - Run unit tests
 *  watch - Watch for changes in 'common' and copy as necessary
 *  clean - Cleans up
 *  build_chrome - Build just Chrome
 *  build_firefox - Build just Firefox
 *  everything - 'setup', 'test', then 'build'

The easiest way to stay current is to pull changes, run `grunt build` to build
your distribution, then run `grunt watch`, which will rebuild as you make changes

Before submitting any changes to the repository, make sure to run `grunt test`
to make sure it passes all unit tests. Failing tests are cause to immediately
reject submissions.

#### Testing in Firefox

1. TODO


#### Building the packaged Chrome extension

- Run `grunt build` from the chrome/extension directory to lint the script, run tests,
  and if those go well, build a packed extension. To test the built extension, go to
  chrome://extensions and load it unpacked from the chrome/extension/dist
  directory, or packed from the chrome/extension/package directory.


#### Fixing compilation and setup

UPDATE THIS SECTION SOON

The `grunt everything` task should run all the steps needed to setup, test and
compile UProxy. However the following hints should help you if it goes wrong and
you need to debug and fix it.

1. Run `LOCAL=yes make` in each of the Freedom submodules
   (chrome/app/submodules/uproxy-common/submodules/freedom and
   firefox/submodules/uproxy-common/submodules/freedom). We intend to make this
   more automated.

2. Anywhere there's a package.json (currently just chrome/extension), run `npm
   install` to fetch required npm packages.

3. Anywhere there's a bower.json (currently just chrome/extension), run `bower
   install` to fetch required bower packages.

4. A number of grunt tasks are set up for the chrome extension to aid
  development. Currently `grunt jshint` (a javascript linting task) is the only
  development task that's useful, but once there are tests, `grunt test` will
  run them for you. In the next version of generator-chrome-extension, `grunt
  watch` will be supported, which does things like monitor for changes to
  scripts, and when detected, linting them + running tests automatically,
  monitoring changes to sass stylesheets and compiling them to css when
  detected, etc. For now, compiling the sass to css can be accomplished via
  `grunt compass:dist`, and then manually copying
  chrome/extension/.tmp/styles/\*.css to chrome/extension/src/styles/. :\
