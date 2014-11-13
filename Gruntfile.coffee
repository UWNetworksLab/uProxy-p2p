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
Rule.symlink = (dir, dest='') =>
  { files: [ {
    expand: true,
    overwrite: true,
    cwd: dir,
    src: ['**/*.ts'],
    dest: 'build/typescript-src/' + dest} ] }

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


module.exports = (grunt) ->
  grunt.initConfig
    pkg: grunt.file.readJSON('package.json')

    # Decrease log output for noisy things like symlink.
    verbosity:
      diminished:
        options: { mode: 'oneline' }
        tasks: ['symlink']

    symlink:
      # Symlink all module directories in `src` into typescript-src, and
      # merge `third_party` from different places as well.
      typescriptSrc: Rule.symlinkSrc '.'
      thirdPartyTypescriptSrc: Rule.symlinkThirdParty '.'

      uproxyNetworkingThirdPartyTypescriptSrc: Rule.symlinkThirdParty 'uproxy-networking'
      uproxyNetworkingTypescriptSrc: Rule.symlinkSrc 'uproxy-networking'

      uproxyLibThirdPartyTypescriptSrc: Rule.symlinkThirdParty 'uproxy-lib'
      uproxyLibTypescriptSrc: Rule.symlinkSrc 'uproxy-lib'

      uproxyChurnTypescriptSrc: Rule.symlinkSrc 'uproxy-churn'

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

      uistatic: {
        files: [ {
          src: ['build/uistatic/src/generic_ui/scripts/ui.js'
                 'build/uistatic/src/uistatic/scripts/dependencies.js']
          dest: 'build/uistatic/scripts/dependencies.js' } ]
      }

      firefox_uproxy: {
        files: [ {
          src: [firefoxDevPath + 'data/core/uproxy.js'
                firefoxDevPath + 'lib/exports.js']
          dest: firefoxDevPath + 'lib/uproxy.js'
        } ]
      }

    }  # concat

    #-------------------------------------------------------------------------
    copy: {
      # Copy any JavaScript from the third_party directory
      thirdPartyJavaScript: { files: [ {
          expand: true,
          src: ['third_party/**/*.js']
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
          src: ['**', '!**/*.ts']
          dest: chromeExtDevPath
        }, {
          # generic_ui compiled source.
          # (Assumes the typescript task has executed)
          expand: true, cwd: 'build/typescript-src/generic_ui'
          src: ['**', '!**/*.spec.js']
          dest: chromeExtDevPath
        }, {
          # Icons
          expand: true, cwd: 'src/'
          src: ['icons/*']
          dest: chromeExtDevPath
        }, {
          expand: true, cwd: 'build/typescript-src/', flatten: true
          src: FILES.uproxy_common
            .concat [
              'chrome/util/chrome_glue.js',
              'chrome/extension/scripts/*.js'
            ]
          dest: chromeExtDevPath + 'scripts/'
        }, {
          expand: true, cwd: 'third_party/lib'
          src: ['**']
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
          expand: true, cwd: 'build/typescript-src/', flatten: true
          src: [
            'uproxy.js'
            'chrome/app/scripts/*.js'
            'generic_core/**/*.js'
            'chrome/util/chrome_glue.js'
            '!**/*.spec.js'
          ]
          dest: chromeAppDevPath + 'scripts/'
        }, {  # Freedom
          expand: true, cwd: 'node_modules/uproxy-lib/dist/freedom/'
          src: [
            'freedom-for-chrome-for-uproxy.js'
            'uproxy-core-env.js'
          ]
          dest: chromeAppDevPath + 'lib/'
        }, {
          expand: true, cwd: 'node_modules/freedom-social-xmpp', flatten: true
          src: [
            'build/**'
          ]
          dest: chromeAppDevPath + 'lib/freedom-social-xmpp'
        }, {
          expand: true, cwd: 'node_modules/freedom-social-facebook/build/src/',
          src: [
            '**'
          ]
          dest: chromeAppDevPath + 'lib/freedom-social-facebook'
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
        }, {  # uProxy Icons.
          expand: true, cwd: 'src/'
          src: ['icons/uproxy-*.png']
          dest: chromeAppDevPath
        }, { # Copy uproxy-lib files.
          expand: true, cwd: 'node_modules/uproxy-lib/dist/',
          src: [
            'arraybuffers/arraybuffers.js'
            'handler/queue.js'
          ],
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
           expand: true, cwd: 'build/typescript-src'
           src: ['uproxy.js']
           dest: firefoxDevPath + 'data/core/'
        # ... the generic core stuff
        }, {
          expand: true, cwd: 'build/typescript-src/generic_core'
          src: ['**'],
          dest: firefoxDevPath + 'data/core/'
        }, {
          # generic_ui HTML and non-typescript assets.
          expand: true, cwd: 'src/generic_ui',
          src: ['**', '!**/*.ts']
          dest: firefoxDevPath + 'data/'
        }, {
        # ... the generic UI stuff
          expand: true, cwd: 'build/typescript-src/generic_ui'
          src: ['**'],
          dest: firefoxDevPath + 'data'
        }, {
          # Icons
          expand: true, cwd: 'src/'
          src: ['icons/*']
          dest: firefoxDevPath + 'data'
        }, {
          expand: true, cwd: 'build/typescript-src', flatten: true
          src: FILES.uproxy_common.concat([
            'firefox/data/scripts/*.js']),
          dest: firefoxDevPath + 'data/scripts'
        # freedom for firefox
        }, {
          expand: true, cwd: 'node_modules/uproxy-lib/dist/freedom'
          src: ['freedom-for-firefox-for-uproxy.jsm']
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
          expand: true, cwd: 'node_modules/freedom-social-xmpp/build/'
          src: ['**']
          dest: firefoxDevPath + 'data/lib/freedom-social-xmpp'
        }, {
          expand: true, cwd: 'node_modules/freedom-social-facebook/build/src/',
          src: ['**']
          dest: firefoxDevPath + 'data/lib/freedom-social-facebook'
        }, {
          expand: true, cwd: 'node_modules/freedom/providers/storage/isolated'
          src: ['**']
          dest: firefoxDevPath + 'data/lib/storage'
        }, {
          expand: true, cwd: 'third_party/lib'
          src: ['**']
          dest: firefoxDevPath + 'data/lib'
        } ]

    }  # copy

    #-------------------------------------------------------------------------
    # All typescript compiles to locations in `build/`
    ts: {

      # uProxy UI without any platform dependencies
      generic_ui: Rule.typescriptSrcLenient 'typescript-src/generic_ui'
      generic_ui_specs: Rule.typescriptSpecDeclLenient 'typescript-src/generic_ui'

      # Core uProxy without any platform dependencies
      generic_core: Rule.typescriptSrcLenient 'typescript-src/generic_core'
      generic_core_specs: Rule.typescriptSpecDeclLenient 'typescript-src/generic_core'

      # TODO: Remove uistatic / make it the same as uipolymer once polymer is
      # fully integrated.
      uistatic: Rule.typescriptSrcLenient 'typescript-src/uistatic'
      uipolymer: Rule.typescriptSrcLenient 'typescript-src/generic_ui/polymer'

      # Mocks to help jasmine along. These typescript files must be compiled
      # independently from the rest of the code, because otherwise there will
      # be many 'duplicate identifiers' and similar typescript conflicts.
      mocks: Rule.typescriptSrcLenient 'typescript-src/mocks'

      # Compile typescript for all chrome components. This will do both the app
      # and extension in one go, along with their specs, because they all share
      # references to the same parts of uProxy. This avoids double-compiling,
      # (which in this case, is beyond TaskManager's reach.)
      # In the ideal world, there shouldn't be an App/Extension split.
      # The shell:extract_chrome_tests will pull the specs outside of the
      # actual distribution directory.
      chrome: Rule.typescriptSrcLenient 'typescript-src/chrome'
      chrome_specs: Rule.typescriptSpecDeclLenient 'typescript-src/chrome'

      # uProxy firefox specific typescript
      firefox: Rule.typescriptSrcLenient 'typescript-src/firefox'

    }  # typescript

    #-------------------------------------------------------------------------
    jasmine:

      chrome_extension:
        src: FILES.jasmine_helpers
            .concat [
              'build/typescript-src/mocks/chrome_mocks.js'
              'build/typescript-src/generic_ui/scripts/core_connector.js'
              'build/typescript-src/generic_ui/scripts/ui.js'
              'build/typescript-src/chrome/extension/scripts/chrome_connector.js'
              'build/typescript-src/chrome/util/chrome_glue.js'
            ]
        options:
          specs: 'build/typescript-src/chrome/**/*.spec.js'
          outfile: 'build/typescript-src/chrome/SpecRunner.html'
          keepRunner: true

      generic_core:
        src: FILES.jasmine_helpers
            .concat [
              'build/typescript-src/mocks/freedom-mocks.js'
              'build/typescript-src/socks-to-rtc/socks-to-rtc.js'
              'build/typescript-src/rtc-to-net/rtc-to-net.js'
              'build/typescript-src/uproxy.js'
              'build/typescript-src/generic_core/util.js'
              'build/typescript-src/generic_core/nouns-and-adjectives.js'
              'build/typescript-src/generic_core/constants.js'
              'build/typescript-src/generic_core/consent.js'
              'build/typescript-src/generic_core/auth.js'
              'build/typescript-src/generic_core/social-enum.js'
              'build/typescript-src/generic_core/local-instance.js'
              'build/typescript-src/generic_core/remote-instance.js'
              'build/typescript-src/generic_core/user.js'
              'build/typescript-src/generic_core/storage.js'
              'build/typescript-src/generic_core/social.js'
              'build/typescript-src/generic_core/core.js'
            ]
        options:
          specs: 'build/typescript-src/generic_core/**/*.spec.js'
          outfile: 'build/typescript-src/generic_core/SpecRunner.html'
          # NOTE: Put any helper test-data files here:
          helpers: []
          keepRunner: true,

      generic_ui:
        src: FILES.jasmine_helpers
            .concat [
              'build/typescript-src/generic_core/consent.js'
              'build/typescript-src/generic_ui/scripts/user.js'
              'build/typescript-src/generic_ui/scripts/ui.js'
            ]
        options:
          specs: 'build/typescript-src/generic_ui/scripts/**/*.spec.js'
          outfile: 'build/typescript-src/generic_ui/SpecRunner.html'
          keepRunner: true

    compress:
      main:
        options:
          mode: 'zip'
          archive: 'dist/uproxy.xpi'
        expand: true
        cwd: 'build/dev/firefox'
        src: ['**']
        dest: '.'

    polymercompile:
      ui:
        options:
          files: 'third_party/lib/paper-*/*html'

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

  grunt.loadTasks('tasks');

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
  ]

  taskManager.add('build_uistatic', [
    'build_generic_ui',
    'ts:uistatic',
    # 'concat:uistatic',
    # 'copy:uistatic'
  ]);

  # The Chrome App and the Chrome Extension cannot be built separately. They
  # share dependencies, which implies a directory structure.
  taskManager.add 'build_chrome', [
    'build_generic_ui'
    'build_generic_core'
    'ts:chrome'
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
  ]

  taskManager.add 'build_firefox_xpi', [
    'build_firefox'
    'compress:main'
  ]

  taskManager.add 'build', [
    'build_chrome'
    'build_firefox'
    'build_uistatic'
  ]

  # --- Testing tasks ---
  taskManager.add 'test_core', [
    'build_generic_core'
    'ts:generic_core_specs'
    'ts:mocks'
    'jasmine:generic_core'
  ]

  taskManager.add 'test_ui', [
    'build_generic_ui'
    'ts:generic_ui_specs'
    'jasmine:generic_ui'
  ]

  taskManager.add 'test_chrome_extension', [
    'build_chrome'
    'ts:chrome_specs'
    'ts:mocks'
    'jasmine:chrome_extension'
  ]

  # This is the target run by Travis. Targets in here should run locally
  # and on Travis/Sauce Labs.
  taskManager.add 'test', [
    'test_core'
    'test_ui'
    'test_chrome_extension'
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
