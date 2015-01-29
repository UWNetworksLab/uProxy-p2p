// common-grunt-rules

/// <reference path='../../third_party/typings/node/node.d.ts' />

import path = require('path');

export interface RuleConfig {
  // The directory where things should be built to.
  devBuildDir :string;
}

export interface JasmineRule {
  src :string[];
  options ?:{
    specs :string[];
    outfile ?:string;
    keepRunner ?:boolean;
  };
}

export interface BrowserifyRule {
  src :string[];
  dest :string;
  options ?:{
    debug ?:boolean;
  };
}

export interface CopyRule {
  files :{
    src     : string[];
    dest    : string;
    expand ?: boolean;
    cwd    ?: string;
    nonull ?: boolean;
    onlyIf ?: string; // can be: 'modified'
  }[];
}


export class Rule {
  constructor(public config :RuleConfig) {}

  // Grunt Jasmine target creator
  // Assumes that the each spec file is a fully browserified js file.
  public jasmineSpec(name:string, morefiles?:string[]) : JasmineRule {
    if(!morefiles) { morefiles = []; }
    return {
      src: [
        require.resolve('arraybuffer-slice'),
        path.join(path.dirname(require.resolve('es6-promise/package.json')),
                  'dist/promise-1.0.0.js')
      ].concat(morefiles),
      options: {
        specs: [ path.join(this.config.devBuildDir, name, '/**/*.spec.static.js') ],
        outfile: path.join(this.config.devBuildDir, name, '/SpecRunner.html'),
        keepRunner: true,
        template: require('grunt-template-jasmine-istanbul'),
        templateOptions: {
          // Output location for coverage results
          coverage: path.join(this.config.devBuildDir, name, 'coverage/results.json'),
          report: {
            type: 'html',
            options: {
              dir: path.join(this.config.devBuildDir, name, 'coverage')
            }
          }
        }
      }
    };
  }

  // Grunt browserify target creator
  public browserify(filepath:string) : BrowserifyRule {
    return {
      src: [ path.join(this.config.devBuildDir, filepath + '.js')],
      dest: path.join(this.config.devBuildDir, filepath + '.static.js'),
      options: {
        debug: true,
      }
    };
  }

  // Grunt copy target creator: for copying freedom.js to
  public copyFreedomToDest(freedomRuntimeName:string, destPath:string)
      : CopyRule {
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
  public copySomeFreedomLib(libPath:string, destPath:string) : CopyRule {
    return { files: [{
      expand: true,
      cwd: this.config.devBuildDir,
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
}
