// common-grunt-rules

/// <reference path='../../third_party/typings/node/node.d.ts' />

import path = require('path');

// Assumes that the each spec file is a fully browserified js file.
export function jasmineSpec(name:string) {
  return {
    src: [
      require.resolve('arraybuffer-slice'),
      path.join(path.dirname(require.resolve('es6-promise/package.json')),
                'dist/promise-1.0.0.js')
    ],
    options: {
      specs: 'build/dev/' + name + '/**/*.spec.static.js',
      outfile: 'build/dev/' + name + '/SpecRunner.html',
      keepRunner: true
    }
  };
}

export function browserifyTypeScript(filepath:string) {
  return {
    src: ['build/dev/' + filepath + '.js'],
    dest: 'build/dev/' + filepath + '.static.js',
    options: {
      debug: true,
    }
  };
}

export function copyFreedomToDest(destPath:string) {
  return { files: [{
    src: [require.resolve('freedom')],
    dest: destPath,
    onlyIf: 'modified'
  }] };
}
