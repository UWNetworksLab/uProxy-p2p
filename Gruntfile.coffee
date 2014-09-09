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

uproxyLibPath = Path.dirname(require.resolve('uproxy-lib/package.json'))
uproxyNetworkingPath = Path.dirname(require.resolve('uproxy-networking/package.json'))

# TODO: Move this into common-grunt-rules in uproxy-lib.
Rule.symlink = (dir, dest='') =>
  { files: [ {
    expand: true,
    overwrite: true,
    cwd: dir,
    src: ['*'],
    dest: 'build/typescript-src/' + dest} ] }
Rule.symlinkSrc = (dir) => Rule.symlink Path.join(dir, 'src')
Rule.symlinkThirdParty = (dir) =>
  Rule.symlink(Path.join(dir, 'third_party'), 'third_party')

# Temporary wrapper which allows implicit any.
# TODO: Remove once implicit anys are fixed. (This is actually happening in some
# of the DefinitelyTyped definitions - i.e. MediaStream.d.ts
Rule.typescriptSrcLenient = (name) =>
  rule = Rule.typescriptSrc name
  rule.options.noImplicitAny = false
  rule

module.exports = (grunt) ->
  grunt.initConfig {
    pkg: grunt.file.readJSON('package.json')

    symlink:
      # Symlink all module directories in `src` into typescript-src, and
      # merge `third_party` from different places as well.
      typescriptSrc: Rule.symlinkSrc '.'
      thirdPartyTypescriptSrc: Rule.symlinkThirdParty '.'
      uproxyNetworkingThirdPartyTypescriptSrc: Rule.symlinkThirdParty uproxyNetworkingPath
      uproxyNetworkingTypescriptSrc: Rule.symlinkSrc uproxyNetworkingPath
      uproxyLibThirdPartyTypescriptSrc: Rule.symlinkThirdParty uproxyLibPath
      uproxyLibTypescriptSrc: Rule.symlinkSrc uproxyLibPath

    shell: {

      # TODO: Get rid of this step once socks-rtc has this automatically done.
      socks_rtc_setup: {
        command: 'npm install;grunt',
        options: {stdout: true, stderr: true, failOnError: true, execOptions: {cwd: 'node_modules/socks-rtc'}}
      }

      # Once compiled, take all .spec files out of the chrome extension and app
      # directories and into the chrome/test directory, to keep a clean distro.
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
      # TODO: provide a warning if local project overrides directory?
      #
      # Copy all the built stuff from uproxy-lib
      uproxyNetworkingBuild: { files: [ {
          expand: true, cwd: Path.join(uproxyNetworkingPath, 'build')
          src: ['**', '!**/typescript-src/**']
          dest: 'build'
          onlyIf: 'modified'
        } ] }

      # Copy any JavaScript from the third_party directory
      thirdPartyJavaScript: { files: [ {
          expand: true,
          src: ['third_party/**/*.js']
          dest: 'build/'
          onlyIf: 'modified'
        } ] }

    }  # copy

    #-------------------------------------------------------------------------
    # All typescript compiles to locations in `build/`
    typescript: {

      # uProxy UI without any platform dependencies
      generic_ui: Rule.typescriptSrcLenient 'generic_ui'

      # Core uProxy without any platform dependencies
      generic_core: Rule.typescriptSrcLenient 'generic_core'

      uistatic: Rule.typescriptSrc 'uistatic'
      uipolymer: Rule.typescriptSrc 'generic_ui/polymer'

      # Mocks to help jasmine along. These typescript files must be compiled
      # independently from the rest of the code, because otherwise there will
      # be many 'duplicate identifiers' and similar typescript conflicts.
      mocks: Rule.typescriptSrc 'mocks'

      # Compile typescript for all chrome components. This will do both the app
      # and extension in one go, along with their specs, because they all share
      # references to the same parts of uProxy. This avoids double-compiling,
      # (which in this case, is beyond TaskManager's reach.)
      # In the ideal world, there shouldn't be an App/Extension split.
      # The shell:extract_chrome_tests will pull the specs outside of the
      # actual distribution directory.
      chrome: Rule.typescriptSrc 'chrome'

      # Compile the Chrome mocks separately from above. Otherwise, there will
      # be problematic mixing of Ambient / Non-Ambient contexts for things like
      # the chrome.runtime declarations.
      chrome_mocks: Rule.typescriptSrc 'chrome/mocks'

      # uProxy firefox specific typescript
      firefox: Rule.typescriptSrc 'firefox'

    }  # typescript

    #-------------------------------------------------------------------------
    jasmine: {
      socks:
        src: ['build/socks/socks-headers.js']
        options:
          specs: 'build/socks/socks-headers.spec.js'
          outfile: 'build/socks/_SpecRunner.html'
          keepRunner: true
    }

    clean: ['build/**']

  }  # grunt.initConfig

  #-------------------------------------------------------------------------
  grunt.loadNpmTasks 'grunt-contrib-clean'
  grunt.loadNpmTasks 'grunt-contrib-concat'
  grunt.loadNpmTasks 'grunt-contrib-copy'
  grunt.loadNpmTasks 'grunt-contrib-jasmine'
  grunt.loadNpmTasks 'grunt-contrib-symlink'
  grunt.loadNpmTasks 'grunt-shell'
  grunt.loadNpmTasks 'grunt-typescript'
  grunt.loadNpmTasks 'grunt-tsd'

  #-------------------------------------------------------------------------
  # Define the tasks
  taskManager = new TaskManager.Manager();

  taskManager.add 'base', [
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
    'concat:uistatic',
    'copy:uistatic'
  ]);

  taskManager.add 'build_uipolymer', [
    'build_generic_ui'
    'typescript:uipolymer'
    'copy:uipolymer'
  ]

  # The Chrome App and the Chrome Extension cannot be built separately. They
  # share dependencies, which implies a directory structure.
  taskManager.add 'build_chrome', [
    'build_generic_ui'
    'build_generic_core'
    'typescript:chrome'
    'copy:chrome_app'
    'copy:chrome_extension'
    'shell:extract_chrome_tests'
  ]

  # Firefox build tasks.
  taskManager.add 'build_firefox', [
    'build_generic_ui'
    'build_generic_core'
    'typescript:firefox'
    'copy:firefox'
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
    'typescript:chrome_mocks'
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
