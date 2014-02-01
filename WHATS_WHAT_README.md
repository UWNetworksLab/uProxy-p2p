# Wondering what's what?

## Layout of files

 * `setup.sh` a shell script, assumes you have `npm` installed, to setup uproxy (install and setup dependent libraries).
 * `Gruntfile.js` a file that specifies common tasks, e.g. how to build and package uproxy.
 * `bower.json` specified dependent libraries from Bower.
 * `package.json` specified dependent libraries from NPM.
 * `src` holds all source code; no compiled files.
 * `build` created by grunt tasks; holds the built code, but none of the code that was compiled.
 * `dist` created by grunt tasks; holds final distirbution versions.
 * `external_lib` holds external libraries we depend on.
 * `scraps` holds scraps of code.

## Glossary of frameworks you need to know about

 * AngularJS - a UI framework for html/JS apps.
 * Jasmine - a testing framework for JavaScript.
 * Karma - a test runner or angularjs.
 * Grunt (and the `Gruntfile.js` file) - a JavaScript task runner, used for compilation/building.
 * NPM (and the `package.json` file): NPM (node package manager) us used to specify dependencies on node modules we use for compilation, e.g. typescript and grunt. These dependencies get places in the `node_modules` directory.
 * Bower (and the `bower.json` file) - a package manager for the web. Used for javascript and web-libraries that the extension uses (e.g. angular). Note: this uses the file .bowerrc to specify where bower components get installed (in external_lib/bower_components)
