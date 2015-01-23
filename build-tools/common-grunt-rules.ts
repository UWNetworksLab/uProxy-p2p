// common-grunt-rules

/// <reference path='../../third_party/typings/node/node.d.ts' />

import path = require('path');

// Grunt Jasmine target creator
// Assumes that the each spec file is a fully browserified js file.
export function jasmineSpec(name:string, morefiles?:string[]) {
  if(!morefiles) { morefiles = []; }
  return {
    src: [
      require.resolve('arraybuffer-slice'),
      path.join(path.dirname(require.resolve('es6-promise/package.json')),
                'dist/promise-1.0.0.js')
    ].concat(morefiles),
    options: {
      specs: 'build/src/' + name + '/**/*.spec.static.js',
      outfile: 'build/src/' + name + '/SpecRunner.html',
      keepRunner: true
    }
  };
}

// Grunt browserify target creator
export function browserify(filepath:string) {
  return {
    src: ['build/src/' + filepath + '.js'],
    dest: 'build/src/' + filepath + '.static.js',
    options: {
      debug: true,
    }
  };
}

// Grunt copy target creator: for copying freedom.js to
export function copyFreedomToDest(freedomRuntimeName:string, destPath:string) {
  var freedomjsPath = require.resolve(freedomRuntimeName);
  var fileTarget = { files: [{
    nonull: true,
    src: [freedomjsPath],
    dest: path.join(destPath,path.basename(freedomjsPath)),
    onlyIf: 'modified'
  }] };
  return fileTarget;
}

// Grunt copy target creator: for copy a freedom library directory
export function copyFreedomLib(libPath:string, destPath:string) {
  return { files: [{
    expand: true,
    cwd: 'build/src/',
    src: [
      libPath + '/*.json',
      libPath + '/*.js',
      libPath + '/*.html',
      libPath + '/*.css',
      '!' + libPath + '/*.spec.js',
      '!' + libPath + '/SpecRunner.html'
    ],
    dest: destPath,
    onlyIf: 'modified'
  }] };
}

