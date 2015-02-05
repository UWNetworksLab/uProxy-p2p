// common-grunt-rules

/// <reference path='../../build/third_party/typings/node/node.d.ts' />

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

export interface CopyFilesDescription {
  src     : string[];
  dest    : string;
  expand ?: boolean;
  cwd    ?: string;
  nonull ?: boolean;
  onlyIf ?: string; // can be: 'modified'
}

export interface CopyRule {
  files :CopyFilesDescription[];
}


export class Rule {
  constructor(public config :RuleConfig) {}

  // Grunt Jasmine target creator
  // Assumes that the each spec file is a fully browserified js file.
  public jasmineSpec(name:string, morefiles?:string[]) : JasmineRule {
    if (!morefiles) { morefiles = []; }
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
          files: ['**/*', '!node_modules/**'],
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
        debug: false,
      }
    };
  }

<<<<<<< HEAD
  // Grunt browserify target creator, instrumented for istanbul
  public browserifySpec(filepath:string) : BrowserifyRule {
    return {
      src: [ path.join(this.config.devBuildDir, filepath + '.spec.js') ],
      dest: path.join(this.config.devBuildDir, filepath + '.spec.static.js'),
      options: {
        debug: true,
        transform: [['browserify-istanbul', { ignore: ['**/mocks/**', '**/*.spec.js'] }]]
      }
    };
  }

  // Grunt copy target creator: for copying freedom.js to
  public copyFreedomToDest(freedomRuntimeName:string, destPath:string)
      : CopyRule {
=======
  // Grunt copy target creator: copies freedom libraries and the freedomjs file
  // to the destination path.
  public copyFreedomLibs(freedomRuntimeName: string,
      freedomLibPaths:string[], destPath:string) : CopyRule {
    // Provide a file-set to be copied for each freedom module that is lised in
    // |freedomLibPaths|
    var filesForlibPaths :CopyFilesDescription[] = freedomLibPaths.map(
          (libPath) => {
      return {
        expand: true,
        cwd: this.config.devBuildDir,
        src: [
          libPath + '/**/*',
          '!' + libPath + '/**/*.ts',
          '!' + libPath + '/**/*.spec.js',
          '!' + libPath + '/**/SpecRunner.html'
        ],
        dest: destPath,
        onlyIf: 'modified'
      }
    });
    // Copy the main freedom javascript runtime specified in
    // |freedomRuntimeName|.
>>>>>>> iislucas-changes-for-networking
    var freedomjsPath = require.resolve(freedomRuntimeName);
    filesForlibPaths.push({
        nonull: true,
        src: [freedomjsPath],
        dest: path.join(destPath,path.basename(freedomjsPath)),
        onlyIf: 'modified'
      });
    return { files: filesForlibPaths };
  }
}
