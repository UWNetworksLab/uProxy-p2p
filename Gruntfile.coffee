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
uproxyLibPath = getNodePath 'uproxy-lib'
uproxyNetworkingPath = getNodePath 'uproxy-networking'

chromeExtDevPath = 'build/dev/chrome/extension/'
chromeAppDevPath = 'build/dev/chrome/app/'

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


# TODO: When we make the 'distribution' build which uglifies all js and removes
# the specs, make a corresponding rule which makes everything go into
# 'build/dist'.
Rule.typescriptSrcDev = (name) =>
  rule = Rule.typescriptSrc name
  rule.dest = 'build/dev/'
  rule

# Temporary wrapper which allows implicit any.
# TODO: Remove once implicit anys are fixed. (This is actually happening in some
# of the DefinitelyTyped definitions - i.e. MediaStream.d.ts, and many other
# places)
Rule.typescriptSrcLenient = (name) =>
  rule = Rule.typescriptSrcDev name
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
  # Mocks for chrome app/extension APIs.
  jasmine_chrome: [
    'build/mocks/chrome_mocks.js'
  ]
  # Files which are required at run-time everywhere.
  uproxy_common: [
    'uproxy.js'
    'generic_core/consent.js'
    'generic_core/util.js'
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

      uproxyNetworkingThirdPartyTypescriptSrc: Rule.symlinkThirdParty uproxyNetworkingPath
      uproxyNetworkingTypescriptSrc: Rule.symlinkSrc 'uproxy-networking'

      uproxyLibThirdPartyTypescriptSrc: Rule.symlinkThirdParty 'uproxy-lib'
      uproxyLibTypescriptSrc: Rule.symlinkSrc 'uproxy-lib'

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
          src: ['build/firefox/data/core/uproxy.js'
                'build/firefox/lib/exports.js']
          dest: 'build/firefox/lib/uproxy.js'
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
          src: ['**', '!**/*.md', '!**/*.ts', '!**/*.sass']
          dest: chromeExtDevPath
        }, {
          # generic_ui HTML and non-typescript assets.
          expand: true, cwd: 'src/generic_ui',
          src: ['**', '!**/*.ts']
          dest: chromeExtDevPath
        }, {
          # generic_ui compiled source.
          # (Assumes the typescript task has executed)
          expand: true, cwd: 'build/dev/generic_ui'
          src: ['**', '!**/*.spec.js']
          dest: chromeExtDevPath
        }, {
          # Icons
          expand: true, cwd: 'src/'
          src: ['icons/*']
          dest: chromeExtDevPath
        }, {
          expand: true, cwd: 'build/dev/', flatten: true
          src: FILES.uproxy_common
            .concat [
              'chrome/util/chrome_glue.js'
            ]
          dest: chromeExtDevPath + 'scripts/'
        }, {
          # expand: true, cwd: 'node_modules/freedom-for-chrome/'
          # src: ['freedom.js']
          # dest: 'build/chrome/extension/lib'},
          # Libraries
          expand: true, cwd: 'third_party/lib'
          src: ['**']
          dest: chromeExtDevPath + 'lib'
        } ]

      chrome_app:
        nonull: true
        files: [ {
          expand: true, cwd: 'src/chrome/app'
          src: ['**', '!**/*.spec.js', '!**/*.md', '!**/*.ts', '!**/*.sass']
          dest: chromeAppDevPath
        }, {  # Freedom manifest for uproxy
          expand: true, cwd: 'src/generic_core/'
          src: ['uproxy.json']
          dest: chromeAppDevPath + 'scripts/'
        }, {  # Sourcecode (no specs):
          expand: true, cwd: 'build/dev/', flatten: true,
          src: [
            'uproxy.js'
            'generic_core/**/*.js'
            'chrome/util/chrome_glue.js'
            '!**/*.spec.js'
          ]
          dest: chromeAppDevPath + 'scripts/'
        }, {  # Libraries
          expand: true, cwd: 'node_modules/uproxy-lib/build/freedom/'
          src: [
            'freedom-for-chrome-for-uproxy.js'
          ]
          dest: chromeAppDevPath + 'lib/'
        }, {  # Libraries
          expand: true, cwd: 'third_party', flatten: true
          src: [
            'freedom-ts-hacks/social-enum.js'
          ]
          dest: chromeAppDevPath + 'scripts/'
        }, {  # uProxy Icons.
          expand: true, cwd: 'src/'
          src: ['icons/*']
          dest: chromeAppDevPath
        } ]

    }  # copy

    #-------------------------------------------------------------------------
    # All typescript compiles to locations in `build/`
    typescript: {

      # uProxy UI without any platform dependencies
      generic_ui: Rule.typescriptSrcLenient 'generic_ui'

      # Core uProxy without any platform dependencies
      generic_core: Rule.typescriptSrcLenient 'generic_core'

      # TODO: Remove uistatic / make it the same as uipolymer once polymer is
      # fully integrated.
      uistatic: Rule.typescriptSrcLenient 'uistatic'
      uipolymer: Rule.typescriptSrc 'generic_ui/polymer'

      # Mocks to help jasmine along. These typescript files must be compiled
      # independently from the rest of the code, because otherwise there will
      # be many 'duplicate identifiers' and similar typescript conflicts.
      mocks: Rule.typescriptSrcLenient 'mocks'

      # Compile typescript for all chrome components. This will do both the app
      # and extension in one go, along with their specs, because they all share
      # references to the same parts of uProxy. This avoids double-compiling,
      # (which in this case, is beyond TaskManager's reach.)
      # In the ideal world, there shouldn't be an App/Extension split.
      # The shell:extract_chrome_tests will pull the specs outside of the
      # actual distribution directory.
      chrome: Rule.typescriptSrcLenient 'chrome'

      # uProxy firefox specific typescript
      firefox: Rule.typescriptSrcLenient 'firefox'

    }  # typescript

    #-------------------------------------------------------------------------
    jasmine:
      chrome_extension:
        src: FILES.jasmine_helpers
            .concat FILES.jasmine_chrome
            .concat [
              'build/generic_ui/scripts/core_connector.js'
              'build/chrome/extension/scripts/chrome_connector.js'
              'build/chrome/util/chrome_glue.js'
            ]
        options:
          specs: 'build/chrome/**/*.spec.js'
          outfile: 'build/chrome/_SpecRunner.html'
          keepRunner: true
      generic_core:
        src: FILES.jasmine_helpers
            .concat [
              'build/mocks/freedom-mocks.js'
              'build/uproxy.js'
              'build/generic_core/util.js'
              'build/generic_core/nouns-and-adjectives.js'
              'build/generic_core/constants.js'
              'build/generic_core/consent.js'
              'build/generic_core/auth.js'
              'build/generic_core/social-enum.js'
              'build/generic_core/local-instance.js'
              'build/generic_core/remote-instance.js'
              'build/generic_core/user.js'
              'build/generic_core/storage.js'
              'build/generic_core/social.js'
              'build/generic_core/core.js'
            ]
        options:
          specs: 'build/generic_core/**/*.spec.js'
          outfile: 'build/generic_core/_SpecRunner.html'
          # NOTE: Put any helper test-data files here:
          helpers: []
          keepRunner: true,
      generic_ui:
        src: FILES.jasmine_helpers
            .concat [
              'build/generic_ui/scripts/user.js'
              'build/generic_ui/scripts/ui.js'
            ]
        options:
          specs: 'build/generic_ui/scripts/**/*.spec.js'
          outfile: 'build/generic_ui/_SpecRunner.html'
          keepRunner: true

    clean: ['build/**']

 # grunt.initConfig

  #-------------------------------------------------------------------------
  grunt.loadNpmTasks 'grunt-contrib-clean'
  grunt.loadNpmTasks 'grunt-contrib-concat'
  grunt.loadNpmTasks 'grunt-contrib-copy'
  grunt.loadNpmTasks 'grunt-contrib-jasmine'
  grunt.loadNpmTasks 'grunt-contrib-symlink'
  grunt.loadNpmTasks 'grunt-shell'
  grunt.loadNpmTasks 'grunt-typescript'
  grunt.loadNpmTasks 'grunt-tsd'
  grunt.loadNpmTasks 'grunt-verbosity'

  #-------------------------------------------------------------------------
  # Define the tasks
  taskManager = new TaskManager.Manager();

  taskManager.add 'base', [
    'verbosity:diminished'
    'symlink:uproxyNetworkingThirdPartyTypescriptSrc'
    'symlink:uproxyNetworkingTypescriptSrc'
    'symlink:uproxyLibThirdPartyTypescriptSrc'
    'symlink:uproxyLibTypescriptSrc'
    'symlink:thirdPartyTypescriptSrc'
    'symlink:typescriptSrc'
  ]

  # --- Build tasks ---
  taskManager.add 'build_generic_core', [
    'base'
    'typescript:generic_core'
  ]

  taskManager.add 'build_generic_ui', [
    'base'
    'typescript:generic_ui'
  ]

  taskManager.add('build_uistatic', [
    'build_generic_ui',
    'typescript:uistatic',
    # 'concat:uistatic',
    # 'copy:uistatic'
  ]);

  taskManager.add 'build_uipolymer', [
    'build_generic_ui'
    'typescript:uipolymer'
    # 'copy:uipolymer'
  ]

  # The Chrome App and the Chrome Extension cannot be built separately. They
  # share dependencies, which implies a directory structure.
  taskManager.add 'build_chrome', [
    'build_generic_ui'
    'build_generic_core'
    'typescript:chrome'
    'copy:chrome_app'
    'copy:chrome_extension'
    # 'shell:extract_chrome_tests'
  ]

  # Firefox build tasks.
  taskManager.add 'build_firefox', [
    'build_generic_ui'
    'build_generic_core'
    'typescript:firefox'
    # 'copy:firefox'
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
    'typescript:mocks'
    'jasmine:generic_core'
  ]

  taskManager.add 'test_ui', [
    'build_generic_ui'
    'jasmine:generic_ui'
  ]

  taskManager.add 'test_chrome_extension', [
    'build_chrome'
    'typescript:mocks'
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
