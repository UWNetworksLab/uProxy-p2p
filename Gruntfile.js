/**
 * UProxy Grunt Build System
 * Support commands:
 * grunt
 *  build - Builds Chrome and Firefox extensions
 *  setup - Installs local dependencies and sets up environment
 *  xpi - Generates an .xpi for installation to Firefox.
 *  test - Run unit tests
 *  watch - Watch for changes in 'common' and copy as necessary
 *  clean - Cleans up
 *  build_chrome - build Chrome files
 *  build_firefox - build Firefox
 *  everything - 'setup', 'test', then 'build'
 **/

var path = require("path");
var minimatch = require("minimatch");

//-----------------------------------------------------------------------------
//List of all files for each distribution
//NOTE: This is ultimately what gets copied, so keep this precise
//NOTE: Keep all exclusion paths ('!' prefix) after the path they are in


// Files for the uProxy chrome app
var chrome_app = {
  src: [ // in 'src' directory
    'core/**',
    '!core/spec/**',
    'icons/**',
    // scraps is a place for throwing example code for demonstrating stuff to each other.
    'scraps/**',
    '!**/*.ts'],
  lib: [
    'external_lib/bower_components/lodash/dist/lodash.min.js']
};

// Files for the uProxy chrome extension
var chrome_ext = {
  src: [ // in 'src' directory
    'ui/**',
    'icons/**',
    '!**/*.ts'],
  lib: [
    'external_lib/bower_components/lodash/dist/lodash.js',
    'external_lib/bower_components/angular/angular.js',
    ]
};

// Files for uProxy in firefox
var firefox = {
  src: [
    'core/**',
    '!core/spec/**',
    'ui/**',
    'icons/**',
    '!**/*.ts'],
  lib: [
    'external_lib/bower_components/lodash/dist/lodash.min.js']
};

// Files for the standalone UI
var uistatic = {
  src: [
    'ui/popup.html',
    'ui/scripts/**',
    'ui/styles/**',
    'icons/**',
    'core/core.d.ts',
    '!**/*.ts'],
  lib: [
    'external_lib/bower_components/lodash/dist/lodash.min.js']
};

//-----------------------------------------------------------------------------
function copyUiFiles(dest) {
  return
}

module.exports = function(grunt) {
  grunt.initConfig({
    'pkg': grunt.file.readJSON('package.json'),

    //-------------------------------------------------------------------------
    'copy': {
      // Generic (platform independent) UI stuff to be copied.
      generic_ui: {files: [
        // Non-compiled generic stuff
        {expand: true, cwd: 'src/ui',
         src: ['**', '!spec/**', '!**/*.md', '!**/*.ts', '!**/*.sass'],
         dest: 'build/generic_ui'},
        // Icons
        {expand: true, cwd: 'src',
         src: ['icons/**'],
         dest: 'build/generic_ui'},
        // Libraries
        {expand: true, cwd: 'external_lib/bower_components/',
         src: ['lodash/dist/lodash.js',
               'angular/angular.js',
               'angular-animate/angular-animate.js',
               'angular-lodash/angular-lodash.js'],
         dest: 'build/generic_ui/lib'}
      ]},

      generic_core: {files: [
        // Non-compiled generic stuff
        {expand: true, cwd: 'src/core',
         src: ['**', '!spec/**', '!**/*.md', '!**/*.ts', '!**/*.sass'],
         dest: 'build/generic_ui'},
        // Icons
        {expand: true, cwd: 'src',
         src: ['icons/**'],
         dest: 'build/generic_ui'},
        // Libraries
        {expand: true, cwd: 'node_modules/freedom/',
         src: ['freedom.js'],
         dest: 'build/generic_ui/lib'}
      ]},

      // Chrome extension. Assumes the top-level task generic-ui completed.
      chrome_ext: {files: [
        // The platform specific non-compiled stuff, and...
        {expand: true, cwd: 'src/chrome/extension/src',
         src: ['**', '!spec/**', '!**/*.md', '!**/*.ts', '!**/*.sass'],
         dest: 'build/chrome_extension/'},
        // ... the generic ui stuff
        {expand: true, cwd: 'build/generic_ui',
         src: ['**'],
         dest: 'build/chrome_extension/'}
      ]},

      // Chrome app. Assumes the top-level task generic-core completed.
      chrome_app: {files: [
        // The platform specific stuff, and...
        {expand: true, cwd: 'src/chrome/app',
         src: ['**', '!spec/**', '!**/*.md', '!**/*.ts', '!**/*.sass'],
         dest: 'build/chrome_app/'},
        // ... the generic core stuff
        {expand: true, cwd: 'build/generic_core',
         src: ['**'],
         dest: 'build/chrome_app/'}
      ]},

      // Firefox. Assumes the top-level tasks generic-core and generic-ui
      // completed.
      firefox: {files: [
        // The platform specific stuff, and...
        {expand: true, cwd: 'src/firefox/',
         src: ['**', '!spec/**', '!**/*.md', '!**/*.ts', '!**/*.sass'],
         dest: 'build/firefox/'},
        // ... the generic core stuff
        {expand: true, cwd: 'build/generic_core',
         src: ['**'],
         dest: 'build/firefox/'},
        // ... the generic UI stuff
        {expand: true, cwd: 'build/generic_ui',
         src: ['**'],
         dest: 'build/firefox/'}
      ]}
    },

    //-------------------------------------------------------------------------
    'compress': {
      main: {
        options: {
          mode: 'zip',
          archive: 'dist/uproxy.xpi'
        },
        expand: true,
        cwd: "build/firefox",
        src: ['**'],
        dest: '.'
      }
    },

    //-------------------------------------------------------------------------
    'shell': {
      bower_install: {
        command: 'bower install',
        options: {stdout: true, stderr: true, failOnError: true}
      },
      freedom_setup: {
        command: 'npm install',
        options: {stdout: true, stderr: true, failOnError: true, execOptions: {cwd: 'node_modules/freedom'}}
      },
      freedom_build: {
        command: 'grunt',
        options: {stdout: true, stderr: true, failOnError: true, execOptions: {cwd: 'node_modules/freedom'}}
      },
    },

    //-------------------------------------------------------------------------
    'clean': ['build',
              'dist',
              'tmp',
              'tscommand.tmp.txt',
              'node_modules',
              'external_lib/bower_components'],

    //-------------------------------------------------------------------------
    'jasmine': {
      common: {
        // Files being tested
        src: [
          'src/scraps/freedom-mocks.js',
          'src/core/util.js',
          'src/core/nouns-and-adjectives.js',
          'src/core/constants.js',
          'src/core/state-storage.js',
          'src/core/uproxy.js',
          'src/core/start-uproxy.js'],
        options: {
          helpers: ['src/scraps/test/example-state.jsonvar',
                    'src/scraps/test/example-saved-state.jsonvar'],
          specs: 'src/core/spec/*Spec.js',
          keepRunner: true
        }
      }
    },

    //-------------------------------------------------------------------------
    'sass': {
      ui: {
        files: [
          { src: ['src/ui/styles/main.sass'],
            dest: 'build/generic_ui/styles/main.css' }]
      }
    },

    //-------------------------------------------------------------------------
    'typescript': {
      // uProxy UI without any platform dependencies
      generic_ui: {
        src: ["src/ui/**/*.ts"],
        dest: 'build/generic_ui',
        options: { base_path: 'src/ui/' }
      },

      // Core uProxy without any platform dependencies
      generic_core: {
        src: ["src/core/**/*.ts"],
        dest: 'build/generic_core/',
        options: { base_path: 'src/core/' }
      },

      // uistatic specific typescript
      uistatic: {
        src: ["src/uistatic/scripts/dependencies.ts"],
        dest: 'build/uistatic/',
        options: { base_path: 'src/uistatic' }
      },

      // uProxy chrome extension specific typescript
      chrome_extension: {
        src: ["src/chrome/extension/src/scripts/background.ts"],
        dest: 'build/chrome_extension/',
        options: { base_path: 'src/chrome/extension/src/' }
      },

      // uProxy chrome app specific typescript
      chrome_app: {
        src: [],
        dest: 'build/chrome_app/',
      },

      // uProxy firefox specific typescript
      firefox: {
        src: [],
        dest: 'build/firefox/',
      },
    },

    'mozilla-cfx': {
      debug_run: {
        options: {
          extension_dir: 'dist/firefox',
          command: 'run'
        }
      }
    }
  });

  //-------------------------------------------------------------------------
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-compress');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-jasmine');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-sass');
  grunt.loadNpmTasks('grunt-shell');
  grunt.loadNpmTasks('grunt-typescript');
  grunt.loadNpmTasks('grunt-ts');

  //-------------------------------------------------------------------------
  //Setup task
  grunt.registerTask('setup', [
    'shell:freedom_setup',
    'shell:freedom_build',
    'shell:bower_install',
  ]);

  grunt.registerTask('test', [
    'jasmine'
  ]);

  // Build the common directory first, which platform-specific builds depend on.
  // Grunt tasks prepended with an '_' do not include this step, in order to
  // prevent redundancy.
  grunt.registerTask('generic_core', [
    'typescript:core',
  ]);

  grunt.registerTask('generic_ui', [
    'typescript:ui',
    'sass:ui',
  ]);

  grunt.registerTask('uistatic', [
    'typescript:uistatic',
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
    'copy:firefox'
  ]);
  grunt.registerTask('build_firefox', [
    'common',
    '_build_firefox'
  ]);

  grunt.registerTask('xpi', [
    "build_firefox",
    "compress:main"
  ]);
  grunt.registerTask('ff', [
    'build_firefox',
    'mozilla-cfx'
  ]);

  grunt.registerTask('build_firefox', [
    'copy:firefox'
  ]);

  // Stand-alone UI.
  grunt.registerTask('_ui', [
    'typescript:ui',
    'sass:ui',
    'copy:uistatic',
    'typescript:uistatic',
  ]);
  grunt.registerTask('ui', [
    'common',
    '_ui'
  ]);

  grunt.registerTask('build', [
    'common',
    '_build_chrome',
    '_build_firefox',
    '_ui',
    'test'
  ]);

  grunt.registerTask('everything' ['setup', 'build']);

  // Default task(s).
  grunt.registerTask('default', ['build']);

};  // module.exports = function(grunt) ...
