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
  'node_modules/freedom/freedom.js',
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
  'common/ui/lib/**',
];
var firefox_files = [
  'common/backend/**',
  '!common/backend/spec/**',
  '!common/backend/identity/xmpp/node-xmpp/**',
  'node_modules/freedom/freedom.js',
  'common/ui/*.html',
  'common/ui/icons/**',
  'common/ui/scripts/**',
  'common/ui/styles/**',
  'common/ui/lib/**',
];

// Firefox concat files
var firefox_concat_src = [
  'firefox/data/scripts/event_on_emit_shim.js',
  'firefox/data/scripts/freedom_shim_content.js',
  'firefox/data/scripts/injector.js'
];

// Files which make static UI testing work. Bsae directory = 'common/ui/'
var ui_isolation_files = [
  'popup.html',
  'scripts/**',
  'styles/**',
  'lib/**',
  'icons/**',
];

//Testing
//TODO fix
//var sources = ['common/backend/spec/*.js'];
//var sources = ['common/backend/spec/*.js'];
// These files loaded sequentially prior to spec files.
var sourcesToTest = [
  'common/test/freedom-mocks.js',
  'common/util.js',
  'common/nouns-and-adjectives.js',
  'common/constants.js',
  'common/state-storage.js',
  'common/uproxy.js',
  'common/start-uproxy.js'
];

module.exports = function(grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    copy: {
      chrome_app: {files: [{src: chrome_app_files, dest: 'chrome/app/'}]},
      chrome_ext: {files: [{src: chrome_ext_files, dest: 'chrome/extension/src/'}]},
      firefox: {files: [{src: firefox_files, dest: 'firefox/data/'}]},
      uistatic: {files: [{
        expand: true, flatten: false, cwd: 'common/ui/',
        src: ui_isolation_files, dest: 'uistatic/common/ui',
      }]},
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
        //TODO: this doesn't work, fix it.
        files: ['common/**/*',
                // bower components should only change when grunt is
                // already being run
                '!**/lib/**'],
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
      bower_install: {
        command: 'bower install',
        options: {stdout: true, stderr: true, failOnError: true, execOptions: {cwd: 'common/ui'}}
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
          helpers: ['common/test/example-state.jsonvar',
                    'common/test/example-saved-state.jsonvar'],
          specs: 'common/spec/*Spec.js',
          keepRunner: true
        }
      }
    },
    jsvalidate: {
      files: sourcesToTest.concat(['common/spec/*Spec.js'])
    },
    jshint: {
      all: sourcesToTest.concat(['common/spec/*Spec.js']),
      options: {
        // 'strict': true, // Better to have it in the file
        // 'globalstrict': true,
        'moz': true,   // Used for function closures and other stuff
        '-W069': true,
        '-W097': true  // force: allow "strict use" in non function form.
      }
    },
    sass: {
      main: {
        files: {
          'common/ui/styles/main.css': 'common/ui/styles/main.sass',
        }
      }
    },
    typescript: {
      ui: {
        src: ['common/ui/scripts/ui.ts'],
        dest: 'common/ui/scripts/ui.js'
      },
      uistatic: {
        src: ['uistatic/scripts/dependencies.ts'],
        dest: 'uistatic/scripts/dependencies.js'
      },
      uproxy: {
        src: ['common/uproxy.ts'],
        dest: 'common/uproxy.js'
      },
      chrome: {
        src: ['chrome/extension/src/scripts/background.ts'],
        dest: 'chrome/extension/src/scripts/background.js'
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
  grunt.loadNpmTasks('grunt-contrib-sass');
  grunt.loadNpmTasks('grunt-jsvalidate');
  grunt.loadNpmTasks('grunt-mozilla-addon-sdk');
  grunt.loadNpmTasks('grunt-shell');
  grunt.loadNpmTasks('grunt-typescript');

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
    'shell:bower_install',
  ]);
  grunt.registerTask('test', [
    'jshint:all',
    'jasmine'
  ]);

  // Build the common directory first, which platform-specific builds depend on.
  // Grunt tasks prepended with an '_' do not include this step, in order to
  // prevent redundancy.
  grunt.registerTask('common', [
    'typescript:uproxy',
    'typescript:ui',
    'sass:main',
  ]);

  // Chrome build tasks.
  grunt.registerTask('_build_chrome', [
    'copy:chrome_app',
    'copy:chrome_ext',
    'typescript:chrome',
  ]);
  grunt.registerTask('build_chrome', [
    'common',
    '_build_chrome',
  ]);

  // Firefox build tasks.
  grunt.registerTask('_build_firefox', [
    'concat:firefox',
    'copy:firefox'
  ]);
  grunt.registerTask('build_firefox', [
    'common',
    '_build_firefox'
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

  // Stand-alone UI.
  grunt.registerTask('_ui', [
    'copy:uistatic',
    'typescript:uistatic',
  ]);
  grunt.registerTask('ui', [
    'common',
    '_ui'
  ]);

  grunt.registerTask('buil', ['shell:rickroll']);
  grunt.registerTask('build', [
    'common',
    '_build_chrome',
    '_build_firefox',
    '_ui',
    'jsvalidate',
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
