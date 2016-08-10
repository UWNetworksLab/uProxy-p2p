###
Gruntfile for uProxy
###

_ = require('lodash')
fs = require('fs')
rules = require './build/tools/common-grunt-rules'
path = require 'path'

#-------------------------------------------------------------------------

# Location of where src is copied into and compiled.
devBuildPath = 'build/src'
distBuildPath = 'build/dist'
# Location of where to copy/build third_party source/libs.
thirdPartyBuildPath = 'build/third_party'
# This is used for the copying of uproxy libraries into the target directory.
localLibsDestPath = ''

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
})

#-------------------------------------------------------------------------
chromeExtDevPath = path.join(devBuildPath, 'chrome/extension/')
chromeAppDevPath = path.join(devBuildPath, 'chrome/app/')
firefoxDevPath = path.join(devBuildPath, 'firefox/')
ccaDevPath = path.join(devBuildPath, 'cca/app/')
androidDevPath = path.join(devBuildPath, 'android/')
iosDevPath = path.join(devBuildPath, 'ios/')
genericPath = path.join(devBuildPath, 'generic/')

ccaDistPath = path.join(distBuildPath, 'cca/app/')
androidDistPath = path.join(distBuildPath, 'android/')
iosDistPath = path.join(distBuildPath, 'ios/')


#-------------------------------------------------------------------------
browserifyIntegrationTest = (path) ->
  Rule.browserifySpec(path, {
    browserifyOptions: { standalone: 'browserified_exports' }
  })

#-------------------------------------------------------------------------
basePath = process.cwd()
ccaPath = path.join(basePath, 'node_modules/cca/')
freedomForChromePath = path.dirname(require.resolve('freedom-for-chrome/package.json'))

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
    'generic/network-options.js'
    'generic/version.js'
  ]

  thirdPartyUi: [
    'platform/platform.js',
    'polymer/polymer.html',
    'polymer/polymer.js',
    'webcomponentsjs/**.min.js'
  ]

#------------------------------------------------------------------------------
finishVulcanized = (basePath, baseFilename) ->
  files: [
    {
      src: path.join(basePath, baseFilename + '.html')
      dest: path.join(basePath, baseFilename + '.html')
    }
  ]
  options:
    replacements: [{
      pattern: baseFilename + '.js'
      replacement: baseFilename + '.static.js'
    }, {
      pattern: /<script src=\"[a-zA-Z_./]+third_party\/bower\/([^"]+)"><\/script>/
      replacement: '<script src="../lib/$1"></script>'
    }]

doVulcanize = (src, dest, inline, csp) ->
  options:
    inline: inline
    csp: csp
    excludes:
      scripts: [
        'polymer.js'
      ]
  files: [{
    src: src
    dest: dest
  }]

compileTypescript = (files) ->
  src: files.concat('!**/*.d.ts')
  options:
    target: 'es5'
    comments: true
    noImplicitAny: true
    sourceMap: false
    declaration: true
    module: 'commonjs'
    fast: 'always'

readJSONFile = (file) -> JSON.parse(fs.readFileSync(file, 'utf8'))

getWithBasePath = (files, base = '') ->
  for file in files
    if file[0] == '!'
      '!' + path.join(base, file[1..])
    else
      path.join(base, file)

backendThirdPartyBuildPaths = [
  'bower'
  'sha1'
]

backendFreedomModulePaths = [
  'lib/loggingprovider'
  'lib/churn-pipe'
  'lib/cloud/digitalocean'
  'lib/cloud/install'
  'lib/cloud/social'
]

uiDistFiles = [
  'generic_ui/*.html'
  'generic_ui/style/*.css'
  'generic_ui/polymer/vulcanized*.{html,js}'
  'generic_ui/fonts/*'
  'generic_ui/icons/*'
  'generic_ui/scripts/get_logs.js'
  'generic_ui/scripts/content_digitalocean.js'
]

coreDistFiles = [
  'fonts/*'
  '*.html' # technically does not exist in Firefox

  'freedomjs-anonymized-metrics/anonmetrics.json'
  'freedomjs-anonymized-metrics/metric.js'
  'freedom-social-github/social.github.json'
  'freedom-social-github/github-social-provider.js'
  'freedom-social-firebase/social.firebase-facebook.json'
  'freedom-social-firebase/social.firebase-google.json'
  'freedom-social-firebase/firebase-shims.js'
  'freedom-social-firebase/firebase.js'
  'freedom-social-firebase/firebase-social-provider.js'
  'freedom-social-firebase/facebook-social-provider.js'
  'freedom-social-firebase/google-social-provider.js'
  'freedom-social-firebase/google-auth.js'
  'freedom-social-quiver/socketio.quiver.json'
  'freedom-social-quiver/socketio.quiver.js'
  'freedom-port-control/port-control.js'
  'freedom-port-control/port-control.json'
  'freedom-pgp-e2e/end-to-end.compiled.js'
  'freedom-pgp-e2e/googstorage.js'
  'freedom-pgp-e2e/hex2words.js'
  'freedom-pgp-e2e/e2e.js'
  'freedom-pgp-e2e/pgpapi.json'

  'forge-min/forge.min.js'  # for cloud social provider

  '**/freedom-module.json'
  '**/*.static.js'
]

# this should always be added to arrays of files to copy last
universalDistFiles = [
  'icons/**/*'
  'bower/webcomponentsjs/webcomponents.min.js'
  'bower/polymer/polymer.js'

  '!generic_core/freedom-module.json' # not actually needed for the UI builds
  '!generic_ui/polymer/vulcanized*inline.html'
  '!generic_ui/polymer/vulcanized.js' # vulcanized.html uses vulcanized.static.js
  '!**/*spec*'
]

extraFilesForCoreBuilds = [
  'freedomjs-anonymized-metrics',
  'freedom-social-firebase',
  'freedom-social-github',
  'freedom-social-wechat',
  'freedom-social-quiver',
  'freedom-pgp-e2e',
  'freedom-port-control',
]

getExtraFilesForCoreBuild = (basePath) ->
  for spec in extraFilesForCoreBuilds
    expand: true,
    cwd: path.join('node_modules', spec, 'dist'),
    src: ['**'],
    dest: path.join(basePath, spec)

module.exports = (grunt) ->
  grunt.initConfig
    pkg: readJSONFile('package.json')
    pkgs:
      freedom: readJSONFile('node_modules/freedom/package.json')
      freedomchrome: readJSONFile('node_modules/freedom-for-chrome/package.json')
      freedomfirefox: readJSONFile('node_modules/freedom-for-firefox/package.json')
      freedomfirebase: readJSONFile('node_modules/freedom-social-firebase/package.json')
      freedomGitHub: readJSONFile('node_modules/freedom-social-github/package.json')
      freedomwechat: readJSONFile('node_modules/freedom-social-wechat/package.json')
      freedomquiver: readJSONFile('node_modules/freedom-social-quiver/package.json')

    clean: [devBuildPath, distBuildPath, '.tscache']

    #-------------------------------------------------------------------------
    # Import global names into config name space
    ccaJsPath: path.join(ccaPath, 'src/cca.js')
    androidDevPath: androidDevPath
    ccaDevPath: ccaDevPath
    iosDevPath: iosDevPath
    androidDistPath: androidDistPath
    ccaDistPath: ccaDistPath
    iosDistPath: iosDistPath

    # Create commands to run in different directories
    ccaPlatformAndroidCmd: '<%= ccaJsPath %> platform add android'
    ccaAddPluginsCmd: '<%= ccaJsPath %> plugin add https://github.com/bemasc/cordova-plugin-themeablebrowser.git https://github.com/bemasc/cordova-plugin-splashscreen cordova-custom-config https://github.com/Initsogar/cordova-webintent.git cordova-plugin-device https://github.com/albertolalama/cordova-plugin-tun2socks.git#alalama-tun2socks'

    # Temporarily remove cordova-plugin-chrome-apps-proxy and add the MobileChromeApps version until the new version is released
    ccaAddPluginsIosCmd: '<%= ccaJsPath %> plugin remove cordova-plugin-chrome-apps-proxy && <%= ccaJsPath %> plugin add https://github.com/bemasc/cordova-plugin-themeablebrowser.git https://github.com/gitlaura/cordova-plugin-iosrtc.git https://github.com/MobileChromeApps/cordova-plugin-chrome-apps-proxy.git'

    # Hook needed to use 'cca run ios' command. Can only run after cordova-plugin-iosrtc has been added.
    addIosrtcHookCmd: 'cp plugins/cordova-plugin-iosrtc/extra/hooks/iosrtc-swift-support.js hooks/iosrtc-swift-support.js'

    exec: {
      ccaCreateDev: {
        # Pipe 'no' for the first time cca.js asks whether to send usage stats.
        command: 'echo no | <%= ccaJsPath %> create <%= androidDevPath %> org.uproxy.uProxy "uProxy" --link-to=<%= ccaDevPath %>'
      }
      ccaCreateDist: {
        command: '<%= ccaJsPath %> create <%= androidDistPath %> org.uproxy.uProxy "uProxy" --link-to=<%= ccaDistPath %>'
      }
      ccaPlatformAndroidDev: {
        cwd: '<%= androidDevPath %>'
        command: '<%= ccaPlatformAndroidCmd %>'
      }
      ccaPlatformAndroidDist: {
        cwd: '<%= androidDistPath %>'
        command: '<%= ccaPlatformAndroidCmd %>'
      }
      ccaAddPluginsAndroidDev: {
        cwd: '<%= androidDevPath %>'
        command: '<%= ccaAddPluginsCmd %>'
      }
      ccaAddPluginsAndroidDist: {
        cwd: '<%= androidDistPath %>'
        command: '<%= ccaAddPluginsCmd %>'
      }
      # Note: The fixed crosswalk version here is pinned in order to maintain
      # compatibility with the modified libxwalkcore.so that provides obfuscated WebRTC.
      ccaBuildAndroid: {
        cwd: '<%= androidDevPath %>'
        command: '<%= ccaJsPath %> build android --debug --webview=crosswalk@org.xwalk:xwalk_core_library_beta:20.50.533.6'
      }
      ccaReleaseAndroid: {
        cwd: '<%= androidDistPath %>'
        command: '<%= ccaJsPath %> build android --release --webview=crosswalk@org.xwalk:xwalk_core_library_beta:20.50.533.6'
      }
      ccaEmulateAndroid: {
        cwd: '<%= androidDevPath %>'
        command: '<%= ccaJsPath %> run android --emulator'
      }
      ccaCreateIosDev: {
        command: '<%= ccaJsPath %> create <%= iosDevPath %> org.uproxy.uProxy "uProxy" --link-to=<%= ccaDevPath %>'
      }
      ccaCreateIosDist: {
        command: '<%= ccaJsPath %> create <%= iosDistPath %> org.uproxy.uProxy "uProxy" --link-to=<%= ccaDevPath %>'
      }
      ccaAddPluginsIosBuild: {
        cwd: '<%= iosDevPath %>'
        command: '<%= ccaAddPluginsIosCmd %>'
      }
      addIosrtcHook: {
        cwd: '<%= iosDevPath %>'
        command: '<%= addIosrtcHookCmd %>'
      }
      ccaPrepareIosDev: {
        cwd: '<%= iosDevPath %>'
        command: '<%= ccaJsPath %> prepare'
      }
      ccaPrepareIosDist: {
        cwd: '<%= iosDistPath %>'
        command: '<%= ccaJsPath %> prepare'
      }
      cleanAndroid: {
        command: 'rm -rf <%= androidDevPath %>; rm -rf <%= androidDistPath %>'
      }
      cleanIos: {
        command: 'rm -rf <%= iosDevPath %>; rm -rf <%= iosDistPath %>'
      }
      androidReplaceXwalkDev: {
        command: './replace_xwalk_in_apk.sh debug'
      }
      androidReplaceXwalkDist: {
        command: './replace_xwalk_in_apk.sh release'
      }
      installFreedomForNodeForZork: {
        # This allows our Docker containers, which do not have access to the
        # git repo's "top-level" node_modules/ folder find freedom-for-node.
        command: 'npm install --prefix build/src/lib/samples/zork-node freedom-for-node'
      }
    }

    copy: {
      # Copy releveant non-typescript src files to dev build.
      dev:
        files: [
          {
              nonull: true,
              expand: true,
              cwd: 'src/',
              src: [
                '**/*',
                '!generic_core/dist_build/*',
                '!generic_core/dev_build/*'
              ],
              dest: devBuildPath,
              onlyIf: 'modified'
          }
          {
              nonull: true,
              expand: true,
              cwd: 'src/generic_core/dev_build/',
              src: ['*'],
              dest: devBuildPath + '/generic_core',
              onlyIf: 'modified'
          }
        ]

      # Copy releveant files for distribution.
      dist:
        files: [
          { # Chrome extension
            expand: true
            cwd: chromeExtDevPath
            src: [
              'manifest.json'
              '_locales/**'

              'generic_ui/scripts/copypaste.js'
              'scripts/context.static.js'
              'scripts/background.static.js'
            ].concat(uiDistFiles, universalDistFiles)
            dest: 'build/dist/chrome/extension'
          }
          { # Chrome app
            expand: true
            cwd: chromeAppDevPath
            src: [
              'manifest.json'
              'managed_policy_schema.json'
              '_locales/**'

              # UI for not-connected
              # This is not browserified so we use .js instead of .static.js
              'polymer/vulcanized.{html,js}'

              'freedom-for-chrome/freedom-for-chrome.js'
            ].concat(coreDistFiles, universalDistFiles)
            dest: 'build/dist/chrome/app'
          }
          { # Chrome app freedom-module
            expand: true
            cwd: 'src/generic_core/dist_build/'
            src: ['*']
            dest: 'build/dist/chrome/app/generic_core'
          }
          { # Firefox
            expand: true
            cwd: firefoxDevPath
            src: [
              'package.json'

              # addon sdk scripts
              'lib/**/*.js'

              'data/scripts/content-proxy.js'

              'data/freedom-for-firefox/freedom-for-firefox.jsm'
            ].concat(
              getWithBasePath(uiDistFiles, 'data'),
              getWithBasePath(coreDistFiles, 'data'),
              getWithBasePath(universalDistFiles, 'data'))
            dest: 'build/dist/firefox'
          }
          { # Firefox freedom-module
            expand: true
            cwd: 'src/generic_core/dist_build/'
            src: ['*']
            dest: 'build/dist/firefox/data/generic_core/'
          }
          { # CCA app
            expand: true
            cwd: ccaDevPath
            src: [
              'manifest.json'
              'config.xml'

              # This is not browserified so we use .js instead of .static.js
              'polymer/vulcanized.{html,js}'

              'freedom-for-chrome/freedom-for-chrome.js'
            ].concat(uiDistFiles, coreDistFiles, universalDistFiles)
            dest: ccaDistPath
          }
          { # CCA freedom-module.json
            expand: true
            cwd: 'src/generic_core/cca_build/'
            src: ['*']
            dest: path.join(ccaDistPath, 'generic_core')
          }
        ]

      cca_splash_dev:
        files: [
          {
            expand: true
            cwd: 'src/cca'
            src: [ 'splashscreen.png' ]
            dest: path.join(androidDevPath, 'platforms/android/res/drawable-port-xhdpi')
          }
        ]

      cca_splash_dist:
        files: [
          {
            expand: true
            cwd: 'src/cca'
            src: [ 'splashscreen.png' ]
            dest: path.join(androidDistPath, 'platforms/android/res/drawable-port-xhdpi')
          }
        ]

      chrome_extension:
        Rule.copyLibs
          npmLibNames: [
          ]
          pathsFromDevBuild: [
            'generic_ui'
            'interfaces'
            'icons'
            'fonts'
          ]
          pathsFromThirdPartyBuild: [
            'bower'
          ]
          files: [
            {
              expand: true, cwd: devBuildPath, flatten: true
              src: FILES.uproxy_common
              dest: chromeExtDevPath + '/generic_ui/scripts'
            }
            {
              expand: true, cwd: devBuildPath, flatten: true
              src: FILES.uproxy_common
              dest: chromeExtDevPath + '/scripts'
            }
            {
              expand: true, cwd: devBuildPath, flatten: true
              src: FILES.uproxy_common
              dest: chromeExtDevPath + '/generic'
            }
          ]
          localDestPath: 'chrome/extension'
      chrome_extension_additional:
        files: [
          { # copy chrome extension panel components from the background
            expand: true, cwd: chromeExtDevPath
            src: ['polymer/*', 'scripts/*', 'icons/*', 'fonts/*', '*.html']
            dest: chromeExtDevPath + '/generic_ui'
          }
        ]

      chrome_app:
        Rule.copyLibs
          npmLibNames: [
            'freedom-for-chrome'
            'forge-min'
          ]
          pathsFromDevBuild: [
            'generic_core'
          ].concat(backendFreedomModulePaths)
          pathsFromThirdPartyBuild: backendThirdPartyBuildPaths
          files: getExtraFilesForCoreBuild(chromeAppDevPath).concat({ # uProxy Icons and fonts
            expand: true, cwd: 'src/'
            src: ['icons/128_online.png', 'fonts/*']
            dest: chromeAppDevPath
          })
          localDestPath: 'chrome/app/'

      # {
      #   # Copy third party UI files required for polymer.
      #   expand: true, cwd: 'third_party/lib'
      #   src: FILES.thirdPartyUi
      #   dest: chromeAppDevPath + 'lib'
      # }, {
      #   # Chrome app polymer.
      #   # (Assumes vulcanize tasks have executed)
      #   expand: true, cwd: 'build/compile-src/chrome/app/polymer'
      #   src: ['vulcanized.*']
      #   dest: chromeAppDevPath + 'polymer'
      # }]

      # Firefox. Assumes the top-level tasks generic_core and generic_ui
      # completed.
      firefox:
        Rule.copyLibs
          npmLibNames: [
            'freedom-for-firefox'
            'forge-min'
          ]
          pathsFromDevBuild: [
            'generic_core'
            'generic_ui'
            'interfaces'
            'icons'
            'fonts'
          ].concat(backendFreedomModulePaths)
          pathsFromThirdPartyBuild: backendThirdPartyBuildPaths
          files: getExtraFilesForCoreBuild(path.join(firefoxDevPath, 'data')).concat({ #lib
            expand: true, cwd: devBuildPath
            src: ['interfaces/*.js']
            dest: firefoxDevPath + '/lib'
          })
          localDestPath: 'firefox/data'
      firefox_additional:
        files: [
          { # copy chrome extension panel components from the background
            expand: true, cwd: firefoxDevPath + '/data'
            src: ['polymer/*', 'scripts/*', 'icons/*', 'fonts/*']
            dest: firefoxDevPath + '/data/generic_ui'
          }
          { # copy generic files used by core and UI
            expand: true, cwd: genericPath
            src: ['*.js']
            dest: firefoxDevPath + '/data/generic'
          }
        ]
      cca:
        Rule.copyLibs
          npmLibNames: [
            'freedom-for-chrome'
            'forge-min'
          ]
          pathsFromDevBuild: [
            'generic_core'
            'generic_ui'
            'interfaces'
            'icons'
            'fonts'
          ].concat(backendFreedomModulePaths)
          pathsFromThirdPartyBuild: backendThirdPartyBuildPaths
          files: getExtraFilesForCoreBuild(ccaDevPath).concat({ # uProxy Icons and fonts
            expand: true, cwd: 'src/'
            src: ['icons/128_online.png', 'fonts/*']
            dest: ccaDevPath
          })
          localDestPath: 'cca/app/'
      cca_additional:
        files: [
          { # copy chrome extension panel components from the background
            expand: true, cwd: ccaDevPath
            src: ['polymer/*', 'scripts/*', 'icons/*', 'fonts/*', '*.html']
            dest: ccaDevPath + '/generic_ui'
          }
          { # copy generic files used by core and UI
            expand: true, cwd: genericPath
            src: ['*.js']
            dest: ccaDevPath + '/generic'
          }
          { # CCA freedom-module.json
            expand: true
            cwd: 'src/generic_core/cca_build/'
            src: ['*']
            dest: path.join(ccaDevPath, 'generic_core')
          }
        ]

      integration:
        files: [ {
          # Copy compiled Chrome App code, required for integration tests
          expand: true, cwd: chromeAppDevPath
          src: ['**', '!**/spec', '!**/*.md', '!**/*.ts']
          dest: devBuildPath + '/integration'
        }]

      # uproxy-lib sample apps.
      libsForDeployerChromeApp:
        Rule.copyLibs
          npmLibNames: ['freedom-for-chrome', 'forge-min']
          pathsFromDevBuild: ['lib/loggingprovider', 'lib/cloud/deployer', 'lib/cloud/digitalocean', 'lib/cloud/install']
          localDestPath: 'lib/samples/deployer-chromeapp/'
      libsForDeployerFirefoxApp:
        Rule.copyLibs
          npmLibNames: ['freedom-for-firefox', 'forge-min']
          pathsFromDevBuild: ['lib/loggingprovider', 'lib/cloud/deployer', 'lib/cloud/digitalocean', 'lib/cloud/install']
          localDestPath: 'lib/samples/deployer-firefoxapp/data'

      libsForZorkChromeApp:
        Rule.copyLibs
          npmLibNames: ['freedom-for-chrome']
          pathsFromDevBuild: ['lib/churn-pipe', 'lib/loggingprovider', 'lib/zork']
          pathsFromThirdPartyBuild: ['freedom-port-control']
          localDestPath: 'lib/samples/zork-chromeapp/'
      libsForZorkFirefoxApp:
        Rule.copyLibs
          npmLibNames: ['freedom-for-firefox']
          pathsFromDevBuild: ['lib/churn-pipe', 'lib/loggingprovider', 'lib/zork']
          pathsFromThirdPartyBuild: ['freedom-port-control']
          localDestPath: 'lib/samples/zork-firefoxapp/data/'
      libsForZorkNode:
        Rule.copyLibs
          pathsFromDevBuild: ['lib/churn-pipe', 'lib/loggingprovider', 'lib/zork']
          pathsFromThirdPartyBuild: ['freedom-port-control']
          localDestPath: 'lib/samples/zork-node/'

      libsForEchoServerChromeApp:
        Rule.copyLibs
          npmLibNames: ['freedom-for-chrome']
          pathsFromDevBuild: ['lib/echo', 'lib/loggingprovider']
          localDestPath: 'lib/samples/echo-server-chromeapp/'
      libsForEchoServerFirefoxApp:
        Rule.copyLibs
          npmLibNames: ['freedom-for-firefox']
          pathsFromDevBuild: ['lib/echo', 'lib/loggingprovider']
          localDestPath: 'lib/samples/echo-server-firefoxapp/data/'
      libsForEchoServerNode:
        Rule.copyLibs
          npmLibNames: ['freedom-for-node']
          pathsFromDevBuild: ['lib/echo', 'lib/loggingprovider']
          localDestPath: 'lib/samples/echo-server-node/'

      libsForCopypasteChatChromeApp:
        Rule.copyLibs
          npmLibNames: ['freedom-for-chrome']
          pathsFromDevBuild: ['lib/copypaste-chat', 'lib/churn-pipe', 'lib/loggingprovider']
          pathsFromThirdPartyBuild: ['freedom-port-control']
          localDestPath: 'lib/samples/copypaste-chat-chromeapp/'
      libsForCopypasteChatFirefoxApp:
        Rule.copyLibs
          npmLibNames: ['freedom-for-firefox']
          pathsFromDevBuild: ['lib/copypaste-chat', 'lib/churn-pipe', 'lib/loggingprovider']
          pathsFromThirdPartyBuild: ['freedom-port-control']
          localDestPath: 'lib/samples/copypaste-chat-firefoxapp/data'
      libsForCopypasteChatWebApp:
        Rule.copyLibs
          npmLibNames: ['freedom']
          pathsFromDevBuild: ['lib/copypaste-chat', 'lib/churn-pipe', 'lib/loggingprovider']
          pathsFromThirdPartyBuild: ['freedom-port-control']
          localDestPath: 'lib/samples/copypaste-chat-webapp/'

      libsForCopyPasteSocksChromeApp:
        Rule.copyLibs
          npmLibNames: [
            'freedom-for-chrome'
          ]
          pathsFromDevBuild: ['lib/copypaste-socks', 'lib/churn-pipe', 'lib/loggingprovider']
          pathsFromThirdPartyBuild: [
            'i18n'
            'bower/polymer'
            'freedom-pgp-e2e'
            'freedom-port-control'
          ]
          localDestPath: 'lib/samples/copypaste-socks-chromeapp/'
      libsForCopyPasteSocksFirefoxApp:
        Rule.copyLibs
          npmLibNames: [
            'freedom-for-firefox'
          ]
          pathsFromDevBuild: ['lib/copypaste-socks', 'lib/churn-pipe', 'lib/loggingprovider']
          pathsFromThirdPartyBuild: [
            'i18n'
            'bower'
            'freedom-pgp-e2e'
            'freedom-port-control'
          ]
          localDestPath: 'lib/samples/copypaste-socks-firefoxapp/data'

      libsForSimpleSocksChromeApp:
        Rule.copyLibs
          npmLibNames: ['freedom-for-chrome']
          pathsFromDevBuild: ['lib/simple-socks', 'lib/churn-pipe', 'lib/loggingprovider']
          pathsFromThirdPartyBuild: ['freedom-port-control']
          localDestPath: 'lib/samples/simple-socks-chromeapp/'
      libsForSimpleSocksFirefoxApp:
        Rule.copyLibs
          npmLibNames: ['freedom-for-firefox']
          pathsFromDevBuild: ['lib/simple-socks', 'lib/churn-pipe', 'lib/loggingprovider']
          pathsFromThirdPartyBuild: ['freedom-port-control']
          localDestPath: 'lib/samples/simple-socks-firefoxapp/data/'
      libsForSimpleSocksNode:
        Rule.copyLibs
          npmLibNames: ['freedom-for-node']
          pathsFromDevBuild: ['lib/simple-socks', 'lib/churn-pipe', 'lib/loggingprovider']
          pathsFromThirdPartyBuild: [
            'uproxy-obfuscators'
            'freedom-port-control'
          ]
          localDestPath: 'lib/samples/simple-socks-node/'

      libsForSimpleChatChromeApp:
        Rule.copyLibs
          npmLibNames: ['freedom-for-chrome']
          pathsFromDevBuild: ['lib/simple-chat', 'lib/churn-pipe', 'lib/loggingprovider']
          pathsFromThirdPartyBuild: ['freedom-port-control']
          localDestPath: 'lib/samples/simple-chat-chromeapp/'
      libsForSimpleChatFirefoxApp:
        Rule.copyLibs
          npmLibNames: ['freedom-for-firefox']
          pathsFromDevBuild: ['lib/simple-chat', 'lib/churn-pipe', 'lib/loggingprovider']
          pathsFromThirdPartyBuild: ['freedom-port-control']
          localDestPath: 'lib/samples/simple-chat-firefoxapp/data'
      # While neither churn-pipe nor freedom-port-control can be used in a
      # regular web page environment, they are included so that obfuscation
      # may be easily enabled in the Chrome and Firefox samples.
      libsForSimpleChatWebApp:
        Rule.copyLibs
          npmLibNames: ['freedom']
          pathsFromDevBuild: ['lib/simple-chat', 'lib/churn-pipe', 'lib/loggingprovider']
          pathsFromThirdPartyBuild: ['freedom-port-control']
          localDestPath: 'lib/samples/simple-chat-webapp/'

      libsForUprobeChromeApp:
        Rule.copyLibs
          npmLibNames: ['freedom-for-chrome']
          pathsFromDevBuild: ['lib/uprobe', 'lib/loggingprovider']
          localDestPath: 'lib/samples/uprobe-chromeapp/'
      libsForUprobeFirefoxApp:
        Rule.copyLibs
          npmLibNames: ['freedom-for-firefox']
          pathsFromDevBuild: ['lib/uprobe', 'lib/loggingprovider']
          localDestPath: 'lib/samples/uprobe-firefoxapp/data/'

      # uproxy-lib integration tests.
      libsForIntegrationTcp:
        Rule.copyLibs
          npmLibNames: ['freedom-for-chrome']
          pathsFromDevBuild: ['lib/loggingprovider']
          localDestPath: 'lib/integration-tests/tcp'
      libsForIntegrationSocksEcho:
        Rule.copyLibs
          npmLibNames: ['freedom-for-chrome']
          pathsFromDevBuild: ['lib/churn-pipe', 'lib/loggingprovider']
          pathsFromThirdPartyBuild: ['freedom-port-control']
          localDestPath: 'lib/integration-tests/socks-echo'
    }  # copy

    symlink: {
      cca_keys:
        files: [
          {
            expand: true
            cwd: 'keys'
            src: [
              'android-release-keys.properties'
              'play_store_keys.p12'
            ]
            dest: androidDistPath
          }
        ]
    }

    #-------------------------------------------------------------------------
    'string-replace':
      version:
        files: [
          {
            src: path.join(devBuildPath, 'generic/version.js')
            dest: path.join(devBuildPath, 'generic/version.js')
          }
        ]
        options:
          replacements: [{
            pattern: /\"___VERSION_TEMPLATE___\"/g
            replacement: JSON.stringify
              version: '<%= pkg.version %>'
              gitcommit: '<%= gitinfo.local.branch.current.SHA %>'
              freedom: '<%= pkgs.freedom.version %>'
              'freedom-for-chrome': '<%= pkgs.freedomchrome.version %>'
              'freedom-for-firefox': '<%= pkgs.freedomfirefox.version %>'
              'freedom-social-firebase': '<%= pkgs.freedomfirebase.version %>'
              'freedom-social-github': '<%= pkgs.freedomGitHub.version %>'
              'freedom-social-wechat': '<%= pkgs.freedomwechat.version %>'
              'freedom-social-quiver': '<%= pkgs.freedomquiver.version %>'
          }]

    # One pass for code running inside freedom.js modules and another
    # for code running outside, due to the differences in the meaning
    # of the (global) freedom object between the two environments.
    ts:
      moduleEnv: compileTypescript [
        devBuildPath + '/**/*.ts'
        '!' + devBuildPath + '/lib/build-tools/**/*.ts'
        '!' + devBuildPath + '/integration/**/*.ts'
        '!' + devBuildPath + '/**/*.core-env.ts'
        '!' + devBuildPath + '/**/*.core-env.spec.ts'
        '!' + androidDevPath + '/**/*.ts'
      ]
      coreEnv: compileTypescript [
        devBuildPath + '/**/*.core-env.ts'
        devBuildPath + '/**/*.core-env.spec.ts'
        '!' + devBuildPath + '/lib/build-tools/**/*.ts'
        '!' + devBuildPath + '/integration/**/*.ts'
        '!' + androidDevPath + '/**/*.ts'
      ]

    browserify:
      chromeAppMain: Rule.browserify 'chrome/app/scripts/main.core-env'
      chromeExtMain: Rule.browserify('chrome/extension/scripts/background',
        browserifyOptions:
          standalone: 'ui_context'
      )
      chromeContext: Rule.browserify('chrome/extension/scripts/context',
        browserifyOptions:
          standalone: 'ui_context'
      )

      firefoxContext:
        src: [
          firefoxDevPath + '/data/scripts/background.js'
        ]
        dest: firefoxDevPath + '/data/scripts/context.static.js'
        options:
          browserifyOptions:
            standalone: 'ui_context'

      ccaMain: Rule.browserify('cca/app/scripts/main.core-env',
        browserifyOptions:
          standalone: 'ui_context'
      )
      ccaContext: Rule.browserify('cca/app/scripts/context',
        browserifyOptions:
          standalone: 'ui_context'
      )

      chromeExtensionCoreConnector: Rule.browserify 'chrome/extension/scripts/chrome_core_connector'
      chromeExtensionCoreConnectorSpec: Rule.browserifySpec 'chrome/extension/scripts/chrome_core_connector'
      genericCoreFirewall: Rule.browserify 'generic_core/firewall'
      genericCoreFreedomModule: Rule.browserify 'generic_core/freedom-module'
      integrationSpec: Rule.browserifySpec 'integration/core'
      integrationFreedomModule: Rule.browserify 'integration/test_connection'

      # uproxy-lib
      loggingProvider: Rule.browserify 'lib/loggingprovider/freedom-module'
      churnPipeFreedomModule: Rule.browserify 'lib/churn-pipe/freedom-module'
      cloudInstallerFreedomModule: Rule.browserify 'lib/cloud/install/freedom-module'
      cloudSocialProviderFreedomModule: Rule.browserify 'lib/cloud/social/freedom-module'
      digitalOceanFreedomModule: Rule.browserify 'lib/cloud/digitalocean/freedom-module'

      # uproxy-lib sample apps.
      copypasteChatFreedomModule: Rule.browserify 'lib/copypaste-chat/freedom-module'
      copypasteSocksFreedomModule: Rule.browserify 'lib/copypaste-socks/freedom-module'
      deployerFreedomModule: Rule.browserify 'lib/cloud/deployer/freedom-module'
      echoServerFreedomModule: Rule.browserify 'lib/echo/freedom-module'
      simpleChatFreedomModule: Rule.browserify 'lib/simple-chat/freedom-module'
      simpleSocksFreedomModule: Rule.browserify 'lib/simple-socks/freedom-module'
      uprobeFreedomModule: Rule.browserify 'lib/uprobe/freedom-module'
      zorkFreedomModule: Rule.browserify 'lib/zork/freedom-module'
      # uproxy-lib sample apps (with UI).
      copypasteChatMain: Rule.browserify 'lib/copypaste-chat/main.core-env'
      copypasteSocksMain: Rule.browserify 'lib/copypaste-socks/main.core-env'
      simpleChatMain: Rule.browserify 'lib/simple-chat/main.core-env'

      integrationTcpFreedomModule: Rule.browserify 'lib/integration-tests/tcp/freedom-module'
      integrationTcpSpec: browserifyIntegrationTest 'lib/integration-tests/tcp/tcp.core-env'
      integrationSocksEchoFreedomModule: Rule.browserify 'lib/integration-tests/socks-echo/freedom-module'
      integrationSocksEchoChurnSpec: browserifyIntegrationTest 'lib/integration-tests/socks-echo/churn.core-env'
      integrationSocksEchoNochurnSpec: browserifyIntegrationTest 'lib/integration-tests/socks-echo/nochurn.core-env'
      integrationSocksEchoSlowSpec: browserifyIntegrationTest 'lib/integration-tests/socks-echo/slow.core-env'

    tslint:
      options:
        configuration: 'src/tslint.json'
      files:
        src: [
          'src/**/*.ts'
        ]

    jshint:
      firefox:
        options:
          moz: true
        src: [
          'src/firefox/lib/*.js'
        ]

    #-------------------------------------------------------------------------
    jasmine:
      chrome_extension: Rule.jasmineSpec('chrome/extension/scripts/',
          [path.join('build/src/mocks/chrome_mocks.js')])

    jasmine_chromeapp: {
      all: {
        files: [
          {
            cwd: devBuildPath + '/integration/',
            src: ['**/*'],
            dest: './',
            expand: true
          }
        ],
        scripts: ['freedom-for-chrome/freedom-for-chrome.js',
                  'core.spec.static.js'
        ],
        options: {
          outdir: 'build/src/integration/'
          # Uncomment this for debugging
          # keepRunner: true,
        }
      }
      tcp:
        files: [
          {
            cwd: devBuildPath + '/lib/integration-tests/tcp/',
            src: ['**/*', '!jasmine_chromeapp/**/*']
            dest: './',
            expand: true
          }
        ]
        scripts: [
          'freedom-for-chrome/freedom-for-chrome.js'
          'tcp.core-env.spec.static.js'
        ]
        options:
          outDir: devBuildPath + '/lib/integration-tests/tcp/jasmine_chromeapp/'
          keepRunner: false
      socksEcho:
        files: [
          {
            cwd: devBuildPath + '/lib/integration-tests/socks-echo/',
            src: ['**/*', '!jasmine_chromeapp*/**']
            dest: './',
            expand: true
          }
        ]
        scripts: [
          'freedom-for-chrome/freedom-for-chrome.js'
          'churn.core-env.spec.static.js'
          'nochurn.core-env.spec.static.js'
        ]
        options:
          outDir: devBuildPath + '/lib/integration-tests/socks-echo/jasmine_chromeapp/'
          keepRunner: false
      socksEchoSlow:
        files: [
          {
            cwd: devBuildPath + '/lib/integration-tests/socks-echo/',
            src: ['**/*', '!jasmine_chromeapp*/**']
            dest: './',
            expand: true
          }
        ]
        scripts: [
          'freedom-for-chrome/freedom-for-chrome.js'
          'slow.core-env.spec.static.js'
        ]
        options:
          outDir: devBuildPath + '/lib/integration-tests/socks-echo/jasmine_chromeapp_slow/'
          keepRunner: true
    }
    'jpm':
      options:
        src: 'build/dist/firefox/'
        xpi: 'build/dist/'
        debug: true

    vulcanize:
      copypasteSocks:
        options:
          inline: true
          csp: true
        files: [
          {
            src: path.join(devBuildPath, 'lib/copypaste-socks/polymer-components/root.html')
            dest: path.join(devBuildPath, 'lib/copypaste-socks/polymer-components/vulcanized.html')
          }
        ]

  #-------------------------------------------------------------------------
  # Helper functions for different components

  fullyVulcanize = (basePath, srcFilename, destFilename, browserify = false) ->
    tasks = []

    # this adds the rule to the task to the grunt object as well as
    # adding the text needed to run it in a rule to the list of rules that will be
    # returned
    addTask = (component, task, rule) ->
      grunt.config.set(component + '.' + task, rule);
      tasks.push(component + ':' + task)

    realBasePath = path.join(devBuildPath, basePath)
    srcFile = path.join(realBasePath, srcFilename + '.html')
    intermediateFile = path.join(realBasePath, destFilename + '-inline.html')
    destFile = path.join(realBasePath, destFilename + '.html')
    taskName = path.join(realBasePath, destFilename)

    # The basic vulcanize tasks, we do both steps in order to get all the
    # javascript into a separate file
    addTask('vulcanize', taskName + 'Inline', doVulcanize(srcFile, intermediateFile, true, false))
    addTask('vulcanize', taskName + 'Csp', doVulcanize(intermediateFile, destFile, false, true))

    if browserify
      # If we need to brewserify the file, there also needs to be a step to replace
      # some of the strings in the vulcanized html file to refer to the static version
      browserifyPath = path.join(basePath, destFilename)
      addTask('string-replace', taskName + 'Vulcanized', finishVulcanized(realBasePath, destFilename))
      addTask('browserify', browserifyPath, Rule.browserify(browserifyPath, {}))

    return tasks

  grunt.registerTask 'base', [
    'copy:dev'
    'ts'
    'version_file'
    'browserify:chromeAppMain'
    'browserify:genericCoreFreedomModule'
    'browserify:ccaMain'
    'browserify:loggingProvider'
    'browserify:churnPipeFreedomModule'
    'browserify:cloudInstallerFreedomModule'
    'browserify:cloudSocialProviderFreedomModule'
    'browserify:digitalOceanFreedomModule'
  ]

  grunt.registerTask 'echoServer', [
    'base'
    'browserify:echoServerFreedomModule'
    'copy:libsForEchoServerChromeApp'
    'copy:libsForEchoServerFirefoxApp'
    'copy:libsForEchoServerNode'
  ]

  grunt.registerTask 'copypasteChat', [
    'base'
    'browserify:copypasteChatFreedomModule'
    'browserify:copypasteChatMain'
    'copy:libsForCopypasteChatChromeApp'
    'copy:libsForCopypasteChatFirefoxApp'
    'copy:libsForCopypasteChatWebApp'
  ]

  grunt.registerTask 'copypasteSocks', [
    'base'
    'browserify:copypasteSocksFreedomModule'
    'browserify:copypasteSocksMain'
    'vulcanize:copypasteSocks'
    'copy:libsForCopyPasteSocksChromeApp'
    'copy:libsForCopyPasteSocksFirefoxApp'
  ]

  grunt.registerTask 'deployer', [
    'base'
    'browserify:deployerFreedomModule'
    'copy:libsForDeployerChromeApp'
    'copy:libsForDeployerFirefoxApp'
  ]

  grunt.registerTask 'simpleChat', [
    'base'
    'browserify:simpleChatFreedomModule'
    'browserify:simpleChatMain'
    'copy:libsForSimpleChatChromeApp'
    'copy:libsForSimpleChatFirefoxApp'
    'copy:libsForSimpleChatWebApp'
  ]

  grunt.registerTask 'simpleSocks', [
    'base'
    'browserify:simpleSocksFreedomModule'
    'copy:libsForSimpleSocksChromeApp'
    'copy:libsForSimpleSocksFirefoxApp'
    'copy:libsForSimpleSocksNode'
  ]

  grunt.registerTask 'uprobe', [
    'base'
    'browserify:uprobeFreedomModule'
    'copy:libsForUprobeChromeApp'
    'copy:libsForUprobeFirefoxApp'
  ]

  grunt.registerTask 'zork', [
    'base'
    'browserify:zorkFreedomModule'
    'copy:libsForZorkChromeApp'
    'copy:libsForZorkFirefoxApp'
    'copy:libsForZorkNode'
    'exec:installFreedomForNodeForZork'
  ]

  grunt.registerTask 'version_file', [
    'gitinfo'
    'string-replace:version'
  ]

  grunt.registerTask 'build_chrome_app', [
    'base'
    'copy:chrome_app'
  ].concat fullyVulcanize('chrome/app/polymer', 'ext-missing', 'vulcanized')

  grunt.registerTask('build_chrome_ext', [
    'base'
    'copy:chrome_extension'
    'copy:chrome_extension_additional'
    'browserify:chromeExtMain'
    'browserify:chromeContext'
  ].concat fullyVulcanize('chrome/extension/generic_ui/polymer', 'root', 'vulcanized', true))

  grunt.registerTask 'build_chrome', [
    'build_chrome_app'
    'build_chrome_ext'
  ]

  # Firefox build tasks.
  grunt.registerTask('build_firefox', [
    'base'
    'copy:firefox'
    'copy:firefox_additional'
    'browserify:firefoxContext'
  ].concat fullyVulcanize('firefox/data/generic_ui/polymer', 'root', 'vulcanized', true))

  # CCA build tasks.
  grunt.registerTask 'build_cca', [
    'base'
    'copy:cca'
    'copy:cca_additional'
    'browserify:ccaMain'
    'browserify:ccaContext'
  ].concat fullyVulcanize('cca/app/generic_ui/polymer', 'root', 'vulcanized', true)

  # Mobile OS build tasks
  grunt.registerTask 'build_android', [
    'exec:cleanAndroid'
    'build_cca'
    'exec:ccaCreateDev'
    'exec:ccaPlatformAndroidDev'
    'exec:ccaAddPluginsAndroidDev'
    'copy:cca_splash_dev'
    'exec:ccaBuildAndroid'
    'exec:androidReplaceXwalkDev'
  ]

  grunt.registerTask 'release_android', [
    'build_cca'
    'copy:dist'
    'exec:ccaCreateDist'
    'exec:ccaPlatformAndroidDist'
    'exec:ccaAddPluginsAndroidDist'
    'copy:cca_splash_dist'
    'symlink:cca_keys'
    'exec:ccaReleaseAndroid'
    'exec:androidReplaceXwalkDist'
  ]

  # Emulate the mobile client for android
  grunt.registerTask 'emulate_android', [
   'build_android'
   'exec:ccaEmulateAndroid'
  ]

  grunt.registerTask 'build_ios', [
    'exec:cleanIos'
    'build_cca'
    'exec:ccaCreateIosDev'
    'exec:ccaAddPluginsIosBuild'
    'exec:addIosrtcHook'
    'exec:ccaPrepareIosDev'
  ]

  grunt.registerTask 'test_chrome', [
    'build_chrome'
    'browserify:chromeExtensionCoreConnectorSpec'
    'jasmine:chrome_extension'
  ]

  grunt.registerTask 'tcpIntegrationTestModule', [
    'base'
    'copy:libsForIntegrationTcp'
    'browserify:integrationTcpFreedomModule'
    'browserify:integrationTcpSpec'
  ]

  grunt.registerTask 'tcpIntegrationTest', [
    'tcpIntegrationTestModule'
    'jasmine_chromeapp:tcp'
  ]

  grunt.registerTask 'socksEchoIntegrationTestModule', [
    'base'
    'copy:libsForIntegrationSocksEcho'
    'browserify:integrationSocksEchoFreedomModule'
    'browserify:integrationSocksEchoChurnSpec'
    'browserify:integrationSocksEchoNochurnSpec'
    'browserify:integrationSocksEchoSlowSpec'
  ]

  grunt.registerTask 'socksEchoIntegrationTest', [
    'socksEchoIntegrationTestModule'
    'jasmine_chromeapp:socksEcho'
  ]

  grunt.registerTask 'unit_test_nobuild', _.flatten(
    Rule.buildAndRunTest(spec, grunt) for spec in Rule.getTests('src', 'lib', ['build-tools', 'integration-tests']),
    Rule.buildAndRunTest(spec, grunt) for spec in Rule.getTests('src', 'generic_core'),
    Rule.buildAndRunTest(spec, grunt) for spec in Rule.getTests('src', 'generic_ui/scripts')
  )

  grunt.registerTask 'unit_test', [
    'base'
    'unit_test_nobuild'
  ]

  # TODO: add test_chrome once it passes reliably
  grunt.registerTask 'integration_test', [
    'tcpIntegrationTest'
    'socksEchoIntegrationTest'
  ]

  grunt.registerTask 'test', [
    'unit_test'
    'integration_test'
  ]

  # Builds all code, including the "dist" build, but skips
  # iOS and Android as well as
  # ts-linting and testing which can be annoying and slow.
  # jshint is here because catches hard syntax errors, etc.
  grunt.registerTask 'build', [
    'build_chrome'
    'build_firefox'
    'build_cca'
    'jshint'
    'copy:dist'
    'jpm:xpi'
  ]

  grunt.registerTask 'lint', [
    'copy:dev'
    'tslint'
  ]

  # This is run prior to releasing uProxy and, in addition to
  # building, tests and lints all code.
  grunt.registerTask 'dist', [
    'build'
    'lint'
    'test'
  ]

  grunt.registerTask 'default', [
    'build'
  ]

  #-------------------------------------------------------------------------
  grunt.loadNpmTasks 'grunt-browserify'
  grunt.loadNpmTasks 'grunt-contrib-clean'
  grunt.loadNpmTasks 'grunt-contrib-copy'
  grunt.loadNpmTasks 'grunt-contrib-jasmine'
  grunt.loadNpmTasks 'grunt-contrib-jshint'
  grunt.loadNpmTasks 'grunt-contrib-symlink'
  grunt.loadNpmTasks 'grunt-exec'
  grunt.loadNpmTasks 'grunt-gitinfo'
  grunt.loadNpmTasks 'grunt-jasmine-chromeapp'
  grunt.loadNpmTasks 'grunt-jpm'
  grunt.loadNpmTasks 'grunt-string-replace'
  grunt.loadNpmTasks 'grunt-ts'
  grunt.loadNpmTasks 'grunt-tslint'
  grunt.loadNpmTasks 'grunt-vulcanize'
