/* jshint node: true */
/* jshint esversion: 6 */

module.exports = function(grunt) {
  'use strict';

  require('time-grunt')(grunt);
  const _ = require('lodash');
  const fs = require('fs');
  const rules = require('./build/tools/common-grunt-rules');
  const path = require('path');

//-------------------------------------------------------------------------

  // Location of where src is copied into and compiled
  const devBuildPath = 'build/src';
  const distBuildPath = 'build/dist';
  // Location of where to copy/build third_party source/libs.
  const thirdPartyBuildPath = 'build/third_party';
  // This is used for the copying of uproxy libraries into the target directory.
  const localLibsDestPath = '';

  // Setup our build rules/tools
  const Rule = new rules.Rule({
    // The path where code in this repository should be built in.
    devBuildPath: devBuildPath,
    // The path from where third party libraries should be copied. e.g. as used by
    // sample apps.
    thirdPartyBuildPath: thirdPartyBuildPath,
    // The path to copy modules from this repository into. e.g. as used by sample
    // apps.
    localLibsDestPath: localLibsDestPath
  });

//------------------------------------------------------------------------- 
  const chromeExtDevPath = path.join(devBuildPath, 'chrome/extension/');
  const chromeAppDevPath = path.join(devBuildPath, 'chrome/app/');
  const firefoxDevPath = path.join(devBuildPath, 'firefox/');
  const ccaDevPath = path.join(devBuildPath, 'cca/app/');
  const androidDevPath = path.join(devBuildPath, 'android/');
  const iosDevPath = path.join(devBuildPath, 'ios/');
  const genericPath = path.join(devBuildPath, 'generic/');

  const ccaDistPath = path.join(distBuildPath, 'cca/app/');
  const androidDistPath = path.join(distBuildPath, 'android/');
  const iosDistPath = path.join(distBuildPath, 'ios/');

//-------------------------------------------------------------------------
  function browserifyIntegrationTest(path) {
    return Rule.browserifySpec(path, {
      browserifyOptions: {
        standalone: 'browserified_exports'
      }
    });
  }

//-------------------------------------------------------------------------
  const basePath = process.cwd();
  const ccaPath = path.join(basePath, 'node_modules/cca/');
  const freedomForChromePath = path.dirname(require.resolve('freedom-for-chrome/package.json'));

//-------------------------------------------------------------------------
// TODO: Move more file lists here.
  const FILES = {
    jasmine_helpers: [
      // Help Jasmine's PhantomJS understand promises.
      'node_modules/es6-promise/dist/promise-*.js',
      '!node_modules/es6-promise/dist/promise-*amd.js',
      '!node_modules/es6-promise/dist/promise-*.min.js'
    ],
    // Files which are required at run-time everywhere
    uproxy_common: [
      'generic/network-options.js',
      'generic/version.js'
    ],
    thirdPartyUi: [
      'platform/platform.js',
      'polymer/polymer.html',
      'polymer/polymer.js',
      'webcomponentsjs/**.min.js'
    ]
  };

//-------------------------------------------------------------------------
  function finishVulcanized(basePath, baseFilename) {
    return {
      files: [{
        src: path.join(basePath, baseFilename + '.html'),
        dest: path.join(basePath, baseFilename + '.html')
      }],
      options: {
        replacements: [
          {
            pattern: baseFilename + '.js',
            replacement: baseFilename + '.static.js'
          }, {
            pattern: /<script src=\"[a-zA-Z_.\/]+third_party\/bower\/([^"]+)"><\/script>/,
            replacement: '<script src="../lib/$1"></script>'
          }
        ]
      }
    };
  }

  function readJSONFile(file) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }

  function getWithBasePath(files, base) {
    base = base || '';
    return files.map((file) => {
      if (file[0] === '!') {
        return '!' + path.join(base, file.slice(1));
      } else {
        return path.join(base, file);
      }
    });
  }

  const backendThirdPartyBuildPaths = ['bower', 'sha1'];

  const backendFreedomModulePaths = [
    'lib/loggingprovider',
    'lib/churn-pipe',
    'lib/cloud/digitalocean',
    'lib/cloud/install',
    'lib/cloud/social'
  ];

  const uiDistFiles = [
    'generic_ui/*.html',
    'generic_ui/style/*.css',
    'generic_ui/polymer/vulcanized*.{html,js}',
    'generic_ui/fonts/*',
    'generic_ui/icons/*',
    'generic_ui/scripts/get_logs.js',
    'generic_ui/scripts/content_digitalocean.js'
  ];

  const coreDistFiles = [
    'fonts/*',
    '*.html',  // technically does not exist in Firefox

    'freedomjs-anonymized-metrics/anonmetrics.json',
    'freedomjs-anonymized-metrics/metric.js',
    'freedom-social-github/social.github.json',
    'freedom-social-github/github-social-provider.js',
    'freedom-social-firebase/social.firebase-facebook.json',
    'freedom-social-firebase/social.firebase-google.json',
    'freedom-social-firebase/firebase-shims.js',
    'freedom-social-firebase/firebase.js',
    'freedom-social-firebase/firebase-social-provider.js',
    'freedom-social-firebase/facebook-social-provider.js',
    'freedom-social-firebase/google-social-provider.js',
    'freedom-social-firebase/google-auth.js',
    'freedom-social-quiver/socketio.quiver.json',
    'freedom-social-quiver/socketio.quiver.js',
    'freedom-port-control/port-control.js',
    'freedom-port-control/port-control.json',
    'freedom-pgp-e2e/end-to-end.compiled.js',
    'freedom-pgp-e2e/googstorage.js',
    'freedom-pgp-e2e/hex2words.js',
    'freedom-pgp-e2e/e2e.js',
    'freedom-pgp-e2e/pgpapi.json',

    'forge-min/forge.min.js',  // For cloud social provider

    '**/freedom-module.json',
    '**/*.static.js'
  ];

  // This should always be added to arrays of files to copy last
  const universalDistFiles = [
    'icons/**/*',
    'bower/webcomponentsjs/webcomponents.min.js',
    'bower/polymer/polymer.js',
    '!generic_core/freedom-module.json',
    '!generic_ui/polymer/vulcanized*inline.html',
    '!generic_ui/polymer/vulcanized.js',
    '!**/*spec*'
  ];

  const extraFilesForCoreBuilds = [
    'freedomjs-anonymized-metrics',
    'freedom-social-firebase',
    'freedom-social-github',
    'freedom-social-wechat',
    'freedom-social-quiver',
    'freedom-pgp-e2e',
    'freedom-port-control'
  ];

  function getExtraFilesForCoreBuild(basePath) {
    return extraFilesForCoreBuilds.map((spec) => {
      return {
        expand: true,
        cwd: path.join('node_modules', spec, 'dist'),
        src: ['**'],
        dest: path.join(basePath, spec)
      };
    });
  }


  grunt.initConfig({
    pkg: readJSONFile('package.json'),
    pkgs: {
      freedom: readJSONFile('node_modules/freedom/package.json'),
      freedomchrome: readJSONFile('node_modules/freedom-for-chrome/package.json'),
      freedomfirefox: readJSONFile('node_modules/freedom-for-firefox/package.json'),
      freedomfirebase: readJSONFile('node_modules/freedom-social-firebase/package.json'),
      freedomGitHub: readJSONFile('node_modules/freedom-social-github/package.json'),
      freedomwechat: readJSONFile('node_modules/freedom-social-wechat/package.json'),
      freedomquiver: readJSONFile('node_modules/freedom-social-quiver/package.json')
    },

    clean: [devBuildPath, distBuildPath, '.tscache'],

    //-------------------------------------------------------------------------
    // Import global names into config name space.
    ccaJsPath: path.join(ccaPath, 'src/cca.js'),
    androidDevPath: androidDevPath,
    ccaDevPath: ccaDevPath,
    iosDevPath: iosDevPath,
    androidDistPath: androidDistPath,
    ccaDistPath: ccaDistPath,
    iosDistPath: iosDistPath,

    // Create commands to run in different directories.
    ccaPlatformAndroidCmd: '<%= ccaJsPath %> platform add android',
    ccaAddPluginsCmd: '<%= ccaJsPath %> plugin add https://github.com/bemasc/cordova-plugin-themeablebrowser.git https://github.com/bemasc/cordova-plugin-splashscreen cordova-custom-config https://github.com/Initsogar/cordova-webintent.git https://github.com/uProxy/cordova-plugin-tun2socks.git cordova-plugin-backbutton',
    
    // Temporarily remove cordova-plugin-chrome-apps-proxy and add the MobileChromeApps version until the new version is released.
    ccaAddPluginsIosCmd: '<%= ccaJsPath %> plugin remove cordova-plugin-chrome-apps-proxy && <%= ccaJsPath %> plugin add https://github.com/bemasc/cordova-plugin-themeablebrowser.git https://github.com/gitlaura/cordova-plugin-iosrtc.git https://github.com/MobileChromeApps/cordova-plugin-chrome-apps-proxy.git',

    // Hook needed to use 'cca run ios' command. Can only run after cordova-plugin-iosrtc has been added.
    addIosrtcHookCmd: 'cp plugins/cordova-plugin-iosrtc/extra/hooks/iosrtc-swift-support.js hooks/iosrtc-swift-support.js',

    exec: {
      ccaCreateDev: {
        // Pipe 'no' for the first time cca.js asks whether to send usage stats.
        command: 'echo no | <%= ccaJsPath %> create <%= androidDevPath %> org.uproxy.uProxy "uProxy" --link-to=<%= ccaDevPath %>'
      },
      ccaCreateDist: {
        command: '<%= ccaJsPath %> create <%= androidDistPath %> org.uproxy.uProxy "uProxy" --link-to=<%= ccaDistPath %>'
      },
      ccaPlatformAndroidDev: {
        cwd: '<%= androidDevPath %>',
        command: '<%= ccaPlatformAndroidCmd %>'
      },
      ccaPlatformAndroidDist: {
        cwd: '<%= androidDistPath %>',
        command: '<%= ccaPlatformAndroidCmd %>'
      },
      ccaAddPluginsAndroidDev: {
        cwd: '<%= androidDevPath %>',
        command: '<%= ccaAddPluginsCmd %>'
      },
      ccaAddPluginsAndroidDist: {
        cwd: '<%= androidDistPath %>',
        command: '<%= ccaAddPluginsCmd %>'
      },
      // Note: The fixed crosswalk version here is pinned in order to maintain
      // compatibility with the modified libxwalkcore.so that provides obfuscated WebRTC.
      ccaBuildAndroid: {
        cwd: '<%= androidDevPath %>',
        command: '<%= ccaJsPath %> build android --debug --webview=crosswalk@org.xwalk:xwalk_core_library_beta:20.50.533.6'
      },
      ccaReleaseAndroid: {
        cwd: '<%= androidDistPath %>',
        command: '<%= ccaJsPath %> build android --release --webview=crosswalk@org.xwalk:xwalk_core_library_beta:20.50.533.6'
      },
      ccaEmulateAndroid: {
        cwd: '<%= androidDevPath %>',
        command: '<%= ccaJsPath %> run android --emulator'
      },
      ccaCreateIosDev: {
        command: '<%= ccaJsPath %> create <%= iosDevPath %> org.uproxy.uProxy "uProxy" --link-to=<%= ccaDevPath %>'
      },
      ccaCreateIosDist: {
        command: '<%= ccaJsPath %> create <%= iosDistPath %> org.uproxy.uProxy "uProxy" --link-to=<%= ccaDevPath %>'
      },
      ccaAddPluginsIosBuild: {
        cwd: '<%= iosDevPath %>',
        command: '<%= ccaAddPluginsIosCmd %>'
      },
      addIosrtcHook: {
        cwd: '<%= iosDevPath %>',
        command: '<%= addIosrtcHookCmd %>'
      },
      ccaPrepareIosDev: {
        cwd: '<%= iosDevPath %>',
        command: '<%= ccaJsPath %> prepare'
      },
      ccaPrepareIosDist: {
        cwd: '<%= iosDistPath %>',
        command: '<%= ccaJsPath %> prepare'
      },
      cleanAndroid: {
        command: 'rm -rf <%= androidDevPath %>; rm -rf <%= androidDistPath %>'
      },
      cleanIos: {
        command: 'rm -rf <%= iosDevPath %>; rm -rf <%= iosDistPath %>'
      },
      androidReplaceXwalkDev: {
        command: './replace_xwalk_in_apk.sh debug'
      },
      androidReplaceXwalkDist: {
        command: './replace_xwalk_in_apk.sh release'
      },
      installFreedomForNodeForZork: {
        // This allows our Docker containers, which do not have access to the
        // git repo's "top-level" node_modules/ folder find freedom-for-node.
        command: 'npm install --prefix build/src/lib/samples/zork-node freedom-for-node'
      }
    },
    copy: {
      // Copy releveant non-typescript src files to dev build.
      resources: {
        files: [
          {
            nonull: true,
            expand: true,
            cwd: 'src/',
            src: ['**/*', '!**/*.ts', '!generic_core/dist_build/*', '!generic_core/dev_build/*'],
            dest: devBuildPath,
            onlyIf: 'modified'
          }
        ]
      },
      i18nMessages: {
        files: [{
          nonull: false, expand: true,
          cwd: 'src',
          src: ['generic_ui/locales/**/*.json'],
          dest: devBuildPath
        }]
      },
      devGenericCore: {
        files: [
          {
            nonull: true,
            src: 'src/generic_core/dev_build/freedom-module.json',
            dest: devBuildPath + '/generic_core/freedom-module.json',
            onlyIf: 'modified'
          }
        ]
      },
      // Copy releveant files for distribution.
      dist: {
        files: [
          {  // Chrome extension
            expand: true,
            cwd: chromeExtDevPath,
            src: [
              'manifest.json',
              '_locales/**',
              'generic_ui/scripts/copypaste.js',
              'scripts/context.static.js',
              'scripts/background.static.js'
            ].concat(uiDistFiles, universalDistFiles),
            dest: 'build/dist/chrome/extension'
          },
          {  // Chrome app
            expand: true,
            cwd: chromeAppDevPath,
            src: [
              'manifest.json',
              'managed_policy_schema.json',
              '_locales/**',
              'polymer/vulcanized.{html,js}',
              'freedom-for-chrome/freedom-for-chrome.js'
            ].concat(coreDistFiles, universalDistFiles),
            dest: 'build/dist/chrome/app'
          },
          {  // Chrome app freedom-module
            expand: true,
            cwd: 'src/generic_core/dist_build/',
            src: ['*'],
            dest: 'build/dist/chrome/app/generic_core'
          },
          {  // Firefox
            expand: true,
            cwd: firefoxDevPath,
            src: [
              'package.json',
              // Addon sdk scripts
              'lib/**/*.js',
              'data/scripts/content-proxy.js',
              'data/freedom-for-firefox/freedom-for-firefox.jsm'
            ].concat(
              getWithBasePath(uiDistFiles, 'data'),
              getWithBasePath(coreDistFiles, 'data'),
              getWithBasePath(universalDistFiles, 'data')),
            dest: 'build/dist/firefox'
          },
          {  // Firefox freedom-module
            expand: true,
            cwd: 'src/generic_core/dist_build/',
            src: ['*'],
            dest: 'build/dist/firefox/data/generic_core/'
          },
          {  // CCA app
            expand: true,
            cwd: ccaDevPath,
            src: [
              'manifest.json',
              'config.xml',
              // This is not browserified so we use .js instead of .static.js.
              'polymer/vulcanized.{html,js}',
              'freedom-for-chrome/freedom-for-chrome.js'
            ].concat(uiDistFiles, coreDistFiles, universalDistFiles),
            dest: ccaDistPath
          },
          {  // CCA dist freedom-module.json
            expand: true,
            cwd: 'src/generic_core/cca_dist_build/',
            src: ['*'],
            dest: path.join(ccaDistPath, 'generic_core')
          }
        ]
      },
      cca_splash_dev: {
        files: [
          {
            expand: true,
            cwd: 'src/cca',
            src: ['splashscreen.png'],
            dest: path.join(androidDevPath, 'platforms/android/res/drawable-port-xhdpi')
          }
        ]
      },
      cca_splash_dist: {
        files: [
          {
            expand: true,
            cwd: 'src/cca',
            src: ['splashscreen.png'],
            dest: path.join(androidDistPath, 'platforms/android/res/drawable-port-xhdpi')
          }
        ]
      },     
      integration: {
        files: [{
          // Copy compiled Chrome App code, required for integration tests.
          expand: true,
          cwd: chromeAppDevPath,
          src: ['**', '!**/spec', '!**/*.md', '!**/*.ts'],
          dest: devBuildPath + '/integration'
        }]
      },

      // uproxy-lib sample apps.
      libsForDeployerChromeApp: Rule.copyLibs({
        npmLibNames: ['freedom-for-chrome', 'forge-min'],
        pathsFromDevBuild: ['lib/loggingprovider', 'lib/cloud/deployer', 'lib/cloud/digitalocean', 'lib/cloud/install'],
        localDestPath: 'lib/samples/deployer-chromeapp/'
      }),
      libsForDeployerFirefoxApp: Rule.copyLibs({
        npmLibNames: ['freedom-for-firefox', 'forge-min'],
        pathsFromDevBuild: ['lib/loggingprovider', 'lib/cloud/deployer', 'lib/cloud/digitalocean', 'lib/cloud/install'],
        localDestPath: 'lib/samples/deployer-firefoxapp/data'
      }),

      libsForZorkChromeApp: Rule.copyLibs({
        npmLibNames: ['freedom-for-chrome'],
        pathsFromDevBuild: ['lib/churn-pipe', 'lib/loggingprovider', 'lib/zork'],
        pathsFromThirdPartyBuild: ['freedom-port-control'],
        localDestPath: 'lib/samples/zork-chromeapp/'
      }),
      libsForZorkFirefoxApp: Rule.copyLibs({
        npmLibNames: ['freedom-for-firefox'],
        pathsFromDevBuild: ['lib/churn-pipe', 'lib/loggingprovider', 'lib/zork'],
        pathsFromThirdPartyBuild: ['freedom-port-control'],
        localDestPath: 'lib/samples/zork-firefoxapp/data/'
      }),
      libsForZorkNode: Rule.copyLibs({
        pathsFromDevBuild: ['lib/churn-pipe', 'lib/loggingprovider', 'lib/zork'],
        pathsFromThirdPartyBuild: ['freedom-port-control'],
        localDestPath: 'lib/samples/zork-node/'
      }),

      libsForEchoServerChromeApp: Rule.copyLibs({
        npmLibNames: ['freedom-for-chrome'],
        pathsFromDevBuild: ['lib/echo', 'lib/loggingprovider'],
        localDestPath: 'lib/samples/echo-server-chromeapp/'
      }),
      libsForEchoServerFirefoxApp: Rule.copyLibs({
        npmLibNames: ['freedom-for-firefox'],
        pathsFromDevBuild: ['lib/echo', 'lib/loggingprovider'],
        localDestPath: 'lib/samples/echo-server-firefoxapp/data/'
      }),
      libsForEchoServerNode: Rule.copyLibs({
        npmLibNames: ['freedom-for-node'],
        pathsFromDevBuild: ['lib/echo', 'lib/loggingprovider'],
        localDestPath: 'lib/samples/echo-server-node/'
      }),

      libsForCopypasteChatChromeApp: Rule.copyLibs({
        npmLibNames: ['freedom-for-chrome'],
        pathsFromDevBuild: ['lib/copypaste-chat', 'lib/churn-pipe', 'lib/loggingprovider'],
        pathsFromThirdPartyBuild: ['freedom-port-control'],
        localDestPath: 'lib/samples/copypaste-chat-chromeapp/'
      }),
      libsForCopypasteChatFirefoxApp: Rule.copyLibs({
        npmLibNames: ['freedom-for-firefox'],
        pathsFromDevBuild: ['lib/copypaste-chat', 'lib/churn-pipe', 'lib/loggingprovider'],
        pathsFromThirdPartyBuild: ['freedom-port-control'],
        localDestPath: 'lib/samples/copypaste-chat-firefoxapp/data'
      }),
      libsForCopypasteChatWebApp: Rule.copyLibs({
        npmLibNames: ['freedom'],
        pathsFromDevBuild: ['lib/copypaste-chat', 'lib/churn-pipe', 'lib/loggingprovider'],
        pathsFromThirdPartyBuild: ['freedom-port-control'],
        localDestPath: 'lib/samples/copypaste-chat-webapp/'
      }),

      libsForCopyPasteSocksChromeApp: Rule.copyLibs({
        npmLibNames: ['freedom-for-chrome'],
        pathsFromDevBuild: ['lib/copypaste-socks', 'lib/churn-pipe', 'lib/loggingprovider'],
        pathsFromThirdPartyBuild: ['i18n', 'bower/polymer', 'freedom-pgp-e2e', 'freedom-port-control'],
        localDestPath: 'lib/samples/copypaste-socks-chromeapp/'
      }),
      libsForCopyPasteSocksFirefoxApp: Rule.copyLibs({
        npmLibNames: ['freedom-for-firefox'],
        pathsFromDevBuild: ['lib/copypaste-socks', 'lib/churn-pipe', 'lib/loggingprovider'],
        pathsFromThirdPartyBuild: ['i18n', 'bower', 'freedom-pgp-e2e', 'freedom-port-control'],
        localDestPath: 'lib/samples/copypaste-socks-firefoxapp/data'
      }),

      libsForSimpleSocksChromeApp: Rule.copyLibs({
        npmLibNames: ['freedom-for-chrome'],
        pathsFromDevBuild: ['lib/simple-socks', 'lib/churn-pipe', 'lib/loggingprovider'],
        pathsFromThirdPartyBuild: ['freedom-port-control'],
        localDestPath: 'lib/samples/simple-socks-chromeapp/'
      }),
      libsForSimpleSocksFirefoxApp: Rule.copyLibs({
        npmLibNames: ['freedom-for-firefox'],
        pathsFromDevBuild: ['lib/simple-socks', 'lib/churn-pipe', 'lib/loggingprovider'],
        pathsFromThirdPartyBuild: ['freedom-port-control'],
        localDestPath: 'lib/samples/simple-socks-firefoxapp/data/'
      }),
      libsForSimpleSocksNode: Rule.copyLibs({
        npmLibNames: ['freedom-for-node'],
        pathsFromDevBuild: ['lib/simple-socks', 'lib/churn-pipe', 'lib/loggingprovider'],
        pathsFromThirdPartyBuild: ['uproxy-obfuscators', 'freedom-port-control'],
        localDestPath: 'lib/samples/simple-socks-node/'
      }),

      libsForSimpleChatChromeApp: Rule.copyLibs({
        npmLibNames: ['freedom-for-chrome'],
        pathsFromDevBuild: ['lib/simple-chat', 'lib/churn-pipe', 'lib/loggingprovider'],
        pathsFromThirdPartyBuild: ['freedom-port-control'],
        localDestPath: 'lib/samples/simple-chat-chromeapp/'
      }),
      libsForSimpleChatFirefoxApp: Rule.copyLibs({
        npmLibNames: ['freedom-for-firefox'],
        pathsFromDevBuild: ['lib/simple-chat', 'lib/churn-pipe', 'lib/loggingprovider'],
        pathsFromThirdPartyBuild: ['freedom-port-control'],
        localDestPath: 'lib/samples/simple-chat-firefoxapp/data'
      }),
      // While neither churn-pipe nor freedom-port-control can be used in a
      // regular web page environment, they are included so that obfuscation
      // may be easily enabled in the Chrome and Firefox samples.
      libsForSimpleChatWebApp: Rule.copyLibs({
        npmLibNames: ['freedom'],
        pathsFromDevBuild: ['lib/simple-chat', 'lib/churn-pipe', 'lib/loggingprovider'],
        pathsFromThirdPartyBuild: ['freedom-port-control'],
        localDestPath: 'lib/samples/simple-chat-webapp/'
      }),

      libsForUprobeChromeApp: Rule.copyLibs({
        npmLibNames: ['freedom-for-chrome'],
        pathsFromDevBuild: ['lib/uprobe', 'lib/loggingprovider'],
        localDestPath: 'lib/samples/uprobe-chromeapp/'
      }),
      libsForUprobeFirefoxApp: Rule.copyLibs({
        npmLibNames: ['freedom-for-firefox'],
        pathsFromDevBuild: ['lib/uprobe', 'lib/loggingprovider'],
        localDestPath: 'lib/samples/uprobe-firefoxapp/data/'
      }),

      // uproxy-lib integration tests.
      libsForIntegrationTcp: Rule.copyLibs({
        npmLibNames: ['freedom-for-chrome'],
        pathsFromDevBuild: ['lib/loggingprovider'],
        localDestPath: 'lib/integration-tests/tcp'
      }),
      libsForIntegrationSocksEcho: Rule.copyLibs({
        npmLibNames: ['freedom-for-chrome'],
        pathsFromDevBuild: ['lib/churn-pipe', 'lib/loggingprovider'],
        pathsFromThirdPartyBuild: ['freedom-port-control'],
        localDestPath: 'lib/integration-tests/socks-echo'
      })
    },

    symlink: {
      cca_keys: {
        files: [
          {
            expand: true,
            cwd: 'keys',
            src: [
              'android-release-keys.properties',
              'play_store_keys.p12'
            ],
            dest: androidDistPath
          }
        ]
      }
    },

    //-------------------------------------------------------------------------
    'string-replace': {
      version: {
        files: [{
          src: path.join(devBuildPath, 'generic/version.js'),
          dest: path.join(devBuildPath, 'generic/version.js')
        }],
        options: {
          replacements: [{
            pattern: /\"___VERSION_TEMPLATE___\"/g,
            replacement: JSON.stringify({
              version: '<%= pkg.version %>',
              gitcommit: '<%= gitinfo.local.branch.current.SHA %>',
              freedom: '<%= pkgs.freedom.version %>',
              'freedom-for-chrome': '<%= pkgs.freedomchrome.version %>',
              'freedom-for-firefox': '<%= pkgs.freedomfirefox.version %>',
              'freedom-social-firebase': '<%= pkgs.freedomfirebase.version %>',
              'freedom-social-github': '<%= pkgs.freedomGitHub.version %>',
              'freedom-social-wechat': '<%= pkgs.freedomwechat.version %>',
              'freedom-social-quiver': '<%= pkgs.freedomquiver.version %>'
            })
          }]
        }
      }
    },

    // One pass for code running inside freedom.js modules and another
    // for code running outside, due to the differences in the meaning
    // of the (global) freedom object between the two environments.
    ts: {
      options: {
        target: 'es5',
        comments: true,
        noImplicitAny: true,
        sourceMap: false,
        module: 'commonjs',
        fast: 'always',
        rootDir: '.'
      },
      moduleEnv: {
        src: [
          'src/**/*.ts',
          '!src/**/*.d.ts',
          '!src/lib/build-tools/**/*',
          '!src/integration/**/*',
          '!src/**/*.core-env.ts',
          '!src/**/*.core-env.spec.ts'
        ],
        outDir: 'build'
      },
      coreEnv: {
        src: [
          'src/**/*.core-env.ts',
          'src/**/*.core-env.spec.ts',
          '!src/lib/build-tools/**/*.ts',
          '!src/integration/**/*.ts'
        ],
        outDir: 'build'
      }
    },
    browserify: {
      chromeExtensionCoreConnector: Rule.browserify('chrome/extension/scripts/chrome_core_connector'),
      chromeExtensionCoreConnectorSpec: Rule.browserifySpec('chrome/extension/scripts/chrome_core_connector'),
      genericCoreFirewall: Rule.browserify('generic_core/firewall'),
      genericCoreFreedomModule: Rule.browserify('generic_core/freedom-module'),
      integrationSpec: Rule.browserifySpec('integration/core'),
      integrationFreedomModule: Rule.browserify('integration/test_connection'),
      
      // uproxy-lib
      loggingProvider: Rule.browserify('lib/loggingprovider/freedom-module'),
      churnPipeFreedomModule: Rule.browserify('lib/churn-pipe/freedom-module'),
      cloudInstallerFreedomModule: Rule.browserify('lib/cloud/install/freedom-module'),
      cloudSocialProviderFreedomModule: Rule.browserify('lib/cloud/social/freedom-module'),
      digitalOceanFreedomModule: Rule.browserify('lib/cloud/digitalocean/freedom-module'),
      
      // uproxy-lib sample apps.
      copypasteChatFreedomModule: Rule.browserify('lib/copypaste-chat/freedom-module'),
      copypasteSocksFreedomModule: Rule.browserify('lib/copypaste-socks/freedom-module'),
      deployerFreedomModule: Rule.browserify('lib/cloud/deployer/freedom-module'),
      echoServerFreedomModule: Rule.browserify('lib/echo/freedom-module'),
      simpleChatFreedomModule: Rule.browserify('lib/simple-chat/freedom-module'),
      simpleSocksFreedomModule: Rule.browserify('lib/simple-socks/freedom-module'),
      uprobeFreedomModule: Rule.browserify('lib/uprobe/freedom-module'),
      zorkFreedomModule: Rule.browserify('lib/zork/freedom-module'),
      // uproxy-lib sample apps (with UI).
      copypasteChatMain: Rule.browserify('lib/copypaste-chat/main.core-env'),
      copypasteSocksMain: Rule.browserify('lib/copypaste-socks/main.core-env'),
      simpleChatMain: Rule.browserify('lib/simple-chat/main.core-env'),
      
      integrationTcpFreedomModule: Rule.browserify('lib/integration-tests/tcp/freedom-module'),
      integrationTcpSpec: browserifyIntegrationTest('lib/integration-tests/tcp/tcp.core-env'),
      integrationSocksEchoFreedomModule: Rule.browserify('lib/integration-tests/socks-echo/freedom-module'),
      integrationSocksEchoChurnSpec: browserifyIntegrationTest('lib/integration-tests/socks-echo/churn.core-env'),
      integrationSocksEchoNochurnSpec: browserifyIntegrationTest('lib/integration-tests/socks-echo/nochurn.core-env'),
      integrationSocksEchoSlowSpec: browserifyIntegrationTest('lib/integration-tests/socks-echo/slow.core-env')
    },
    tslint: {
      options: {
        configuration: 'src/tslint.json'
      },
      files: {
        src: ['src/**/*.ts']
      }
    },
    jshint: {
      firefox: {
        options: {
          moz: true
        },
        src: ['src/firefox/lib/*.js']
      }
    },
    watch: {
      resources: {
        files: ['src/**/*', '!src/**/*.ts'],
        tasks: ['copy:resources']
      },
      typescript: {
        files: ['src/**/*.ts'],
        tasks: ['compileTypescript']
      },
      browserify: {
        files: ['build/**/*.js', '!build/**/*.static.js'],
        tasks: ['browserify:chromeAppMainCoreEnv', 'browserify:chromeExtBackground']
      },
      chromeExt: {
        files: ['src/**/*'],
        tasks: ['chromeExtRoot']
      }
    },
    //-------------------------------------------------------------------------
    jasmine: {
      chrome_core_connector: Rule.jasmineSpec('chrome/extension/scripts/chrome_core_connector', [
        path.join('build/src/mocks/chrome_mocks.js')
      ])
    },
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
        scripts: [
          'freedom-for-chrome/freedom-for-chrome.js',
          'core.spec.static.js'
        ],
        options: {
          outdir: 'build/src/integration/'
          // Uncomment this for debugging
          // keepRunner: true,
        }
      },
      tcp: {
        files: [
          {
            cwd: devBuildPath + '/lib/integration-tests/tcp/',
            src: ['**/*', '!jasmine_chromeapp/**/*'],
            dest: './',
            expand: true
          }
        ],
        scripts: [
          'freedom-for-chrome/freedom-for-chrome.js',
          'tcp.core-env.spec.static.js'
        ],
        options: {
          outDir: devBuildPath + '/lib/integration-tests/tcp/jasmine_chromeapp/',
          keepRunner: false
        }
      },
      socksEcho: {
        files: [
          {
            cwd: devBuildPath + '/lib/integration-tests/socks-echo/',
            src: ['**/*', '!jasmine_chromeapp*/**'],
            dest: './',
            expand: true
          }
        ],
        scripts: [
          'freedom-for-chrome/freedom-for-chrome.js', 
          'churn.core-env.spec.static.js', 
          'nochurn.core-env.spec.static.js'
        ],
        options: {
          outDir: devBuildPath + '/lib/integration-tests/socks-echo/jasmine_chromeapp/',
          keepRunner: false
        }
      },
      socksEchoSlow: {
        files: [
          {
            cwd: devBuildPath + '/lib/integration-tests/socks-echo/',
            src: ['**/*', '!jasmine_chromeapp*/**'],
            dest: './',
            expand: true
          }
        ],
        scripts: [
          'freedom-for-chrome/freedom-for-chrome.js', 
          'slow.core-env.spec.static.js'
        ],
        options: {
          outDir: devBuildPath + '/lib/integration-tests/socks-echo/jasmine_chromeapp_slow/',
          keepRunner: true
        }
      }
    },
    'jpm': {
      options: {
        src: 'build/dist/firefox/',
        xpi: 'build/dist/',
        debug: true
      }
    },
    vulcanize: {
      copypasteSocks: {
        options: {
          inline: true,
          csp: true
        },
        files: [
          {
            src: path.join(devBuildPath, 'lib/copypaste-socks/polymer-components/root.html'),
            dest: path.join(devBuildPath, 'lib/copypaste-socks/polymer-components/vulcanized.html')
          }
        ]
      }
    }
  });

  //-------------------------------------------------------------------------
  // Helper functions for different components

  function fullyVulcanize(basePath, srcFilename, destFilename, browserify) {
    browserify = !!browserify;
    let tasks = [];

    // this adds the rule to the task to the grunt object as well as
    // adding the text needed to run it in a rule to the list of rules that will be
    // returned
    function addTask(component, task, rule) {
      grunt.config.set(component + '.' + task, rule);
      return tasks.push(component + ':' + task);
    }

    const realBasePath = path.join(devBuildPath, basePath);
    const srcFile = path.join(realBasePath, srcFilename + '.html');
    const destFile = path.join(realBasePath, destFilename + '.html');
    const taskName = path.join(realBasePath, destFilename);

    // The basic vulcanize tasks, we do both steps in order to get all the
    // javascript into a separate file
    addTask('vulcanize', taskName, {
      options: {
        inline: true,
        csp: destFilename + '.js',
        excludes: { scripts: ['polymer.js'] }
      },
      files: [{ src: srcFile, dest: destFile }]
    });

    if (browserify) {
      // If we need to brewserify the file, there also needs to be a step to replace
      // some of the strings in the vulcanized html file to refer to the static version
      const browserifyPath = path.join(basePath, destFilename);
      addTask('string-replace', taskName + 'Vulcanized', finishVulcanized(realBasePath, destFilename));
      addTask('browserify', browserifyPath, Rule.browserify(browserifyPath, {}));
    }
    return tasks;
  }

  // Returns a task name that will run the input task only once if
  // called multiple times. 
  function makeRunOnce(taskName) {
    return 'run-once:' + taskName;
  }

  // Register a task, making sure subtasks only run once.
  // Description is optional.
  function registerTask(grunt, taskName, description, subTasks) {
    if (!subTasks) {
      subTasks = description;
      return grunt.registerTask(taskName, subTasks.map(makeRunOnce));
    }
    return grunt.registerTask(taskName, description, subTasks.map(makeRunOnce));
  }

  registerTask(grunt, 'default', ['build']);

  // Builds all code, including the "dist" build, but skips
  // iOS and Android as well as
  // ts-linting and testing which can be annoying and slow.
  // We added jshint here because catches hard syntax errors, etc.
  registerTask(grunt, 'build', [
    'build_chrome', 
    'build_firefox', 
    'build_cca', 
    'jshint', 
    'copy:dist', 
    'jpm:xpi'
  ]);

  // This is run prior to releasing uProxy and, in addition to
  // building, tests and lints all code.
  registerTask(grunt, 'dist', [
    'build',
    'test'
  ]);

  registerTask(grunt, 'compileTypescript', 'Compiles all the Typescript code', [
    'copy:i18nMessages', 'ts', 'version_file'
  ]);
  registerTask(grunt, 'version_file', [
    'gitinfo',
    'string-replace:version'
  ]);

  registerTask(grunt, 'base', [
    'copy:resources', 
    'copy:devGenericCore', 
    'compileTypescript', 
    'browserify:genericCoreFreedomModule', 
    'browserify:loggingProvider', 
    'browserify:churnPipeFreedomModule', 
    'browserify:cloudInstallerFreedomModule', 
    'browserify:cloudSocialProviderFreedomModule', 
    'browserify:digitalOceanFreedomModule'
  ]);
  registerTask(grunt, 'echoServer', [
    'base', 
    'browserify:echoServerFreedomModule', 
    'copy:libsForEchoServerChromeApp', 
    'copy:libsForEchoServerFirefoxApp', 
    'copy:libsForEchoServerNode'
  ]);
  registerTask(grunt, 'copypasteChat', [
    'base', 
    'browserify:copypasteChatFreedomModule', 
    'browserify:copypasteChatMain', 
    'copy:libsForCopypasteChatChromeApp', 
    'copy:libsForCopypasteChatFirefoxApp', 
    'copy:libsForCopypasteChatWebApp'
  ]);
  registerTask(grunt, 'copypasteSocks', [
    'base', 
    'browserify:copypasteSocksFreedomModule', 
    'browserify:copypasteSocksMain', 
    'vulcanize:copypasteSocks', 
    'copy:libsForCopyPasteSocksChromeApp', 
    'copy:libsForCopyPasteSocksFirefoxApp'
  ]);
  registerTask(grunt, 'deployer', [
    'base', 
    'browserify:deployerFreedomModule', 
    'copy:libsForDeployerChromeApp', 
    'copy:libsForDeployerFirefoxApp'
  ]);
  registerTask(grunt, 'simpleChat', [
    'base',
    'browserify:simpleChatFreedomModule',
    'browserify:simpleChatMain',
    'copy:libsForSimpleChatChromeApp',
    'copy:libsForSimpleChatFirefoxApp',
    'copy:libsForSimpleChatWebApp'
  ]);
  registerTask(grunt, 'simpleSocks', [
    'base',
    'browserify:simpleSocksFreedomModule',
    'copy:libsForSimpleSocksChromeApp',
    'copy:libsForSimpleSocksFirefoxApp',
    'copy:libsForSimpleSocksNode'
  ]);
  registerTask(grunt, 'uprobe', [
    'base',
    'browserify:uprobeFreedomModule',
    'copy:libsForUprobeChromeApp',
    'copy:libsForUprobeFirefoxApp'
  ]);
  registerTask(grunt, 'zork', [
    'base', 
    'browserify:zorkFreedomModule',
    'copy:libsForZorkChromeApp',
    'copy:libsForZorkFirefoxApp',
    'copy:libsForZorkNode',
    'exec:installFreedomForNodeForZork'
  ]);

  // Chrome
  registerTask(grunt, 'build_chrome', [
    'build_chrome_app',
    'build_chrome_ext'
  ]);

  // =========================================================================
  // Chrome App
  // =========================================================================

  registerTask(grunt, 'build_chrome_app', [
    'base',
    'chromeAppMainCoreEnv',
    'chromeAppExtMissing',
    'copy:chromeApp',
  ]);
  registerTask(grunt, 'chromeAppMainCoreEnv',
      'Builds build/dist/chrome/app/scripts/main.core-env.static.js', [
    'compileTypescript',
    'browserify:chromeAppMainCoreEnv'
  ]);
  registerTask(grunt, 'chromeAppExtMissing',
      'Builds build/src/chrome/app/polymer/vulcanized.{html,js}', [
    'compileTypescript',
    'copy:resources',
    'copy:chromeAppBower',
  ].concat(fullyVulcanize('chrome/app/polymer', 'ext-missing', 'vulcanized')));
  
  grunt.config.merge({
    browserify: {
      chromeAppMainCoreEnv: Rule.browserify('chrome/app/scripts/main.core-env'),
    },
    copy: {
      chromeApp: Rule.copyLibs({
        npmLibNames: ['freedom-for-chrome', 'forge-min'],
        pathsFromDevBuild: [
          'generic_core'
        ].concat(backendFreedomModulePaths),
        pathsFromThirdPartyBuild: backendThirdPartyBuildPaths,
        files: getExtraFilesForCoreBuild(chromeAppDevPath).concat({
          expand: true, cwd: 'src/',
          src: ['icons/128_online.png', 'fonts/*'],
          dest: chromeAppDevPath
        }),
        localDestPath: 'chrome/app/'
      }),
      chromeAppBower: {
        expand: true, cwd: 'third_party',
        src: ['bower/**/*'],
        dest: chromeAppDevPath
      },
    }
  });

  // =========================================================================
  // Chrome Extension
  // =========================================================================

  registerTask(grunt, 'build_chrome_ext', [
    'base',
    'chromeExtBackground',
    'chromeExtContext',
    'chromeExtRoot',
    'copy:chromeExt',
    'copy:chromeExtAdditional',
  ]);
  registerTask(grunt, 'chromeExtBackground', [
    'compileTypescript',
    'browserify:chromeExtBackground'
  ]);
  registerTask(grunt, 'chromeExtContext', 
      'Builds build/src/chrome/extension/scripts/context.static.js', [
    'compileTypescript',
    'browserify:chromeExtContext'    
  ]);
  registerTask(grunt, 'chromeExtRoot',
      'Builds build/src/chrome/extension/generic_ui/polymer/vulcanized.{html,static.js}', [
    'compileTypescript',
    'copy:resources',
    'copy:chromeExt',
    'copy:chromeExtAdditional',
  ].concat(fullyVulcanize('chrome/extension/generic_ui/polymer', 'root', 'vulcanized', true)));
  
  grunt.config.merge({
    browserify: {
      chromeExtBackground: Rule.browserify('chrome/extension/scripts/background', {
        browserifyOptions: {
          standalone: 'ui_context'
        }
      }),
      chromeExtContext: Rule.browserify('chrome/extension/scripts/context', {
        browserifyOptions: {
          standalone: 'ui_context'
        }
      }),
    },
    copy: {
      chromeExt: Rule.copyLibs({
        npmLibNames: [],
        pathsFromDevBuild: ['generic_ui', 'interfaces', 'icons', 'fonts'],
        pathsFromThirdPartyBuild: ['bower'],
        files: [
          {
            expand: true, cwd: devBuildPath, flatten: true,
            src: FILES.uproxy_common,
            dest: chromeExtDevPath + '/generic_ui/scripts'
          }, {
            expand: true, cwd: devBuildPath, flatten: true,
            src: FILES.uproxy_common,
            dest: chromeExtDevPath + '/scripts'
          }, {
            expand: true, cwd: devBuildPath, flatten: true,
            src: FILES.uproxy_common,
            dest: chromeExtDevPath + '/generic'
          }
        ],
        localDestPath: 'chrome/extension'
      }),
      chromeExtAdditional: {
        files: [
          {  // Copy chrome extension panel components from the background
            expand: true,
            cwd: chromeExtDevPath,
            src: ['polymer/*', 'scripts/*', 'icons/*', 'fonts/*', '*.html'],
            dest: chromeExtDevPath + '/generic_ui'
          }
        ]
      }
    },
  });

  // =========================================================================
  // Firefox
  // =========================================================================
  
  registerTask(grunt, 'build_firefox', [
    'base',
    'firefoxContext',
    'firefoxRoot',
    'copy:firefox', 
    'copy:firefox_additional',
  ]);
  registerTask(grunt, 'firefoxContext',
      'Builds build/src/firefox/data/scripts/context.static.js', [
    'compileTypescript',
    'browserify:firefoxContext'    
  ])
  registerTask(grunt, 'firefoxRoot',
      'Builds build/src/firefox/data/generic_ui/polymer/vulcanized.{html,static.js}', [
    'compileTypescript',
    'copy:resources',
    'copy:firefox', 
    'copy:firefox_additional', 
  ].concat(fullyVulcanize('firefox/data/generic_ui/polymer', 'root', 'vulcanized', true)));

  grunt.config.merge({
    browserify: {
      firefoxContext: {
        src: [firefoxDevPath + '/data/scripts/background.js'],
        dest: firefoxDevPath + '/data/scripts/context.static.js',
        options: {
          browserifyOptions: {
            standalone: 'ui_context'
          }
        }
      },
    },
    copy: {
      firefox: Rule.copyLibs({
        npmLibNames: [
          'freedom-for-firefox',
          'forge-min'
        ],
        pathsFromDevBuild: [
          'generic_core',
          'generic_ui',
          'interfaces',
          'icons',
          'fonts'
        ].concat(backendFreedomModulePaths),
        pathsFromThirdPartyBuild: backendThirdPartyBuildPaths,
        files: getExtraFilesForCoreBuild(path.join(firefoxDevPath, 'data')).concat({
          expand: true,
          cwd: devBuildPath,
          src: ['interfaces/*.js'],
          dest: firefoxDevPath + '/lib'
        }),
        localDestPath: 'firefox/data'
      }),
      firefox_additional: {
        files: [
          {  // Copy chrome extension panel components from the background.
            expand: true,
            cwd: firefoxDevPath + '/data',
            src: ['polymer/*', 'scripts/*', 'icons/*', 'fonts/*'],
            dest: firefoxDevPath + '/data/generic_ui'
          },
          {  // Copy generic files used by core and UI.
            expand: true,
            cwd: genericPath,
            src: ['*.js'],
            dest: firefoxDevPath + '/data/generic'
          }
        ]
      },
    },
  });

  // =========================================================================
  // CCA
  // =========================================================================

  registerTask(grunt, 'build_cca', [
    'base',
    'ccaMainCoreEnv',
    'ccaContext',
    'ccaRoot',
    'copy:cca',
    'copy:ccaAdditional',
  ]);
  registerTask(grunt, 'ccaMainCoreEnv',
      'Builds build/src/cca/app/scripts/main.core-env.static.js', [
    'compileTypescript',
    'browserify:ccaMainCoreEnv'
  ]);
  registerTask(grunt, 'ccaContext',
      'Builds build/src/cca/app/scripts/context.static.js', [
    'compileTypescript',
    'browserify:ccaContext'    
  ]);
  registerTask(grunt, 'ccaRoot',
      'Builds build/src/cca/app/generic_ui/polymer/vulcanized.{html,static.js}', [
    'compileTypescript',
    'copy:resources',
    'copy:cca',
    'copy:ccaAdditional',
  ].concat(fullyVulcanize('cca/app/generic_ui/polymer', 'root', 'vulcanized', true)));

  grunt.config.merge({
    browserify: {
     ccaMainCoreEnv: Rule.browserify('cca/app/scripts/main.core-env', {
        browserifyOptions: {
          standalone: 'ui_context'
        }
      }),
      ccaContext: Rule.browserify('cca/app/scripts/context', {
        browserifyOptions: {
          standalone: 'ui_context'
        }
      }),
    },
    copy: {
      cca: Rule.copyLibs({
        npmLibNames: ['freedom-for-chrome', 'forge-min'],
        pathsFromDevBuild: [
          'generic_core',
          'generic_ui',
          'interfaces',
          'icons',
          'fonts'
        ].concat(backendFreedomModulePaths),
        pathsFromThirdPartyBuild: backendThirdPartyBuildPaths,
        files: getExtraFilesForCoreBuild(ccaDevPath).concat({
          expand: true,
          cwd: 'src/',
          src: ['icons/128_online.png', 'fonts/*'],
          dest: ccaDevPath
        }),
        localDestPath: 'cca/app/'
      }),
      ccaAdditional: {
        files: [
          {  // Copy chrome extension panel components from the background
            expand: true,
            cwd: ccaDevPath,
            src: ['polymer/*', 'scripts/*', 'icons/*', 'fonts/*', '*.html'],
            dest: ccaDevPath + '/generic_ui'
          },
          {  // Copy generic files used by core and UI.
            expand: true,
            cwd: genericPath,
            src: ['*.js'],
            dest: ccaDevPath + '/generic'
          }
        ]
      },
    },
  });

  // =========================================================================
  // Android
  // =========================================================================

  registerTask(grunt, 'build_android', [
    // Builds Android from scratch by recreating the Cordova environment.
    'exec:cleanAndroid',
    'build_cca',
    'exec:ccaCreateDev',
    'exec:ccaPlatformAndroidDev',
    'exec:ccaAddPluginsAndroidDev',
    'copy:cca_splash_dev',
    'build_android_lite'
  ]);
  registerTask(grunt, 'build_android_lite', [
    // Android build task that does not recreate the Cordova environment.
    // Should only be used for building CCA modules and after running
    // build_android, without cleaning, initially at least once.
    'build_cca',
    'exec:ccaBuildAndroid',
    'exec:androidReplaceXwalkDev'
  ]);
  registerTask(grunt, 'release_android', [
    'build_cca', 
    'copy:dist', 
    'exec:ccaCreateDist', 
    'exec:ccaPlatformAndroidDist', 
    'exec:ccaAddPluginsAndroidDist', 
    'copy:cca_splash_dist', 
    'symlink:cca_keys', 
    'exec:ccaReleaseAndroid', 
    'exec:androidReplaceXwalkDist'
  ]);

  // Emulate the mobile client for android
  registerTask(grunt, 'emulate_android', [
    'build_android', 
    'exec:ccaEmulateAndroid'
  ]);

  // =========================================================================
  // iOS
  // =========================================================================
  
  registerTask(grunt, 'build_ios', [
    'exec:cleanIos', 
    'build_cca', 
    'exec:ccaCreateIosDev', 
    'exec:ccaAddPluginsIosBuild',
    'exec:addIosrtcHook',
    'exec:ccaPrepareIosDev'
  ]);

  // =========================================================================
  // Tests
  // =========================================================================

  registerTask(grunt, 'test_chrome', [
    'build_chrome',
    'browserify:chromeExtensionCoreConnectorSpec',
    'jasmine:chrome_core_connector'
  ]);
  registerTask(grunt, 'tcpIntegrationTestModule', [
    'base',
    'copy:libsForIntegrationTcp',
    'browserify:integrationTcpFreedomModule',
    'browserify:integrationTcpSpec'
  ]);
  registerTask(grunt, 'tcpIntegrationTest', [
    'tcpIntegrationTestModule',
    'jasmine_chromeapp:tcp'
  ]);
  registerTask(grunt, 'socksEchoIntegrationTestModule', [
    'base',
    'copy:libsForIntegrationSocksEcho',
    'browserify:integrationSocksEchoFreedomModule', 
    'browserify:integrationSocksEchoChurnSpec', 
    'browserify:integrationSocksEchoNochurnSpec', 
    'browserify:integrationSocksEchoSlowSpec'
  ]);
  registerTask(grunt, 'socksEchoIntegrationTest', [
    'socksEchoIntegrationTestModule', 
    'jasmine_chromeapp:socksEcho'
  ]);
  registerTask(grunt, 'unit_test_nobuild', _.flatten([].concat(
    Rule.getTests('src', 'lib', ['build-tools', 'integration-tests']),
    Rule.getTests('src', 'generic_core'),
    Rule.getTests('src', 'generic_ui/scripts')
  ).map((test) => {
      return Rule.buildAndRunTest(test, grunt);
    })
  ));

  registerTask(grunt, 'unit_test', [
    'base',
    'unit_test_nobuild'
  ]);
  // TODO: add test_chrome once it passes reliably
  registerTask(grunt, 'integration_test', [
    'tcpIntegrationTest',
    'socksEchoIntegrationTest'
  ]);
  registerTask(grunt, 'test', [
    'lint',
    'unit_test',
    'integration_test'
  ]);
  registerTask(grunt, 'lint', ['jshint', 'tslint']);

  //-------------------------------------------------------------------------
  grunt.loadNpmTasks('grunt-browserify');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-jasmine');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-symlink');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-exec');
  grunt.loadNpmTasks('grunt-gitinfo');
  grunt.loadNpmTasks('grunt-jasmine-chromeapp');
  grunt.loadNpmTasks('grunt-jpm');
  grunt.loadNpmTasks('grunt-run-once');
  grunt.loadNpmTasks('grunt-string-replace');
  grunt.loadNpmTasks('grunt-ts');
  grunt.loadNpmTasks('grunt-tslint');
  grunt.loadNpmTasks('grunt-vulcanize');
};
