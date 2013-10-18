/**
 * UProxy Grunt Build System
 * Support commands:
 * grunt
 *  build - Builds Chrome and Firefox extensions
 *  setup - Installs local dependencies and sets up environment
 *  xpi - Generates an .xpi for installation to Firefox.
 *  ff - Open up a firefox window with an instance of the extension running.
 *  test - Run unit tests
 *  watch - Watch for changes in 'common' and copy as necessary
 *  clean - Cleans up
 *  build_chrome - build Chrome files
 *  build_firefox - build Firefox
 *  concat:firefox - collect popup.html and options.html dependencies into
                     a single file.
 *  everything - 'setup', 'test', then 'build'
 **/

var path = require("path");
var minimatch = require("minimatch");

//List of all files for each distribution
//NOTE: This is ultimately what gets copied, so keep this precise
//NOTE: Keep all exclusion paths ('!' prefix) at the end of the array
var chrome_app_files = [
  'common/ui/icons/**',
  'common/freedom/freedom.js',
  'common/backend/**',
  '!common/backend/spec/**',
  '!common/backend/identity/xmpp/node-xmpp/**',
  // scraps is a palce for throwing example code for demonstrating stuff to each other.
  'common/scraps/**'
];
var chrome_ext_files = [
  // scraps is a palce for throwing example code for demonstrating stuff to each other.
  'common/scraps/**',
  'common/ui/*.html',
  'common/ui/icons/**',
  'common/ui/scripts/**',
  'common/ui/styles/**',
  'common/ui/bower_components/angular/angular.js',
  'common/ui/bower_components/angular-animate/angular-animate.js',
  'common/ui/bower_components/angular-lodash/angular-lodash.js',
  'common/ui/bower_components/angular-mocks/angular-mocks.js',
  'common/ui/bower_components/angular-scenario/*.js',
  'common/ui/bower_components/jquery/jquery.js',
  'common/ui/bower_components/json-patch/jsonpatch.js',
  // 'common/ui/bower_components/jsonpatch/lib/jsonpatch.js',
  'common/ui/bower_components/lodash/dist/lodash.js'
];
var firefox_files = [
  'common/backend/**',
  '!common/backend/spec/**',
  '!common/backend/identity/xmpp/node-xmpp/**',
  'common/freedom/freedom.js',
  'common/ui/*.html',
  'common/ui/icons/**',
  'common/ui/scripts/**',
  'common/ui/styles/**',
  'common/ui/bower_components/angular/angular.js',
  'common/ui/bower_components/angular-lodash/angular-lodash.js',
  'common/ui/bower_components/angular-mocks/angular-mocks.js',
  'common/ui/bower_components/angular-scenario/*.js',
  'common/ui/bower_components/jquery/jquery.js',
  'common/ui/bower_components/json-patch/jsonpatch.js',
  // 'common/ui/bower_components/jsonpatch/lib/jsonpatch.js',
  'common/ui/bower_components/lodash/dist/lodash.js'
];

// Firefox concat files
var firefox_concat_src = [
  'firefox/data/scripts/event_on_emit_shim.js',
  'firefox/data/scripts/freedom_shim_content.js',
  'firefox/data/scripts/injector.js'
];

//Testing
//TODO fix
//var sources = ['common/backend/spec/*.js'];
//var sources = ['common/backend/spec/*.js'];
// These files loaded sequentially prior to spec files.
var sourcesToTest = [
  'common/backend/test/freedom-mocks.js',
  'common/backend/util.js',
  'common/backend/nouns-and-adjectives.js',
  'common/backend/constants.js',
  'common/backend/state-storage.js',
  'common/backend/uproxy.js',
  'common/backend/start-uproxy.js'
];

module.exports = function(grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    copy: {
      chrome_app: {files: [{src: chrome_app_files, dest: 'chrome/app/'}]},
      chrome_ext: {files: [{src: chrome_ext_files, dest: 'chrome/extension/src/'}]},
      firefox: {files: [{src: firefox_files, dest: 'firefox/data/'}]},
      watch: {files: []},
    },
    concat: {
      firefox: {
        src: firefox_concat_src,
        dest: 'firefox/data/scripts/dependencies.js',
        options: {
        // Replace all 'use strict' statements in the code with a single one at the top
          banner: "'use strict';\n",
          process: function(src, filepath) {
            return '// Source: ' + filepath + '\n' +
              src.replace(/(^|\n)[ \t]*('use strict'|"use strict");?\s*/g, '$1');
          }
        }
      }
    },
    watch: {
      common: {//Watch everything
        //TODO this doesn't work as expected on VMsw
        files: ['common/**/*',
                // bower components should only change when grunt is
                // already being run
                '!**/bower_components/**'],
        tasks: ['copy:watch'],
        options: {spawn: false}
      },
      firefox_dep: {
        files: firefox_concat_src,
        tasks: ['concat:firefox'],
        options: {spawn: false}
      }
    },
    shell: {
      git_submodule: {
        command: ['git submodule init', 'git submodule update'].join(';'),
        options: {stdout: true}
      },
      bower_install: {
        command: 'bower install',
        options: {stdout: true, stderr: true, failOnError: true, execOptions: {cwd: 'common/ui'}}
      },
      setup_freedom: {
        command: 'npm install',
        options: {stdout: true, stderr: true, failOnError: true, execOptions: {cwd: 'common/freedom'}}
      },
      freedom: {
        command: 'grunt',
        options: {stdout: true, stderr: true, failOnError: true, execOptions: {cwd: 'common/freedom'}}
      },
      rickroll: {
        command: 'curl -L https://raw.github.com/keroserene/rickrollrc/master/roll.sh | bash',
        options: {stdout: true, stderr: true, failOnError: true, execOptions: {maxBuffer: 16777216}}
      },
    },
    clean: ['chrome/app/common/**',
            'chrome/extension/src/common/**',
            'firefox/data/common/**',
            'tmp',
            'uproxy.xpi'],
    jasmine: {
      common: {
        // Files being tested
        src: sourcesToTest,
        options: {
          helpers: ['common/backend/test/example-state.jsonvar',
                    'common/backend/test/example-saved-state.jsonvar'],
          specs: 'common/backend/spec/*Spec.js',
          keepRunner: true
        }
      }
    },
    jsvalidate: {
      files: sourcesToTest.concat(['common/backend/spec/*Spec.js'])
    },
    jshint: {
      all: sourcesToTest.concat(['common/backend/spec/*Spec.js']),
      options: {
        // 'strict': true, // Better to have it in the file
        // 'globalstrict': true,
        'moz': true,   // Used for function closures and other stuff
        '-W069': true,
        '-W097': true  // force: allow "strict use" in non function form.
      }
    },
    'mozilla-addon-sdk': {
      download: {
        options: {
          revision: 'firefox24'
        }
      },
      xpi: {
        options: {
          extension_dir: 'firefox',
          dist_dir: '.'
        }
      }
    },
    'mozilla-cfx': {
      debug_run: {
        options: {
          extension_dir: 'firefox',
          command: 'run'
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-jasmine');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-jsvalidate');
  grunt.loadNpmTasks('grunt-mozilla-addon-sdk');
  grunt.loadNpmTasks('grunt-shell');

  //On file change, see which distribution it affects and
  //update the copy:watch task to copy only those files
  grunt.event.on('watch', function(action, filepath, target) {
    grunt.log.writeln(target + ': ' + filepath + ' has ' + action);
    var files = [];
    if (minimatchArray(filepath, chrome_app_files)) {
      grunt.log.writeln(filepath + ' - watch copying to Chrome app');
      files.push({src: filepath, dest: 'chrome/app/'});
    }
    if (minimatchArray(filepath, chrome_ext_files)) {
      grunt.log.writeln(filepath + ' - watch copying to Chrome ext');
      files.push({src: filepath, dest: 'chrome/extension/src/'});
    }
    if (minimatchArray(filepath, firefox_files)) {
      grunt.log.writeln(filepath + ' - watch copying to Firefox');
      files.push({src: filepath, dest: 'firefox/data/'});
    }
    grunt.config(['copy', 'watch', 'files'], files);
    grunt.log.writeln("copy:watch is now: " + JSON.stringify(grunt.config(['copy', 'watch'])));
  });

  //Setup task
  grunt.registerTask('setup', [
    'shell:git_submodule',
    'shell:bower_install',
    'shell:setup_freedom',
    'shell:freedom'
  ]);
  grunt.registerTask('test', [
    'jshint:all',
    'jasmine'
  ]);
  //Build task
  grunt.registerTask('build_chrome', [
    'copy:chrome_app',
    'copy:chrome_ext',
    'jsvalidate'
  ]);
  grunt.registerTask('build_firefox', [
    'concat:firefox',
    'copy:firefox'
  ]);
  grunt.registerTask('xpi', [
    'build_firefox',
    'mozilla-addon-sdk:download',
    'mozilla-addon-sdk:xpi'
  ]);
  grunt.registerTask('ff', [
    'build_firefox',
    'mozilla-addon-sdk:download',
    'mozilla-cfx'
  ]);
  grunt.registerTask('buil', ['shell:rickroll']);
  grunt.registerTask('build', [
    'build_chrome',
    'build_firefox',
    'test'
  ]);
  grunt.registerTask('everything' ['setup', 'build']);
  // Default task(s).
  grunt.registerTask('default', ['build']);
};


/**
 * UTILITIES
 **/

//minimatchArray will see if 'file' matches the set of patterns
//described by 'arr'
//NOTE: all exclusion strings ("!" prefix) must be at the end
//of the array arr
function minimatchArray(file, arr) {
  var result = false;
  for (var i = 0; i < arr.length; i++) {
    if (arr[i].substr(0, 1) == "!") {
      result &= minimatch(file, arr[i]);
    } else {
      result |= minimatch(file, arr[i]);
    }
  }
  return result;
};
