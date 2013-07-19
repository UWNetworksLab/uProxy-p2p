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
- [AngularJS](http://angularjs.org)
- [oauth2-extensions](https://github.com/borismus/oauth2-extensions)

Before jumping in, it's worth familiarizing yourself with any of these you may
not have used before.


### Development setup

#### Pre-Requirements

- [node](http://nodejs.org/) + npm:
  `which npm || brew install node # or similar for your system`

- [bower](http://bower.io/) 0.10:
  if `bower --version` does not give '0.10.x', run `npm install -g bower@'~0.10.0'`


#### Installation

1. Clone UProxy and its submodules (and its submodules' submodules...):
   `git clone --recursive https://github.com/UWNetworksLab/UProxy.git`

1. Run `LOCAL=yes make` in each of the Freedom submodules
   (chrome/app/submodules/uproxy-common/submodules/freedom and
   firefox/submodules/uproxy-common/submodules/freedom). We intend to make this
   more automated.

1. Anywhere there's a package.json (e.g. chrome/extension), run `npm install` to
   fetch required npm packages.

1. Anywhere there's a bower.json (e.g. chrome/extension), run `bower install`
   to fetch required bower packages.


#### Chrome App + Extension

1. In Chrome, navigate to chrome://extensions, check 'Developer Mode'.

1. Click 'Load unpacked extension...' and select the 'chrome/app' directory.

1. Click 'Load unpacked extension...' and select the 'chrome/extension' directory.


#### Firefox Add-on

1. TODO
