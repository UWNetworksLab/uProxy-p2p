# Wondering what's what?

## Layout of files

Configuration and setup files
 * `setup.sh` a shell script, assumes you have `npm` installed, to setup uproxy (install and setup dependent libraries).
 * `Gruntfile.js` a file that specifies common tasks, e.g. how to build and package uproxy.
 * `bower.json` specified dependent libraries from Bower.
 * `package.json` specified dependent libraries from NPM.
 * `.gitignore` what git should ignore
 * `.bowerrc` tells bower where to put files
 * `.travis.yml` Travis auto-testing
* `tools` directory contains some typescript and javascript to help Grunt.

Source code
 * `src` holds all source code; no compiled files.
 * `src/chrome_app` code specific to the chrome app
 * `src/chrome_extension` code specific to the chrome extension
 * `src/firefox` code specific to filefox
 * `src/generic_ui` generic user interface code
 * `src/generic_core` generic uproxy core-functionality code
 * `src/icons` icons
 * `external_lib` holds external libraries we depend on.
 * `scraps` temporary holding for sharing scraps of code.

Dynamically created directories (`grunt clean` should remove them)
 * `build` created by grunt tasks; holds the built code, but none of the code that was compiled.
 * `dist` created by grunt tasks; holds final distirbution versions.
 * `test_output` created by grunt tasks; holds test-output files.
 * `.grunt` holds grunt cache stuff
 * `.sass-cache` holds sass cache stuff

## Glossary of frameworks you need to know about

 * AngularJS - a UI framework for html/JS apps.
 * Jasmine - a testing framework for JavaScript.
 * Karma - a test runner or angularjs.
 * Grunt (and the `Gruntfile.js` file) - a JavaScript task runner, used for compilation/building.
 * NPM (and the `package.json` file): NPM (node package manager) us used to specify dependencies on node modules we use for compilation, e.g. typescript and grunt. These dependencies get places in the `node_modules` directory.
 * Bower (and the `bower.json` file) - a package manager for the web. Used for javascript and web-libraries that the extension uses (e.g. angular). Note: this uses the file .bowerrc to specify where bower components get installed (in external_lib/bower_components)
 * Travis: a continnuous build system.
 * Coveralls: a continnuous coverage checking system.
