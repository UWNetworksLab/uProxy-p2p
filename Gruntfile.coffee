###
Gruntfile for uProxy

This is the build file for all of uProxy.

TODO: This is currently not fully functional, due to many things being in flux
as we change much of the repo.
TODO: Remove all of the separate repositories and make everything one repository
again.
###

TaskManager = require 'uproxy-lib/tools/taskmanager'
Rule = require 'uproxy-lib/tools/common-grunt-rules'
Path = require 'path'

fs = require 'fs'
path = require 'path'

getNodePath = (module) =>
  Path.dirname(require.resolve(module + '/package.json'))

chromeExtDevPath = 'build/dev/chrome/extension/'
chromeAppDevPath = 'build/dev/chrome/app/'
firefoxDevPath = 'build/dev/firefox/'

# TODO: Move this into common-grunt-rules in uproxy-lib.
# We need *.ts files for typescript compilation
# and *.html files for polymer vulcanize compilation
Rule.symlink = (dir, dest='') =>
  { files: [ {
    expand: true,
    overwrite: true,
    cwd: dir,
    src: ['**/*.ts', '**/*.html'],
    dest: 'build/compile-src/' + dest} ] }

# Use symlinkSrc with the name of the module, and it will automatically symlink
# the path to its src/ directory.
Rule.symlinkSrc = (module) => Rule.symlink Path.join(getNodePath(module), 'src')
Rule.symlinkThirdParty = (module) =>
  Rule.symlink(Path.join(getNodePath(module), 'third_party'), 'third_party')


# # TODO: When we make the 'distribution' build which uglifies all js and removes
# # the specs, make a corresponding rule which makes everything go into
# # 'build/dist'.
# Rule.typescriptSrcDev = (name) =>
#   rule = Rule.typescriptSrc name
#   rule.dest = 'build/dev/'
#   rule

# Temporary wrappers which allow implicit any.
# TODO: Remove once implicit anys are fixed. (This is actually happening in some
# of the DefinitelyTyped definitions - i.e. MediaStream.d.ts, and many other
# places)
Rule.typescriptSrcLenient = (name) =>
  rule = Rule.typescriptSrc name
  rule.options.noImplicitAny = false
  rule
Rule.typescriptSpecDeclLenient = (name) =>
  rule = Rule.typescriptSpecDecl name
  rule.options.noImplicitAny = false
  rule


# TODO: Move more file lists here.
FILES =
  jasmine_helpers: [
    # Help Jasmine's PhantomJS understand promises.
    'node_modules/es6-promise/dist/promise-*.js'
    '!node_modules/es6-promise/dist/promise-*amd.js'
    '!node_modules/es6-promise/dist/promise-*.min.js'
  ]
  # Files which are required at run-time everywhere.
  uproxy_common: [
    'uproxy.js'
    'generic_core/consent.js'
    'generic_core/util.js'
  ]

  uproxy_networking_common: [
    'ipaddrjs/ipaddr.min.js'
    'tcp/tcp.js'
    'socks-common/socks-headers.js'
    'socks-to-rtc/socks-to-rtc.js'
    'rtc-to-net/rtc-to-net.js'
  ]
  uproxy_lib_common: [
    'logging/logging.js'
    'arraybuffers/arraybuffers.js'
    'handler/queue.js'
    'webrtc/datachannel.js'
    'webrtc/peerconnection.js'
  ]
  thirdPartyUi: [
    'lodash/**',
    'platform/**',
    'polymer/**',
    'webcomponentsjs/**'
  ]


module.exports = (grunt) ->
  grunt.initConfig
    pkg: grunt.file.readJSON('package.json')

    # Decrease log output for noisy things like symlink.
    verbosity:
      diminished:
        options: { mode: 'oneline' }
        tasks: ['symlink']

    symlink:
      # Symlink all module directories in `src` into compile-src, and
      # merge `third_party` from different places as well.
      typescriptSrc: Rule.symlinkSrc '.'
      thirdPartyTypescriptSrc: Rule.symlinkThirdParty '.'

      uproxyNetworkingThirdPartyTypescriptSrc: Rule.symlinkThirdParty 'uproxy-networking'
      uproxyNetworkingTypescriptSrc: Rule.symlinkSrc 'uproxy-networking'

      uproxyLibThirdPartyTypescriptSrc: Rule.symlinkThirdParty 'uproxy-lib'
      uproxyLibTypescriptSrc: Rule.symlinkSrc 'uproxy-lib'

      uproxyChurnTypescriptSrc: Rule.symlinkSrc 'uproxy-churn'

      polymer:
        src: 'third_party/lib'
        dest: 'build/compile-src/generic_ui/lib'


    shell: {

      # Once compiled, take all .spec files out of the chrome extension and app
      # directories and into the chrome/test directory, to keep a clean distro.
      # TODO: Change to have a separate task that creates a distribution, and
      # remove this hacky test extraction.
      extract_chrome_tests: {
        command: 'mkdir -p test; mv extension/scripts/*.spec.js test/',
        options: { failOnError: true, execOptions: {cwd: 'build/chrome/' }}
      }

    }  # shell

    concat: {

      firefox_uproxy: {
        files: [ {
          src: [firefoxDevPath + 'data/core/uproxy.js'
                firefoxDevPath + 'lib/exports.js']
          dest: firefoxDevPath + 'lib/uproxy.js'
        }]
      }

      firefox_dependencies: {
        files: [ {
          src: [firefoxDevPath + 'data/scripts/port.js'
                firefoxDevPath + 'data/scripts/user.js'
                firefoxDevPath + 'data/scripts/uproxy.js'
                firefoxDevPath + 'data/scripts/ui.js'
                firefoxDevPath + 'data/scripts/firefox_browser_api.js'
                firefoxDevPath + 'data/scripts/firefox_connector.js'
                firefoxDevPath + 'data/scripts/core_connector.js'
                firefoxDevPath + 'data/scripts/background.js']
          dest: firefoxDevPath + 'data/scripts/dependencies.js'
        }]
      }
    }  # concat

    #-------------------------------------------------------------------------
    copy: {
      # Copy any JavaScript from the third_party directory
      thirdPartyJavaScript: { files: [ {
          expand: true,
          src: [
            'third_party/freedom-ts-hacks/*.js',
            'third_party/lib/core-component-page/**/*.js',
            'third_party/lib/platform/**/*.js',
            'third_party/lib/polymer/**/*.js',
            'third_party/lib/webcomponentsjs/**/*.js'
            ]
          dest: 'build/'
          onlyIf: 'modified'
        } ] }

      chrome_extension:
        nonull: true
        files: [ {
          # The platform specific non-compiled stuff, and...
          expand: true, cwd: 'src/chrome/extension'
          src: ['**', '!**/*.md', '!**/*.ts']
          dest: chromeExtDevPath
        }, {
          # generic_ui HTML and non-typescript assets.
          expand: true, cwd: 'src/generic_ui',
          src: ['styles/**']
          dest: chromeExtDevPath
        }, {
          # generic_ui compiled source.
          # (Assumes the typescript task has executed)
          expand: true, cwd: 'build/compile-src/generic_ui'
          src: ['scripts/**', '*.html', 'polymer/vulcanized.*', '!**/*.ts']
          dest: chromeExtDevPath
        }, {
          # Chrome-only polymer.
          # (Assumes the typescript task has executed)
          expand: true, cwd: 'build/compile-src/chrome/extension/polymer'
          src: ['vulcanized-chrome.*']
          dest: chromeExtDevPath + 'polymer'
        }, {
          # Icons and fonts
          expand: true, cwd: 'src/'
          src: ['icons/*', 'fonts/*']
          dest: chromeExtDevPath
        }, {
          expand: true, cwd: 'build/compile-src/', flatten: true
          src: FILES.uproxy_common
            .concat [
              'chrome/extension/scripts/*.js'
            ]
          dest: chromeExtDevPath + 'scripts/'
        }, {
          expand: true, cwd: 'third_party/lib'
          src: FILES.thirdPartyUi
          dest: chromeExtDevPath + 'lib'
        } ]

      chrome_app:
        nonull: true

        files: [ {  # Copy .js, .json, etc from src to build/dev/chrome/app
          expand: true, cwd: 'src/chrome/app'
          src: ['**', '!**/*.spec.js', '!**/*.md', '!**/*.ts']
          dest: chromeAppDevPath
        }, {  # Freedom manifest for uproxy
          expand: true, cwd: 'src/generic_core/'
          src: ['freedom-module.json']
          dest: chromeAppDevPath + 'scripts/'
        }, {  # Copy compiled typescript (no .spec) to build/dev/chrome/app/scripts
          expand: true, cwd: 'build/compile-src/', flatten: true
          src: [
            'uproxy.js'
            'chrome/app/scripts/*.js'
            'generic_core/**/*.js'
            '!**/*.spec.js'
          ]
          dest: chromeAppDevPath + 'scripts/'
        }, {  # Freedom
          expand: true, cwd: 'node_modules/freedom-for-chrome/'
          src: [
            'freedom-for-chrome.js'
          ]
          dest: chromeAppDevPath + 'lib/'
        }, {
          expand: true, cwd: 'node_modules/freedom-social-xmpp', flatten: true
          src: [
            'dist/**'
          ]
          dest: chromeAppDevPath + 'lib/freedom-social-xmpp'
        }, {
          expand: true, cwd: 'node_modules/freedom/providers/storage', flatten: true
          src: [
            'shared/**'
          ]
          dest: chromeAppDevPath + 'lib/storage'
        }, {  # Additional hack - TODO: remove this once social enum is gone.
          expand: true, cwd: 'third_party', flatten: true
          src: [
            'freedom-ts-hacks/social-enum.js'
          ]
          dest: chromeAppDevPath + 'scripts/'
        }, {  # uProxy Icons and fonts
          expand: true, cwd: 'src/'
          src: ['icons/default-*.png', 'fonts/*']
          dest: chromeAppDevPath
        }, { # Copy uproxy-lib files.
          expand: true, cwd: 'node_modules/uproxy-lib/dist/',
          src: FILES.uproxy_lib_common,
          dest: chromeAppDevPath + 'scripts/uproxy-lib/'
        }, { # Copy uproxy-networking files.
          expand: true, cwd: 'node_modules/uproxy-networking/dist/',
          src: FILES.uproxy_networking_common,
          dest: chromeAppDevPath + 'scripts/uproxy-networking/'
        }]

      # Firefox. Assumes the top-level tasks generic_core and generic_ui
      # completed.
      firefox:
        files: [ {
          # The platform specific stuff, and...
          expand: true, cwd: 'src/firefox/'
          src: ['**', '!**/spec', '!**/*.md', '!**/*.ts']
          dest: firefoxDevPath
        }, {  # Freedom manifest for uproxy
          expand: true, cwd: 'src/generic_core/'
          src: ['freedom-module.json']
          dest: firefoxDevPath + 'data/core/'
        }, {  # Additional hack - TODO: remove this once social enum is gone.
          expand: true, cwd: 'third_party', flatten: true
          src: [
            'freedom-ts-hacks/social-enum.js'
          ]
          dest: firefoxDevPath + 'data/core/'
         }, {
           expand: true, cwd: 'build/compile-src'
           src: ['uproxy.js']
           dest: firefoxDevPath + 'data/core/'
        # ... the generic core stuff
        }, {
          expand: true, cwd: 'build/compile-src/generic_core'
          src: ['**'],
          dest: firefoxDevPath + 'data/core/'
        }, {
          # generic_ui HTML and non-typescript assets.
          expand: true, cwd: 'src/generic_ui',
          src: ['styles/**']
          dest: firefoxDevPath + 'data/'
        }, {
        # ... the generic UI stuff
          expand: true, cwd: 'build/compile-src/generic_ui'
          src: ['scripts/**', '*.html', 'polymer/vulcanized.*', '!**/*.ts']
          dest: firefoxDevPath + 'data/'
        }, {
          # Icons and fonts
          expand: true, cwd: 'src/'
          src: ['icons/*', 'fonts/*']
          dest: firefoxDevPath + 'data/'
        }, {
          expand: true, cwd: 'build/compile-src', flatten: true
          src: ['uproxy.js', 'firefox/data/scripts/*.js'],
          dest: firefoxDevPath + 'data/scripts'
        # freedom for firefox
        }, {
          expand: true, cwd: 'node_modules/freedom-for-firefox/'
          src: ['freedom-for-firefox.jsm']
          dest: firefoxDevPath + 'data'
        }, { # Copy uproxy-networking files.
          expand: true, cwd: 'node_modules/uproxy-networking/dist/',
          src: FILES.uproxy_networking_common,
          dest: firefoxDevPath + 'data/core/uproxy-networking'
        }, {
          expand: true, cwd: 'node_modules/freedom/providers/social'
          src: ['websocket-server/**']
          dest: firefoxDevPath + 'data/lib'
        }, {
          expand: true, cwd: 'node_modules/freedom-social-xmpp/dist/'
          src: ['**']
          dest: firefoxDevPath + 'data/lib/freedom-social-xmpp'
        }, {
          expand: true, cwd: 'node_modules/freedom/providers/storage/shared'
          src: ['**']
          dest: firefoxDevPath + 'data/lib/storage'
        }, {
          expand: true, cwd: 'node_modules/uproxy-lib/dist/',
          src: FILES.uproxy_lib_common,
          dest: firefoxDevPath + 'data/core/uproxy-lib'
        }, { # Copy uproxy-networking files.
          expand: true, cwd: 'third_party/lib'
          src: FILES.thirdPartyUi
          dest: firefoxDevPath + 'data/lib'
        } ]

    }  # copy

    #-------------------------------------------------------------------------
    # All typescript compiles to locations in `build/`
    ts: {

      # uProxy UI without any platform dependencies
      generic_ui: Rule.typescriptSrcLenient 'compile-src/generic_ui'
      generic_ui_specs: Rule.typescriptSpecDeclLenient 'compile-src/generic_ui'

      # Core uProxy without any platform dependencies
      generic_core: Rule.typescriptSrcLenient 'compile-src/generic_core'
      generic_core_specs: Rule.typescriptSpecDeclLenient 'compile-src/generic_core'

      logging: Rule.typescriptSrcLenient 'compile-src/logging'
      webrtc: Rule.typescriptSrcLenient 'compile-src/webrtc'

      # TODO: Remove uistatic / make it the same as uipolymer once polymer is
      # fully integrated.
      uipolymer: Rule.typescriptSrcLenient 'compile-src/generic_ui/polymer'

      # Mocks to help jasmine along. These typescript files must be compiled
      # independently from the rest of the code, because otherwise there will
      # be many 'duplicate identifiers' and similar typescript conflicts.
      mocks: Rule.typescriptSrcLenient 'compile-src/mocks'

      # Compile typescript for all chrome components. This will do both the app
      # and extension in one go, along with their specs, because they all share
      # references to the same parts of uProxy. This avoids double-compiling,
      # (which in this case, is beyond TaskManager's reach.)
      # In the ideal world, there shouldn't be an App/Extension split.
      # The shell:extract_chrome_tests will pull the specs outside of the
      # actual distribution directory.
      chrome: Rule.typescriptSrcLenient 'compile-src/chrome'
      chrome_specs: Rule.typescriptSpecDeclLenient 'compile-src/chrome'

      # uProxy firefox specific typescript
      firefox: Rule.typescriptSrcLenient 'compile-src/firefox'

    }  # typescript

    #-------------------------------------------------------------------------
    jasmine:

      chrome_extension:
        src: FILES.jasmine_helpers
            .concat [
              'build/compile-src/uproxy.js'
              'build/compile-src/mocks/chrome_mocks.js'
              'build/compile-src/generic_ui/scripts/core_connector.js'
              'build/compile-src/generic_ui/scripts/ui.js'
              'build/compile-src/chrome/extension/scripts/chrome_browser_api.js'
              'build/compile-src/chrome/extension/scripts/chrome_core_connector.js'
              'build/compile-src/chrome/extension/scripts/chrome_tab_auth.js'
            ]
        options:
          specs: 'build/compile-src/chrome/extension/**/*.spec.js'
          template: require('grunt-template-jasmine-istanbul')
          templateOptions:
            coverage: 'build/coverage/chrome_extension/coverage.json'
            report:
              type: 'html'
              options:
                dir: 'build/coverage/chrome_extension'

      chrome_app:
        src: FILES.jasmine_helpers
            .concat [
              'build/compile-src/uproxy.js'
              'build/compile-src/mocks/chrome_mocks.js'
              'build/compile-src/chrome/app/scripts/chrome_ui_connector.js'
            ]
        options:
          specs: 'build/compile-src/chrome/app/**/*.spec.js'
          template: require('grunt-template-jasmine-istanbul')
          templateOptions:
            coverage: 'build/coverage/chrome_app/coverage.json'
            report:
              type: 'html'
              options:
                dir: 'build/coverage/chrome_app'

      generic_core:
        src: FILES.jasmine_helpers
            .concat [
              'build/compile-src/mocks/freedom-mocks.js'
              'build/compile-src/logging/logging.js'
              'build/compile-src/webrtc/peerconnection.js'
              'build/compile-src/socks-to-rtc/socks-to-rtc.js'
              'build/compile-src/rtc-to-net/rtc-to-net.js'
              'build/compile-src/uproxy.js'
              'build/compile-src/generic_core/util.js'
              'build/compile-src/generic_core/nouns-and-adjectives.js'
              'build/compile-src/generic_core/constants.js'
              'build/compile-src/generic_core/consent.js'
              'build/compile-src/generic_core/auth.js'
              'build/compile-src/generic_core/social-enum.js'
              'build/compile-src/generic_core/local-instance.js'
              'build/compile-src/generic_core/remote-instance.js'
              'build/compile-src/generic_core/user.js'
              'build/compile-src/generic_core/storage.js'
              'build/compile-src/generic_core/social.js'
              'build/compile-src/generic_core/core.js'
            ]
        options:
          specs: 'build/compile-src/generic_core/**/*.spec.js'
          # NOTE: Put any helper test-data files here:
          helpers: []
          template: require('grunt-template-jasmine-istanbul')
          templateOptions:
            coverage: 'build/coverage/generic_core/coverage.json'
            report:
              type: 'html'
              options:
                dir: 'build/coverage/generic_core'

      generic_ui:
        src: FILES.jasmine_helpers
            .concat [
              'build/compile-src/generic_core/consent.js'
              'build/compile-src/generic_ui/scripts/user.js'
              'build/compile-src/generic_ui/scripts/ui.js'
            ]
        options:
          specs: 'build/compile-src/generic_ui/scripts/**/*.spec.js'
          template: require('grunt-template-jasmine-istanbul')
          templateOptions:
            coverage: 'build/coverage/generic_ui/coverage.json'
            report:
              type: 'html'
              options:
                dir: 'build/coverage/generic_ui'


    compress:
      main:
        options:
          mode: 'zip'
          archive: 'dist/uproxy.xpi'
        expand: true
        cwd: 'build/dev/firefox'
        src: ['**']
        dest: '.'

    vulcanize:
      withinline:
        options:
          inline: true
        files:
          'build/compile-src/generic_ui/polymer/vulcanized-inline.html': 'build/compile-src/generic_ui/polymer/root.html'
      withcsp:
        options:
          csp: true
          strip: true
        files:
          'build/compile-src/generic_ui/polymer/vulcanized.html': 'build/compile-src/generic_ui/polymer/vulcanized-inline.html'
      chromeinline:
        options:
          inline: true
        files:
          'build/compile-src/chrome/extension/polymer/vulcanized-inline.html': 'build/compile-src/chrome/extension/polymer/app-missing.html'
      chromecsp:
        options:
          csp: true
          strip: true
        files:
          'build/compile-src/chrome/extension/polymer/vulcanized-chrome.html': 'build/compile-src/chrome/extension/polymer/vulcanized-inline.html'

    clean: ['build/**', '.tscache']

 # grunt.initConfig

  #-------------------------------------------------------------------------
  grunt.loadNpmTasks 'grunt-contrib-clean'
  grunt.loadNpmTasks 'grunt-contrib-compress'
  grunt.loadNpmTasks 'grunt-contrib-concat'
  grunt.loadNpmTasks 'grunt-contrib-copy'
  grunt.loadNpmTasks 'grunt-contrib-jasmine'
  grunt.loadNpmTasks 'grunt-contrib-symlink'
  grunt.loadNpmTasks 'grunt-shell'
  grunt.loadNpmTasks 'grunt-ts'
  grunt.loadNpmTasks 'grunt-verbosity'
  grunt.loadNpmTasks 'grunt-vulcanize'

  #-------------------------------------------------------------------------
  # Define the tasks
  taskManager = new TaskManager.Manager();

  taskManager.add 'base', [
    'verbosity:diminished'
    'symlink:uproxyNetworkingThirdPartyTypescriptSrc'
    'symlink:uproxyNetworkingTypescriptSrc'
    'symlink:uproxyLibThirdPartyTypescriptSrc'
    'symlink:uproxyLibTypescriptSrc'
    'symlink:uproxyChurnTypescriptSrc'
    'symlink:thirdPartyTypescriptSrc'
    'symlink:typescriptSrc'
    'symlink:polymer'
  ]

  # --- Build tasks ---
  taskManager.add 'build_generic_core', [
    'base'
    'ts:generic_core'
    # 'copy:core_libs'
  ]

  taskManager.add 'build_generic_ui', [
    'base'
    'ts:generic_ui'
    'vulcanize:withinline'
    'vulcanize:withcsp'
  ]

  # The Chrome App and the Chrome Extension cannot be built separately. They
  # share dependencies, which implies a directory structure.
  taskManager.add 'build_chrome', [
    'build_generic_ui'
    'build_generic_core'
    'ts:chrome'
    'vulcanize:chromeinline'
    'vulcanize:chromecsp'
    'copy:chrome_app'
    'copy:chrome_extension'
    # 'shell:extract_chrome_tests'
  ]

  # Firefox build tasks.
  taskManager.add 'build_firefox', [
    'build_generic_ui'
    'build_generic_core'
    'ts:firefox'
    'copy:firefox'
    'concat:firefox_uproxy'
    'concat:firefox_dependencies'
  ]

  taskManager.add 'build_firefox_xpi', [
    'build_firefox'
    'compress:main'
  ]

  taskManager.add 'build', [
    'build_chrome'
    'build_firefox'
  ]

  # --- Testing tasks ---
  taskManager.add 'test_core', [
    'build_generic_core'
    'ts:logging'
    'ts:webrtc'
    'ts:generic_core_specs'
    'ts:mocks'
    'jasmine:generic_core'
  ]

  taskManager.add 'test_ui', [
    'build_generic_ui'
    'ts:generic_ui_specs'
    'jasmine:generic_ui'
  ]

  taskManager.add 'test_chrome', [
    'build_chrome'
    'ts:chrome_specs'
    'ts:mocks'
    'jasmine:chrome_extension'
    'jasmine:chrome_app'
  ]

  # This is the target run by Travis. Targets in here should run locally
  # and on Travis/Sauce Labs.
  taskManager.add 'test', [
    'test_core'
    'test_ui'
    'test_chrome'
  ]

  taskManager.add 'everything', [
    'tsd:refresh'
    'build'
    'test'
  ]

  taskManager.add 'default', [
    'build'
  ]

  #-------------------------------------------------------------------------
  # Register the tasks
  taskManager.list().forEach((taskName) =>
    grunt.registerTask taskName, (taskManager.get taskName)
  );
