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
 *  build_chrome_extension - build Chrome extension files
 *  build_chrome_app - build Chrome app files
 *  build_firefox - build Firefox
 *  everything - 'setup', 'test', then 'build'
 **/

var TaskManager = require('./tools/taskmanager');

// TODO: Move more file lists here.
var FILES = {
  jasmine_helpers: [
    // Help Jasmine's PhantomJS understand promises.
    'node_modules/es6-promise/dist/promise-*.js',
    '!node_modules/es6-promise/dist/promise-*amd.js',
    '!node_modules/es6-promise/dist/promise-*.min.js'
  ],
  // Mocks for chrome app/extension APIs.
  jasmine_chrome: [
    'build/chrome/test/chrome_mocks.js'
  ],
};

module.exports = function(grunt) {
  grunt.initConfig({

    'pkg': grunt.file.readJSON('package.json'),

    //-------------------------------------------------------------------------
    'shell': {
      bower_install: {
        command: 'bower install',
        options: {stdout: true, stderr: true, failOnError: true}
      },
      // TODO: Get rid of this step once socks-rtc has this automatically done.
      socks_rtc_setup: {
        command: 'npm install;grunt',
        options: {stdout: true, stderr: true, failOnError: true, execOptions: {cwd: 'node_modules/socks-rtc'}}
      },
      // Once compiled, take all .spec files out of the chrome extension and app
      // directories and into the chrome/test directory, to keep a clean distro.
      extract_chrome_tests: {
        command: 'mkdir -p test; mv extension/scripts/*.spec.js test/',
        options: { failOnError: true, execOptions: {cwd: 'build/chrome/' }}
      }
    },

    //-------------------------------------------------------------------------
    'clean': ['build',
              'dist',
              'tmp',
              '.sass-cache',
              '.grunt',
              'node_modules',
              'test_output',
              'third_party/lib'],

    //-------------------------------------------------------------------------
    'copy': {
      // Generic (platform independent) UI stuff to be copied.
      generic_ui: {files: [
        // Non-compiled generic stuff
        {expand: true, cwd: 'src/generic_ui',
         src: ['**', '!**/spec', '!**/*.md', '!**/*.ts', '!**/*.sass'],
         dest: 'build/generic_ui'},
        // Icons
        {expand: true, cwd: 'src',
         src: ['icons/**'],
         dest: 'build/generic_ui'},
        // Libraries
        {expand: true, cwd: 'third-party/lib/',
         src: ['lodash/dist/lodash.js',
               'angular/angular.js',
               'angular-animate/angular-animate.js',
               'angular-lodash/angular-lodash.js'],
         dest: 'build/generic_ui/lib'}
      ]},

      generic_core: {files: [
        // Non-compiled generic stuff
        {expand: true, cwd: 'src/generic_core',
         src: ['**', '!**.spec.js', '!**.spec.ts', '!**/*.md', '!**/*.ts', '!**/*.sass'],
         dest: 'build/generic_core'},
        // Icons
        {expand: true, cwd: 'src',
         src: ['icons/**'],
         dest: 'build/'},
        // TODO: update the social provider to this when ready:
        // {expand: true, cwd: 'node_modules/freedom-social-xmpp‎/node-xmpp-browser.js',
        //  src: ['node-xmpp-browser.js'],
        //  dest: 'build/generic_core/lib'}
      ]},

      // Static/independent UI. Assumes the top-level task generic_ui
      // completed.
      uistatic: {files: [
        // The platform specific non-compiled stuff, and...
        {expand: true, cwd: 'src/uistatic',
         src: ['**', '!**/spec', '!**/*.md', '!**/*.ts', '!**/*.sass'],
         dest: 'build/uistatic/'},
        // ... the generic ui stuff
        {expand: true, cwd: 'build/generic_ui',
         src: ['**'],
         dest: 'build/uistatic/'}
      ]},

      // Chrome extension. Assumes the top-level task generic_ui completed.
      chrome_extension: {
        nonull: true,
        files: [
        // The platform specific non-compiled stuff, and...
        {expand: true, cwd: 'src/chrome/extension',
         src: ['**', '!**/*.md', '!**/*.ts', '!**/*.sass'],
         dest: 'build/chrome/extension/'},
        // Source code (generic UI)
        {expand: true, cwd: 'build/generic_ui',
         src: ['**'],
         dest: 'build/chrome/extension/'},
        {expand: true, cwd: 'build/', flatten: true,
         src: ['uproxy.js', 'chrome/util/chrome_glue.js'],
         dest: 'build/chrome/extension/scripts/'},
        // Libraries
        {expand: true, cwd: 'node_modules/freedom-for-chrome/',
         src: ['freedom.js'],
         dest: 'build/chrome/extension/lib'},
        {expand: true, cwd: 'third_party/lib',
         src: ['**/*.js'],
         dest: 'build/chrome/extension/lib'},
      ]},

      // Copy dependencies for the Chrome app.
      // Assumes the top-level task generic_core completed.
      // - All scripts, both from generic_core and specific to the chrome-side
      // of uProxy, will go into chrome/app/scripts/*.
      // - All libraries, such as freedom providers, will go into
      // chrome/app/lib/*.
      chrome_app: {
        nonull: true, files: [
        // The platform specific non-compiled stuff, and...
        {expand: true, cwd: 'src/chrome/app',
         src: ['**', '!**/*.spec.js', '!**/*.md', '!**/*.ts', '!**/*.sass'],
         dest: 'build/chrome/app/'},

        // Sourcecode (no specs):
        {expand: true, cwd: 'build/', flatten: true,
         src: ['uproxy.js', 'generic_core/uproxy.json',
               'generic_core/**/*.js', '!**/*.spec.js'],
         dest: 'build/chrome/app/scripts/'},
        {expand: true, cwd: 'build/chrome/util',
         src: ['chrome_glue.js'],
         dest: 'build/chrome/app/scripts/'},

        // Libraries:
        {expand: true, cwd: 'node_modules/freedom-for-chrome/',
         src: ['freedom-for-chrome.js'],
         dest: 'build/chrome/app/lib'},
        {expand: true, cwd: 'node_modules/socks-rtc/build/',
         src: ['rtc-to-net/**'],
         dest: 'build/chrome/app/lib'},
        {expand: true, cwd: 'node_modules/socks-rtc/build/',
         src: ['socks-to-rtc/**'],
         dest: 'build/chrome/app/lib'},
        {expand: true, cwd: 'node_modules/freedom/providers/social',
         src: ['websocket-server/**'],
         dest: 'build/chrome/app/lib'},
        {expand: true, cwd: 'node_modules/freedom-social-xmpp/build/',
         src: ['**'],
         dest: 'build/chrome/app/lib/freedom-social-xmpp'},
        {expand: true, cwd: 'node_modules/freedom/providers/storage/isolated',
         src: ['**'],
         dest: 'build/chrome/app/lib/storage'},
        // {expand: true, cwd: 'node_modules/socks-rtc/src/chrome-providers',
         // src: ['**'],
         // dest: 'build/chrome/app/lib/freedom-providers'}

        // uProxy Icons.
        {expand: true, cwd: 'build/icons',
         src: ['**'],
         dest: 'build/chrome/app/icons'},
      ]},

      // Firefox. Assumes the top-level tasks generic_core and generic_ui
      // completed.
      firefox: {files: [
        // The platform specific stuff, and...
        {expand: true, cwd: 'src/firefox/',
         src: ['**', '!**/spec', '!**/*.md', '!**/*.ts', '!**/*.sass'],
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
    'sass': {
      generic_ui: {
        files: [
          { expand: true, cwd: 'src/generic_ui',
            src: ['**/*.sass'],
            dest: 'build/generic_ui/',
            ext: '.css'
          }]
      }
    },

    //-------------------------------------------------------------------------
    'typescript': {
      // uProxy UI without any platform dependencies
      generic_ui: {
        src: ['src/generic_ui/**/*.ts'],
        dest: 'build/',
        options: { basePath: 'src/' }
      },

      // Core uProxy without any platform dependencies
      generic_core: {
        src: ['src/generic_core/**/*.ts'],
        dest: 'build/',
        options: { basePath: 'src/' }
      },

      // uistatic specific typescript
      uistatic: {
        src: ['src/generic_ui/scripts/ui.d.ts',
              'src/generic_core/core.d.ts',
              'src/generic_ui/scripts/ui.ts',
              'src/uistatic/scripts/dependencies.ts'],
        dest: 'build/uistatic/',
      },

      // Compile typescript for all chrome components. This will do both the app
      // and extension in one go, along with their specs, because they all share
      // references to the same parts of uProxy. This avoids double-compiling,
      // (which in this case, is beyond TaskManager's reach.)
      // In the ideal world, there shouldn't be an App/Extension split.
      // The shell:extract_chrome_tests will pull the specs outside of the
      // actual distribution directory.
      chrome: {
        src: ['src/chrome/**/*.ts',
              '!src/chrome/mocks/**'],
        dest: 'build/',
        options: { basePath: 'src/' }
      },

      // Compile the Chrome mocks separately from above. Otherwise, there will
      // be problematic mixing of Ambient / Non-Ambient contexts for things like
      // the chrome.runtime declarations.
      chrome_mocks: {
        src: ['src/chrome/mocks/**/*.ts'],
        dest: 'build/chrome/test/',
        options: { basePath: 'src/chrome/mocks/' }
      },

      // uProxy firefox specific typescript
      firefox: {
        src: ['src/firefox/**/*.ts'],
        dest: 'build/firefox/',
        options: { basePath: 'src/firefox/' }
      },

    },

    //-------------------------------------------------------------------------
    'concat': {
      uistatic: {
        files: [
          {src: ['build/uistatic/src/generic_ui/scripts/ui.js',
                 'build/uistatic/src/uistatic/scripts/dependencies.js'],
           dest: 'build/uistatic/scripts/dependencies.js'}
        ]
      }
    },

    //-------------------------------------------------------------------------
    'jasmine': {
      chrome_extension: {
        src: FILES.jasmine_helpers
            .concat(FILES.jasmine_chrome)
            .concat([
              'build/chrome/extension/scripts/core_connector.js',
              'build/chrome/extension/scripts/chrome_glue.js'
            ]),
        options: {
          keepRunner: true,
          outfile: 'test_output/_ChromeExtensionSpecRunner.html',
          specs: 'build/chrome/test/**/*.spec.js'
        }
      },
      generic_core: {
        src: FILES.jasmine_helpers
            .concat([
              'src/scraps/test/freedom-mocks.js',
              'build/interfaces/uproxy.js',
              'build/generic_core/util.js',
              'build/generic_core/nouns-and-adjectives.js',
              'build/generic_core/constants.js',
              'build/generic_core/state-storage.js',
              'build/generic_core/social.js',
              'build/generic_core/core.js',
              'build/generic_core/start-uproxy.js'
            ]),
        options: {
          helpers: ['src/scraps/test/example-state.jsonvar',
                    'src/scraps/test/example-saved-state.jsonvar'],
          keepRunner: true,
          outfile: 'test_output/_CoreSpecRunner.html',
          specs: 'src/generic_core/**/*.spec.js'
        }
      }
    },

    //-------------------------------------------------------------------------
    'mozilla-cfx': {
      debug_run: {
        options: {
          extension_dir: 'dist/firefox',
          command: 'run'
        }
      }
    },

    //-------------------------------------------------------------------------
    'compress': {
      main: {
        options: {
          mode: 'zip',
          archive: 'dist/uproxy.xpi'
        },
        expand: true,
        cwd: 'build/firefox',
        src: ['**'],
        dest: '.'
      }
    },

  });  // grunt.initConfig


  //---------------------------------------------------------------------------
  // Helper function for watch.
  // Combines the cwd and src params of a file to make an expanded src. Used
  // to make a watch actually watch the dependent files.
  // TODO: Write in typescript and specify types.
  function makeSrcOfFiles(files_config_property) {
    var srcs = [];
    var files = grunt.config.get(files_config_property);
    files.map(function(file) {
      file.src.map(function(s) { srcs.push(file.cwd + '/' + s); });
    });
    if(srcs == []) {
      throw('makeSrcOfFiles failed for: ' + files_config_property);
    }
    return srcs;
  }
  grunt.config.set('watch', {
    typescript_generic_ui: {
      files: '<%= typescript.generic_ui.src %>',
      tasks: ['typescript:generic_ui']
    },
    typescript_generic_core: {
      files: '<%= typescript.generic_core.src %>',
      tasks: ['typescript:generic_core']
    },
    typescript_chrome: {
      files: '<%= typescript.chrome.src %>',
      tasks: ['typescript:chrome']
    },
    typescript_chrome_app: {
      files: '<%= typescript.chrome_app.src %>',
      tasks: ['typescript:chrome_app']
    },
    typescript_chrome_extension: {
      files: '<%= typescript.chrome_extension.src %>',
      tasks: ['typescript:chrome_extension']
    },
    typescript_uistatic: {
      files: '<%= typescript.uistatic.src %>',
      tasks: ['typescript:uistatic']
    },
    typescript_firefox: {
      files: '<%= typescript.firefox.src %>',
      tasks: ['typescript:firefox']
    },
    concat_uistatic: {
      files: makeSrcOfFiles('concat.uistatic.files'),
      tasks: ['concat:uistatic']
    },
    sass_generic_ui: {
      files: makeSrcOfFiles('sass.generic_ui.files'),
      tasks: ['sass:generic_ui']
    },
    copy_generic_ui: {
      files: makeSrcOfFiles('copy.generic_ui.files'),
      tasks: ['copy:generic_ui']
    },
    copy_generic_core: {
      files: makeSrcOfFiles('copy.generic_core.files'),
      tasks: ['copy:generic_core']
    },
    copy_uistatic: {
      files: makeSrcOfFiles('copy.uistatic.files'),
      tasks: ['copy:uistatic']
    },
    copy_chrome_extension: {
      files: makeSrcOfFiles('copy.chrome_extension.files'),
      tasks: ['copy:chrome_extension']
    },
    copy_chrome_app: {
      files: makeSrcOfFiles('copy.chrome_app.files'),
      tasks: ['copy:chrome_app']
    },
    copy_firefox: {
      files: makeSrcOfFiles('copy.firefox.files'),
      tasks: ['copy:firefox']
    },
  });

  //-------------------------------------------------------------------------
  // These should match exactly with those listed in package.json.
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-compress');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-jasmine');
  grunt.loadNpmTasks('grunt-contrib-sass');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-shell');
  grunt.loadNpmTasks('grunt-typescript');

  //-------------------------------------------------------------------------
  // Define tasks. We use TaskManager to avoid pointless re-compilation.
  // TODO: Make TaskManager understand timestamps so it avoids re-compliation
  // things that have not been modified between compilations.
  var taskManager = new TaskManager.Manager();

  taskManager.add('setup', [
    'shell:bower_install',
  ]);

  taskManager.add('build_generic_core', [
    'typescript:generic_core',
    'copy:generic_core'
  ]);

  taskManager.add('build_generic_ui', [
    'typescript:generic_ui',
    'sass:generic_ui',
    'copy:generic_ui'
  ]);

  taskManager.add('build_uistatic', [
    'build_generic_ui',
    'typescript:uistatic',
    'concat:uistatic',
    'copy:uistatic'
  ]);

  // The Chrome App and the Chrome Extension cannot be built separately. They
  // share dependencies, which implies a directory structure.
  taskManager.add('build_chrome', [
    'build_generic_ui',
    'build_generic_core',
    'typescript:chrome',
    'copy:chrome_app',
    'copy:chrome_extension',
    'shell:extract_chrome_tests'
  ]);

  // Firefox build tasks.
  taskManager.add('build_firefox', [
    'build_generic_ui',
    'build_generic_core',
    'copy:firefox'
  ]);

  taskManager.add('build_firefox_xpi', [
    'build_firefox',
    'compress:main'
  ]);

  taskManager.add('run_firefox', [
    'build_firefox',
    'mozilla-cfx:debug_run'
  ]);

  taskManager.add('test_core', [
    'build_generic_core',
    'jasmine:generic_core'
  ]);

  taskManager.add('test_chrome_extension', [
    'build_chrome',
    'typescript:chrome_mocks',
    'jasmine:chrome_extension'
  ]);

  taskManager.add('test', [
    'test_core',
    'test_chrome_extension'
  ]);

  taskManager.add('build', [
    'build_chrome',
    'build_firefox',
    'build_uistatic',
  ]);

  taskManager.add('everything', ['setup', 'build', 'test']);

  // Default task(s).
  taskManager.add('default', ['build']);

  taskManager.list().forEach(function(n) {
    console.log('\n * ' + n + ': ' + taskManager.get(n).join(', '));
    console.log(' * ' + n + '(unflat): ' + taskManager.getUnflattened(n).join(', '));
  });

  //-------------------------------------------------------------------------
  //Setup tasks
  taskManager.list().forEach(function(taskName) {
    grunt.registerTask(taskName, taskManager.get(taskName));
  });

};  // module.exports = function(grunt) ...
