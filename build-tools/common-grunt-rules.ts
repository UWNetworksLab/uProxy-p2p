// common-grunt-rules

/// <reference path='../../../third_party/typings/node/node.d.ts' />

import path = require('path');

export interface RuleConfig {
  // The directory where things should be built to.
  devBuildPath :string;
  thirdPartyBuildPath :string;
  localLibsDestPath :string;
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
        specs: [ path.join(this.config.devBuildPath, name, '/**/*.spec.static.js') ],
        outfile: path.join(this.config.devBuildPath, name, '/SpecRunner.html'),
        keepRunner: true,
        template: require('grunt-template-jasmine-istanbul'),
        templateOptions: {
          files: ['**/*', '!node_modules/**'],
          // Output location for coverage results
          coverage: path.join(this.config.devBuildPath, name, 'coverage/results.json'),
          report: [
            { type: 'html',
              options: {
                dir: path.join(this.config.devBuildPath, name, 'coverage')
              }
            },
            { type: 'lcov',
              options: {
                dir: path.join(this.config.devBuildPath, name, 'coverage')
              }
            }
          ]
        }
      }
    }
  }

  // Grunt browserify target creator
  public browserify(filepath:string) : BrowserifyRule {
    return {
      src: [ path.join(this.config.devBuildPath, filepath + '.js')],
      dest: path.join(this.config.devBuildPath, filepath + '.static.js'),
      options: {
        debug: false,
      }
    };
  }

  // Grunt browserify target creator, instrumented for istanbul
  public browserifySpec(filepath:string) : BrowserifyRule {
    return {
      src: [ path.join(this.config.devBuildPath, filepath + '.spec.js') ],
      dest: path.join(this.config.devBuildPath, filepath + '.spec.static.js'),
      options: {
        debug: true,
        transform: [['browserify-istanbul',
                    { ignore: ['**/mocks/**', '**/*.spec.js'] }]]
      }
    };
  }

  // Copies libs from npm, local libraries, and third party libraries to the
  // destination folder.
  public copyLibs(npmLibNames: string[],
      localLibs:string[], thirdPartyLibs:string[],
      destName:string) : CopyRule {

    var destPath = path.join(this.config.devBuildPath, destName);
    var localLibsDestPath = path.join(this.config.devBuildPath,
        destName, this.config.localLibsDestPath);

    var filesForlibPaths :CopyFilesDescription[] = [];

    // Provide a file-set to be copied for each local module that is listed in
    // |localLibs|
    localLibs.map((libPath) => {
      filesForlibPaths.push({
        expand: true,
        cwd: this.config.devBuildPath,
        src: [
          libPath + '/**/*',
          '!' + libPath + '/**/*.ts',
          '!' + libPath + '/**/*.spec.js',
          '!' + libPath + '/**/SpecRunner.html'
        ],
        dest: localLibsDestPath,
        onlyIf: 'modified'
      });
    });

    // Provide a file-set to be copied for each local third_party module that is
    // listed in |thirdPartyLibs|
    thirdPartyLibs.map((libPath) => {
      filesForlibPaths.push({
        expand: true,
        cwd: this.config.thirdPartyBuildPath,
        src: [
          libPath + '/**/*',
          '!' + libPath + '/**/*.ts',
          '!' + libPath + '/**/*.spec.js',
          '!' + libPath + '/**/SpecRunner.html'
        ],
        dest: destPath,
        onlyIf: 'modified'
      });
    });

    // Copy the main javascript runtime specified in
    // |npmLibName|.
    npmLibNames.map((npmLibName) => {
      var npmPath = require.resolve(npmLibName);
      filesForlibPaths.push({
          nonull: true,
          src: [npmPath],
          dest: path.join(destPath,path.basename(npmPath)),
          onlyIf: 'modified'
        });
    });

    return { files: filesForlibPaths };
  }

}  // class Rule
