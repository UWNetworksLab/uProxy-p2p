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

var minimatch = require("minimatch")

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
        {expand: true, cwd: 'src/generic_core',
         src: ['**', '!spec/**', '!**/*.md', '!**/*.ts', '!**/*.sass'],
         dest: 'build/generic_core'},
        // Icons
        {expand: true, cwd: 'src',
         src: ['icons/**'],
         dest: 'build/generic_core'},
        // Libraries
        {expand: true, cwd: 'node_modules/freedom/',
         src: ['freedom.js'],
         dest: 'build/generic_core/lib'}
      ]},

      // Static/independent UI. Assumes the top-level task generic_ui
      // completed.
      uistatic: {files: [
        // The platform specific non-compiled stuff, and...
        {expand: true, cwd: 'src/uistatic',
         src: ['**', '!spec/**', '!**/*.md', '!**/*.ts', '!**/*.sass'],
         dest: 'build/uistatic/'},
        // ... the generic ui stuff
        {expand: true, cwd: 'build/generic_ui',
         src: ['**'],
         dest: 'build/uistatic/'}
      ]},

      // Chrome extension. Assumes the top-level task generic_ui completed.
      chrome_extension: {files: [
        // The platform specific non-compiled stuff, and...
        {expand: true, cwd: 'src/chrome_extension',
         src: ['**', '!spec/**', '!**/*.md', '!**/*.ts', '!**/*.sass'],
         dest: 'build/chrome_extension/'},
        // ... the generic ui stuff
        {expand: true, cwd: 'build/generic_ui',
         src: ['**'],
         dest: 'build/chrome_extension/'}
      ]},

      // Chrome app. Assumes the top-level task generic_core completed.
      chrome_app: {files: [
        // The platform specific stuff, and...
        {expand: true, cwd: 'src/chrome_app',
         src: ['**', '!spec/**', '!**/*.md', '!**/*.ts', '!**/*.sass'],
         dest: 'build/chrome_app/'},
        // ... the generic core stuff
        {expand: true, cwd: 'build/generic_core',
         src: ['**'],
         dest: 'build/chrome_app/'}
      ]},

      // Firefox. Assumes the top-level tasks generic_core and generic_ui
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
              '.sass-cache',
              '.grunt',
              'node_modules',
              'test_output',
              'external_lib/bower_components'],

    //-------------------------------------------------------------------------
    'jasmine': {
      generic_core: {
        // Files being tested
        src: [
          'src/scraps/test/freedom-mocks.js',
          'build/generic_core/util.js',
          'build/generic_core/nouns-and-adjectives.js',
          'build/generic_core/constants.js',
          'build/generic_core/state-storage.js',
          'build/generic_core/uproxy.js',
          'build/generic_core/start-uproxy.js'],
        options: {
          helpers: ['src/scraps/test/example-state.jsonvar',
                    'src/scraps/test/example-saved-state.jsonvar'],
          specs: 'src/generic_core/spec/*Spec.js',
          keepRunner: true,
          outfile: 'test_output/_SpecRunner.html'
        }
      }
    },

    //-------------------------------------------------------------------------
    'sass': {
      generic_ui: {
        files: [
          { src: ['src/generic_ui/styles/main.sass'],
            dest: 'build/generic_ui/styles/main.css' }]
      }
    },

    //-------------------------------------------------------------------------
    'typescript': {
      // uProxy UI without any platform dependencies
      generic_ui: {
        src: ["src/generic_core/core.d.ts", "src/generic_ui/**/*.ts"],
        dest: 'build/generic_ui',
        options: { base_path: 'src/generic_ui/' }
      },

      // Core uProxy without any platform dependencies
      generic_core: {
        src: ["src/generic_ui/scripts/ui.d.ts", "src/generic_core/**/*.ts"],
        dest: 'build/generic_core/',
        options: { base_path: 'src/generic_core/' }
      },

      // uistatic specific typescript
      uistatic: {
        src: ["src/uistatic/**/*.ts"],
        dest: 'build/uistatic/',
        options: { base_path: 'src/uistatic' }
      },

      // uProxy chrome extension specific typescript
      chrome_extension: {
        src: ["src/chrome_extension/src/**/*.ts"],
        dest: 'build/chrome_extension/',
        options: { base_path: 'src/chrome_extension/src/' }
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
  });  // grunt.initConfig

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

  //-------------------------------------------------------------------------
  //Setup task
  grunt.registerTask('setup', [
    'shell:freedom_setup',
    'shell:freedom_build',
    'shell:bower_install',
  ]);

  // Build the common directory first, which platform-specific builds depend on.
  // Grunt tasks prepended with an '_' do not include this step, in order to
  // prevent redundancy.
  grunt.registerTask('build_generic_core', [
    'typescript:generic_core',
    'copy:generic_core'
  ]);

  grunt.registerTask('build_generic_ui', [
    'typescript:generic_ui',
    'sass:generic_ui',
    'copy:generic_ui'
  ]);

  grunt.registerTask('build_uistatic', [
    'build_generic_ui',
    'typescript:uistatic',
    'copy:uistatic'
  ]);

  // Chrome build tasks.
  grunt.registerTask('build_chrome_extension', [
    'build_generic_ui',
    'typescript:chrome_extension',
    'copy:chrome_extension',
  ]);

  grunt.registerTask('build_chrome_app', [
    'build_generic_core',
    'typescript:chrome_app',
    'copy:chrome_app',
  ]);


  // Firefox build tasks.
  grunt.registerTask('build_firefox', [
    'build_generic_ui',
    'build_generic_core',
    'copy:firefox'
  ]);
  grunt.registerTask('build_firefox_xpi', [
    "build_firefox",
    "compress:main"
  ]);
  grunt.registerTask('run_firefox', [
    'build_firefox',
    'mozilla-cfx:debug_run'
  ]);

  grunt.registerTask('test', [
    'build_generic_core',
    'jasmine:generic_core'
  ]);

  grunt.registerTask('build', [
    'build_chrome_app',
    'build_chrome_extension',
    'build_firefox',
    'test'
  ]);

  grunt.registerTask('everything' ['setup', 'build']);

  // Default task(s).
  grunt.registerTask('default', ['build']);

};  // module.exports = function(grunt) ...
