// common-grunt-rules

/// <reference path='../../../third_party/typings/node/node.d.ts' />

import path = require('path');
import fs = require('fs');

export interface RuleConfig {
  // The path where code in this repository should be built in.
  devBuildPath :string;
  // The path from where third party libraries should be copied. e.g. as used by
  // sample apps.
  thirdPartyBuildPath :string;
  // The path to copy modules from this repository into. e.g. as used by sample
  // apps.
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
  public browserify(filepath:string, options = {
        browserifyOptions: { standalone: 'browserified_exports' }
      }) : BrowserifyRule {
    var file = path.join(this.config.devBuildPath, filepath + '.js');
    return {
      src: [ file ],
      dest: path.join(this.config.devBuildPath, filepath + '.static.js'),
      options: options
    };
  }

  // Grunt browserify target creator, instrumented for istanbul
  public browserifySpec(filepath:string, options = {
        transform: [['browserify-istanbul',
                    { ignore: ['**/mocks/**', '**/*.spec.js'] }]],
        browserifyOptions: { standalone: 'browserified_exports' }
      }) : BrowserifyRule {
    var file = path.join(this.config.devBuildPath, filepath + '.spec.js');
    return {
      src: [ file ],
      dest: path.join(this.config.devBuildPath, filepath + '.spec.static.js'),
      options: options
    };
  }

  // Copies libs from npm, local libraries, and third party libraries to the
  // destination folder.
  public copyLibs(copyInfo:{
    // The names of npm libraries who's package exports should be copied (a
    // single JS file, see: https://docs.npmjs.com/files/package.json#main), or
    // the names of individual files from npm modules, using the require.resolve
    // nameing style, see: https://github.com/substack/node-resolve
    npmLibNames ?:string[]
    // Paths within this repository's build directory to be copied.
    pathsFromDevBuild ?:string[]
    // Paths within third party to be copied.
    pathsFromThirdPartyBuild ?:string[]
    // A relative (to devBuildPath) destination to copy files to.
    localDestPath:string; }) : CopyRule {

    // Default to empty list of dependencies.
    copyInfo.npmLibNames = copyInfo.npmLibNames || [];
    copyInfo.pathsFromDevBuild = copyInfo.pathsFromDevBuild || [];
    copyInfo.pathsFromThirdPartyBuild = copyInfo.pathsFromThirdPartyBuild || [];

    var destPath = path.join(this.config.devBuildPath, copyInfo.localDestPath);
    var destPathForLibs = path.join(destPath, this.config.localLibsDestPath);

    var allFilesForlibPaths :CopyFilesDescription[] = [];

    // The file-set for npm module files (or npm module output) from each of
    // |npmLibNames| to the destination path.
    copyInfo.npmLibNames.map((npmName) => {
      var npmModuleDirName :string;
      if (path.dirname(npmName) === '.') {
        // Note: |path.dirname(npmName)| gives '.' when |npmName| is just the
        // npm module name.
        npmModuleDirName = npmName;
      } else {
        npmModuleDirName = path.dirname(npmName);
      }

      var absoluteNpmFilePath = require.resolve(npmName);
      allFilesForlibPaths.push({
          expand: false,
          nonull: true,
          src: [absoluteNpmFilePath],
          dest: path.join(destPath,
                          npmModuleDirName,
                          path.basename(absoluteNpmFilePath)),
          onlyIf: 'modified'
        });
    });

    // The file-set for all relevant files in pathsFromDevBuild.
    copyInfo.pathsFromDevBuild.map((libPath) => {
      allFilesForlibPaths.push({
        expand: true,
        cwd: this.config.devBuildPath,
        src: [
          libPath + '/**/*',
          '!' + libPath + '/**/*.ts',
          '!' + libPath + '/**/*.spec.js',
          '!' + libPath + '/**/SpecRunner.html'
        ],
        dest: destPathForLibs,
        onlyIf: 'modified'
      });
    });

    // Provide a file-set to be copied for each local third_party module that is
    // listed in |pathsFromthirdPartyBuild|.
    copyInfo.pathsFromThirdPartyBuild.map((libPath) => {
      allFilesForlibPaths.push({
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

    return { files: allFilesForlibPaths };
  }

}  // class Rule
