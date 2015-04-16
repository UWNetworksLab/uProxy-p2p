###
Gruntfile for uProxy
###

TaskManager = require 'uproxy-lib/build/tools/taskmanager'

#-------------------------------------------------------------------------
# Define the tasks
taskManager = new TaskManager.Manager()

taskManager.add 'base', [
  'copy:dev'
  'ts:devInModuleEnv'
  'ts:devInCoreEnv'
  'version_file'
  'browserify:genericCoreFreedomModule'
]

#
taskManager.add 'version_file', [
  'gitinfo'
  'string-replace:version'
]

taskManager.add 'build_chrome_app', [
  'base'
  #'vulcanize:chromeAppInline'
  #'vulcanize:chromeAppCsp'
  'copy:chrome_app'
]

taskManager.add 'build_chrome_ext', [
  'base'
  'copy:generic_ui_to_chrome'
  #'symlink:polymerLibToChromeExt'
  #'vulcanize:chromeExtInline'
  #'vulcanize:chromeExtCsp'
  'copy:chrome_extension'
  # 'shell:extract_chrome_tests'
]

taskManager.add 'build_chrome', [
  'build_chrome_app'
  'build_chrome_ext'
]

# Firefox build tasks.
taskManager.add 'build_firefox', [
  'base'
  'copy:generic_ui_to_firefox'
  #'vulcanize:firefoxInline'
  #'vulcanize:firefoxCsp'
  'copy:firefox'
  'concat:firefox_uproxy'
  'concat:firefox_dependencies'
]

taskManager.add 'build_firefox_xpi', [
  'build_firefox'
  'mozilla-addon-sdk'
  'mozilla-cfx-xpi:dist'
]

# --- Testing tasks ---
taskManager.add 'test_core', [
  'base'
  'browserify:firewallSpec'
  'browserify:freedomModuleSpec'
  'browserify:localInstanceSpec'
  'browserify:remoteInstanceSpec'
  'browserify:remoteConnectionSpec'
  'browserify:remoteUserSpec'
  'browserify:socialSpec'
  'browserify:storageSpec'
  #'jasmine:generic_core'
]

taskManager.add 'test_ui', [
  'base'
  'browserify:uiSpec'
  'browserify:userSpec'
  #'jasmine:generic_ui'
]

taskManager.add 'test_chrome', [
  'build_chrome'
  'browserify:chromeConnectorSpec'
  #'jasmine:chrome_extension'
  #'jasmine:chrome_app'
]

taskManager.add 'everything', [
  'build'
  'test'
]

# This is the target run by Travis. Targets in here should run locally
# and on Travis/Sauce Labs.
taskManager.add 'test', [
  'test_core'
  'test_ui'
  'test_chrome'
]

taskManager.add 'build', [
  'build_chrome'
  'build_firefox'
]

taskManager.add 'default', [
  'build'
]

#-------------------------------------------------------------------------
rules = require './build/tools/common-grunt-rules'
path = require 'path'

# Location of where src is copied into and compiled.
devBuildPath = 'build/dev/uproxy'
# Location of where to copy/build third_party source/libs.
thirdPartyBuildPath = 'build/third_party'
# This is used for the copying of uproxy libraries into the target directory.
localLibsDestPath = 'lib'

# Setup our build rules/tools
Rule = new rules.Rule({
  # The path where code in this repository should be built in.
  devBuildPath: devBuildPath,
  # The path from where third party libraries should be copied. e.g. as used by
  # sample apps.
  thirdPartyBuildPath: thirdPartyBuildPath,
  # The path to copy modules from this repository into. e.g. as used by sample
  # apps.
  localLibsDestPath: localLibsDestPath
});

#-------------------------------------------------------------------------
browserifyIntegrationTest = (path) ->
  Rule.browserifySpec(path, {
    browserifyOptions: { standalone: 'browserified_exports' }
  });

#-------------------------------------------------------------------------
freedomForChromePath = path.dirname(require.resolve('freedom-for-chrome/package.json'))
uproxyLibPath = path.dirname(require.resolve('uproxy-lib/package.json'))
uproxyNetworkingPath = path.dirname(require.resolve('uproxy-networking/package.json'))

#ipaddrjsPath = path.dirname(require.resolve('ipaddr.js/package.json'))
# TODO(ldixon): update utransformers package to uproxy-obfuscators
# uproxyObfuscatorsPath = path.dirname(require.resolve('uproxy-obfuscators/package.json'))
# uproxyObfuscatorsPath = path.dirname(require.resolve('utransformers/package.json'))
# regex2dfaPath = path.dirname(require.resolve('regex2dfa/package.json'))
# Cordova testing
# ccaPath = path.dirname(require.resolve('cca/package.json'))
# pgpPath = path.dirname(require.resolve('freedom-pgp-e2e/package.json'))

#-------------------------------------------------------------------------
chromeExtDevPath = 'build/dev/uproxy/chrome/extension/'
chromeAppDevPath = 'build/dev/uproxy/chrome/app/'
firefoxDevPath = 'build/dev/uproxy/firefox/'

#-------------------------------------------------------------------------
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
    'generic/version.js'
    'third_party/lib/lodash/lodash.min.js'
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
    'loggingprovider/loggingprovider.js'
    'loggingprovider/loggingprovider.json'
    'arraybuffers/arraybuffers.js'
    'handler/queue.js'
    'webrtc/datachannel.js'
    'webrtc/peerconnection.js'
  ]
  thirdPartyUi: [
    'platform/platform.js',
    'polymer/polymer.html',
    'polymer/polymer.js',
    'webcomponentsjs/**.min.js'
  ]

#------------------------------------------------------------------------------
module.exports = (grunt) ->
  grunt.initConfig {
    pkg: grunt.file.readJSON('package.json')
    pkgs:
      lib: grunt.file.readJSON('node_modules/uproxy-lib/package.json')
      net: grunt.file.readJSON('node_modules/uproxy-networking/package.json')
      freedom: grunt.file.readJSON('node_modules/freedom/package.json')
      freedomchrome: grunt.file.readJSON('node_modules/freedom-for-chrome/package.json')
      freedomfirefox: grunt.file.readJSON('node_modules/freedom-for-firefox/package.json')
      freedomxmpp: grunt.file.readJSON('node_modules/freedom-social-xmpp/package.json')
      freedomfirebase: grunt.file.readJSON('node_modules/freedom-social-firebase/package.json')

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
                firefoxDevPath + 'data/scripts/background.js'
                firefoxDevPath + 'data/scripts/lodash.min.js']
          dest: firefoxDevPath + 'data/scripts/dependencies.js'
        }]
      }
    }  # concat

    #-------------------------------------------------------------------------
    copy: {
      # Copy all needed third party libraries to appropriate locations.
      thirdParty:
        files: [
          # Copy local |third_party| files into dev: so that the third_party
          # dependencies are always in the common |build/third_party| location.
          # This allows path to reference typescript definitions for ambient
          # contexts to always be found, even in generated `.d.ts` files..
          {
              nonull: true,
              expand: true,
              cwd: 'third_party'
              src: ['**/*'],
              dest: thirdPartyBuildPath,
          }
          # Copy distribution directory of uproxy-lib so all paths can always
          # find their dependencies. Note that this also requires uproxy-lib
          # references to find those in |build/third_party/|. These paths
          # are delicate.
          {
              nonull: true,
              expand: true,
              cwd: path.join(uproxyLibPath, 'build/dist'),
              src: ['**/*'],
              dest: path.join(thirdPartyBuildPath, 'uproxy-lib/'),
          },
          # Use the third_party definitions from uproxy-lib. Copied to the same
          # location relative to their compiled location in uproxy-lib so they
          # have the same relative path to the created `.d.ts` files from
          # |build/dev|.
          {
              nonull: true,
              expand: true,
              cwd: path.join(uproxyLibPath, 'third_party'),
              src: ['freedom-typings/**/*', 'promise-polyfill.js'],
              dest: thirdPartyBuildPath
          },
          # Copy the distirbution directory of uproxy-networking into third
          # party.
          {
              nonull: true,
              expand: true,
              cwd: path.join(uproxyNetworkingPath, 'build/dist'),
              src: ['**/*'],
              dest: path.join(thirdPartyBuildPath, 'uproxy-networking/'),
          },
          # Use the third_party definitions from uproxy-networking.
          {
              nonull: true,
              expand: true,
              cwd: path.join(uproxyNetworkingPath, 'build/third_party'),
              src: ['i18n/**', 'ipaddrjs/**', 'ipaddrjs/**', 'regex2dfa/**',
                    'polymer/**', 'sha1/**', 'socks5-http-client/**',
                    'uTransformers/**'],
              dest: thirdPartyBuildPath
          },

        ]

      # Copy releveant non-typescript src files to dev build.
      dev:
        files: [
          {
              nonull: true,
              expand: true,
              cwd: 'src/',
              src: ['**/*'],
              dest: devBuildPath,
              onlyIf: 'modified'
          }
        ]

      # Copy releveant files for distribution.
      dist:
        files: [
          {
              nonull: true,
              expand: true,
              cwd: devBuildPath,
              src: ['**/*',
                    '!**/*.spec.js',
                    '!**/*.spec.*.js',
                    '!samples/**/*',],
              dest: 'build/dist/',
              onlyIf: 'modified'
          }
        ]

      # Copy compiled generic Polymer to Chrome so it can be vulcanized.
      generic_ui_to_chrome:
        nonull: true
        files: [ {
          expand: true, cwd: devBuildPath + '/generic_ui/polymer'
          src: ['*.js', '*.html']
          dest: chromeExtDevPath + 'polymer'
        } ]

      # Copy compiled generic Polymer to Firefox so it can be vulcanized.
      generic_ui_to_firefox:
        nonull: true
        files: [ {
          expand: true, cwd: devBuildPath + '/generic_ui/polymer'
          src: ['*.js', '*.html']
          dest: firefoxDevPath + 'data/polymer'
        } ]

      chrome_extension:
        nonull: true
        files: [ {
          # The platform specific non-compiled stuff, and...
          expand: true, cwd: 'src/chrome/extension'
          src: ['**', '!**/*.md', '!**/*.ts', '!polymer/*.html']
          dest: chromeExtDevPath
        }, {
          # generic_ui compiled source.
          # (Assumes the typescript task has executed)
          expand: true, cwd: 'build/compile-src/generic_ui'
          src: ['scripts/**', '*.html', '!**/*.ts']
          dest: chromeExtDevPath
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
          # Copy third party UI files required for polymer.
          expand: true, cwd: 'third_party/lib'
          src: FILES.thirdPartyUi
          dest: chromeExtDevPath + 'lib'
        }, {
          # Copy vulcanized files containing compiled Polymer
          # code.
          expand: true, cwd: 'build/compile-src/chrome/extension'
          src: ['polymer/vulcanized.js', 'polymer/vulcanized.html']
          dest: chromeExtDevPath
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
          src: FILES.uproxy_common
            .concat [
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
          expand: true, cwd: 'node_modules/freedom-social-firebase', flatten: true
          src: [
            'dist/**'
          ]
          dest: chromeAppDevPath + 'lib/freedom-social-firebase'
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
          src: ['icons/128_online.png', 'fonts/*']
          dest: chromeAppDevPath
        }, { # Copy uproxy-lib files.
          expand: true, cwd: 'node_modules/uproxy-lib/dist/',
          src: FILES.uproxy_lib_common,
          dest: chromeAppDevPath + 'scripts/uproxy-lib/'
        }, { # Copy uproxy-networking files.
          expand: true, cwd: 'node_modules/uproxy-networking/dist/',
          src: FILES.uproxy_networking_common,
          dest: chromeAppDevPath + 'scripts/uproxy-networking/'
        }, {
          # Copy third party UI files required for polymer.
          expand: true, cwd: 'third_party/lib'
          src: FILES.thirdPartyUi
          dest: chromeAppDevPath + 'lib'
        }, {
          # Chrome app polymer.
          # (Assumes vulcanize tasks have executed)
          expand: true, cwd: 'build/compile-src/chrome/app/polymer'
          src: ['vulcanized.*']
          dest: chromeAppDevPath + 'polymer'
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
           expand: true, cwd: 'build/compile-src', flatten: true
           src: FILES.uproxy_common
           dest: firefoxDevPath + 'data/core/'
        # ... the generic core stuff
        }, {
          expand: true, cwd: 'build/compile-src/generic_core'
          src: ['**'],
          dest: firefoxDevPath + 'data/core/'
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
          src: FILES.uproxy_common
              .concat [
                'firefox/data/scripts/*.js'
              ]
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
          expand: true, cwd: 'node_modules/freedom-social-firebase/dist/'
          src: ['**']
          dest: firefoxDevPath + 'data/lib/freedom-social-firebase'
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
        }, {
          # Copy vulcanized files containing compiled Polymer
          # code.
          expand: true, cwd: 'build/compile-src/firefox/data'
          src: ['polymer/vulcanized.js', 'polymer/vulcanized.html']
          dest: firefoxDevPath + 'data'
        } ]

      integration:
        files: [ {
          # Copy compiled Chrome App code, required for integration tests
          expand: true, cwd: chromeAppDevPath
          src: ['**', '!**/spec', '!**/*.md', '!**/*.ts']
          dest: 'build/compile-src/integration'
        }, {
          expand: true, cwd: 'src/integration/'
          src: ['gtalk_credentials.js', 'integration.json']
          dest: 'build/compile-src/integration'
        }]
    }  # copy

    #-------------------------------------------------------------------------
    'string-replace':
      version:
        files: [{
          src: 'build/dev/uproxy/generic/version.js'
          dest: 'build/dev/uproxy/generic/version.js'
        }]
        options:
          replacements: [{
            pattern: /\"___VERSION_TEMPLATE___\"/g
            replacement: JSON.stringify
              version: '<%= pkg.version %>'
              gitcommit: '<%= gitinfo.local.branch.current.SHA %>'
              'uproxy-lib': '<%= pkgs.lib.version %>'
              'uproxy-networking': '<%= pkgs.net.version %>'
              freedom: '<%= pkgs.freedom.version %>'
              'freedom-for-chrome': '<%= pkgs.freedomchrome.version %>'
              'freedom-for-firefox': '<%= pkgs.freedomfirefox.version %>'
              'freedom-social-xmpp': '<%= pkgs.freedomxmpp.version %>'
              'freedom-social-firebase': '<%= pkgs.freedomfirebase.version %>'
          }]

    #-------------------------------------------------------------------------
    # All typescript compiles to locations in `build/`
    # Typescript compilation rules
    ts:
      # Compile all non-sample typescript code into the development build
      # directory.
      devInModuleEnv:
        src: [
          devBuildPath + '/interfaces/**/*.ts'
          devBuildPath + '/generic_core/**/*.ts'
          '!' + devBuildPath + '/**/*.d.ts'
          '!' + devBuildPath + '/**/*.core-env.ts'
          '!' + devBuildPath + '/**/*.core-env.spec.ts'
        ]
        options:
          target: 'es5'
          comments: true
          noImplicitAny: true
          sourceMap: false
          declaration: true
          module: 'commonjs'
          fast: 'always'

      devInCoreEnv:
        src: [
          devBuildPath + '/chrome/app/**/*.ts'
          devBuildPath + '/chrome/extension/**/*.ts'
          devBuildPath + '/**/*.core-env.spec.ts'
          devBuildPath + '/**/*.core-env.ts'
        ]
        options:
          target: 'es5'
          comments: true
          noImplicitAny: true
          sourceMap: false
          declaration: true
          module: 'commonjs'
          fast: 'always'

    browserify:
      genericCoreFreedomModule: Rule.browserify 'generic_core/freedom-module'
      firewallSpec: Rule.browserifySpec 'generic_core/firewall'
      freedomModuleSpec: Rule.browserifySpec 'generic_core/freedom-module'
      localInstanceSpec: Rule.browserifySpec 'generic_core/local-instance'
      remoteInstanceSpec: Rule.browserifySpec 'generic_core/remote-instance'
      remoteConnectionSpec: Rule.browserifySpec 'generic_core/remote-connection'
      remoteUserSpec: Rule.browserifySpec 'generic_core/remote-user'
      socialSpec: Rule.browserifySpec 'generic_core/social'
      storageSpec: Rule.browserifySpec 'generic_core/storage'
      uiSpec: Rule.browserifySpec 'generic_ui/script/ui'
      userSpec: Rule.browserifySpec 'generic_ui/script/user'
      chromeConnectorSpec: Rule.browserifySpec 'chrome/extension/scripts/chrome_core/connector'

    #-------------------------------------------------------------------------
    jasmine:
      chrome_extension: {
        src: FILES.jasmine_helpers
            .concat [
              'build/compile-src/uproxy.js'
              'build/compile-src/generic/version.js'
              'build/compile-src/mocks/chrome_mocks.js'
              'build/compile-src/generic_ui/scripts/core_connector.js'
              'build/compile-src/generic_ui/scripts/ui.js'
              'build/compile-src/chrome/extension/scripts/chrome_browser_api.js'
              'build/compile-src/chrome/extension/scripts/chrome_core_connector.js'
              'build/compile-src/chrome/extension/scripts/chrome_tab_auth.js'
            ]
        options:
          specs: 'build/compile-src/chrome/extension/**/*.spec.js'
          outfile: 'build/compile-src/chrome/extension/SpecRunner.html'
          template: require('grunt-template-jasmine-istanbul')
          templateOptions:
            coverage: 'build/coverage/chrome_extension/coverage.json'
            report:
              type: 'html'
              options:
                dir: 'build/coverage/chrome_extension'
      }

      chrome_app: {
        src: FILES.jasmine_helpers
            .concat [
              'build/compile-src/uproxy.js'
              'build/compile-src/mocks/chrome_mocks.js'
              'build/compile-src/chrome/app/scripts/chrome_ui_connector.js'
            ]
        options:
          specs: 'build/compile-src/chrome/app/**/*.spec.js'
          outfile: 'build/compile-src/chrome/app/SpecRunner.html'
          template: require('grunt-template-jasmine-istanbul')
          templateOptions:
            coverage: 'build/coverage/chrome_app/coverage.json'
            report:
              type: 'html'
              options:
                dir: 'build/coverage/chrome_app'
      }

      generic_core: {
        src: FILES.jasmine_helpers
            .concat FILES.uproxy_common
            .concat [
              'build/compile-src/mocks/freedom-mocks.js'
              'build/compile-src/mocks/socks-to-rtc.js'
              'build/compile-src/mocks/rtc-to-net.js'
              'build/compile-src/logging/logging.js'
              'build/compile-src/webrtc/peerconnection.js'
              'build/compile-src/socks-to-rtc/socks-to-rtc.js'
              'build/compile-src/rtc-to-net/rtc-to-net.js'
              'build/compile-src/uproxy.js'
              'build/compile-src/generic/version.js'
              'build/compile-src/generic_core/constants.js'
              'build/compile-src/generic_core/consent.js'
              'build/compile-src/generic_core/social-enum.js'
              'build/compile-src/generic_core/local-instance.js'
              'build/compile-src/generic_core/remote-instance.js'
              'build/compile-src/generic_core/remote-connection.js'
              'build/compile-src/generic_core/firewall.js'
              'build/compile-src/generic_core/user.js'
              'build/compile-src/generic_core/storage.js'
              'build/compile-src/generic_core/social.js'
              'build/compile-src/generic_core/core.js'
              'node_modules/uproxy-lib/dist/handler/queue.js'
            ]
        options:
          specs: 'build/compile-src/generic_core/**/*.spec.js'
          # NOTE: Put any helper test-data files here:
          keepRunner: true
          outfile: 'build/compile-src/generic_core/SpecRunner.html'
          helpers: []
          template: require('grunt-template-jasmine-istanbul')
          templateOptions:
            coverage: 'build/coverage/generic_core/coverage.json'
            report:
              type: 'html'
              options:
                dir: 'build/coverage/generic_core'
      }

      generic_ui: {
        src: FILES.jasmine_helpers
            .concat FILES.uproxy_common.map((s) -> 'build/compile-src/' + s)
            .concat [
              'build/compile-src/generic_ui/scripts/user.js'
              'build/compile-src/generic_ui/scripts/ui.js'
            ]
        options:
          specs: 'build/compile-src/generic_ui/scripts/**/*.spec.js'
          template: require('grunt-template-jasmine-istanbul')
          outfile: 'build/compile-src/generic_ui/SpecRunner.html'
          templateOptions:
            coverage: 'build/coverage/generic_ui/coverage.json'
            report:
              type: 'html'
              options:
                dir: 'build/coverage/generic_ui'
      }

    jasmine_chromeapp: {
      all: {
        src: ['node_modules/freedom-for-chrome/freedom-for-chrome.js',
              'build/compile-src/integration/scripts/uproxy.js',
              'build/compile-src/integration/gtalk_credentials.js',
              'build/compile-src/integration/**/*.js',
              'build/compile-src/integration/**/*.json',
              'build/compile-src/integration/core.spec.js']
        options: {
          paths: ['node_modules/freedom-for-chrome/freedom-for-chrome.js',
                  'build/compile-src/integration/scripts/uproxy.js',
                  'build/compile-src/integration/scripts/uproxy-lib/arraybuffers/arraybuffers.js',
                  'build/compile-src/integration/gtalk_credentials.js',
                  'build/compile-src/integration/core.spec.js'
          ],
          # Uncomment this for debugging
          # keepRunner: true,
        }
      }
    }
    'mozilla-addon-sdk':
      'latest':
        options:
          dest_dir: '.mozilla_addon_sdk/'

    'mozilla-cfx-xpi':
      'dist':
        options:
          'mozilla-addon-sdk': 'latest'
          extension_dir: 'build/dev/firefox'
          dist_dir: 'build/dist/'

    vulcanize:
      chromeExtInline:
        options:
          inline: true
        files:
          'build/dev/uproxy/chrome/extension/polymer/vulcanized-inline.html': chromeExtDevPath + 'polymer/root.html'
      chromeExtCsp:
        options:
          csp: true
          strip: true
        files:
          'build/dev/uproxy/chrome/extension/polymer/vulcanized.html': chromeExtDevPath + 'polymer/vulcanized-inline.html'
      chromeAppInline:
        options:
          inline: true
        files:
          'build/dev/uproxy/chrome/app/polymer/vulcanized-inline.html': chromeAppDevPath + 'polymer/ext-missing.html'
      chromeAppCsp:
        options:
          csp: true
          strip: true
        files:
          'build/dev/uproxy/chrome/app/polymer/vulcanized.html': chromeAppDevPath + 'polymer/vulcanized-inline.html'
      firefoxInline:
        options:
          inline: true
        files:
          'build/dev/uproxy/firefox/data/polymer/vulcanized-inline.html': firefoxDevPath + 'data/polymer/root.html'
      firefoxCsp:
        options:
          csp: true
          strip: true
        files:
          'build/dev/uproxy/firefox/data/polymer/vulcanized.html': firefoxDevPath + 'data/polymer/vulcanized-inline.html'

    clean: ['build/dev', '.tscache']
  }  # grunt.initConfig

  #-------------------------------------------------------------------------
  grunt.loadNpmTasks 'grunt-browserify'
  grunt.loadNpmTasks 'grunt-contrib-clean'
  grunt.loadNpmTasks 'grunt-contrib-concat'
  grunt.loadNpmTasks 'grunt-contrib-copy'
  grunt.loadNpmTasks 'grunt-contrib-jasmine'
  grunt.loadNpmTasks 'grunt-gitinfo'
  grunt.loadNpmTasks 'grunt-jasmine-chromeapp'
  grunt.loadNpmTasks 'grunt-mozilla-addon-sdk'
  grunt.loadNpmTasks 'grunt-string-replace'
  grunt.loadNpmTasks 'grunt-ts'
  grunt.loadNpmTasks 'grunt-vulcanize'

  #-------------------------------------------------------------------------
  # Register the tasks
  taskManager.list().forEach((taskName) =>
    grunt.registerTask taskName, (taskManager.get taskName)
  );
