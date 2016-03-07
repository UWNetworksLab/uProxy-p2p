# uProxy

[uProxy](https://www.uproxy.org) is a browser extension that lets users share their internet connection.

## Status

[![Slack Status](https://uproxy-slack.herokuapp.com/badge.svg)](https://uproxy-slack.herokuapp.com/)
[![Travis Status](https://travis-ci.org/uProxy/uproxy.svg?branch=dev)](https://travis-ci.org/uProxy/uproxy)
[![Shippable Status](https://img.shields.io/shippable/54c823bf5ab6cc135289fbdc/dev.svg)](https://app.shippable.com/projects/54c823bf5ab6cc135289fbdc/builds/latest)

## Tools

uProxy is built using the following tools:
 - [Grunt](http://gruntjs.com/) to write the tasks that build uProxy
 - [TypeScript](http://www.typescriptlang.org/) as the primary language we code in; this compiles to JavaScript. It gives us type-checking and has some syntax improvements on JS, while letting us incrementally migrate and easily include external JS packages and frameworks.
 - [Jasmine](http://pivotal.github.io/jasmine/) for testing
 - [Polymer](http://www.polymer-project.org/) for UI
 - [Travis](https://travis-ci.org/) for continuous integration
 - [Shippable](https://app.shippable.com/) for docker-integrated continuous integration

To manage dependencies we use:
 - [npm](https://www.npmjs.org/) to install node modules that we use for our build process.  (Specified in `package.json`)
 - [Bower](http://bower.io) to install libraries that we use in the UI
   (specified in `bower.json`) including Polymer.


## Development setup

Please read the [uProxy Coding Guide](https://docs.google.com/document/d/12RfgwSLnEm-X5Knj1xFVGpp-MH7BdWjuzzo_g7xabro/edit) to learn more about contributing to uProxy. For a high level technical overview of uProxy, see the [uProxy Design Doc](https://docs.google.com/document/d/1t_30vX7RcrEGuWwcg0Jub-HiNI0Ko3kBOyqXgrQN3Kw/edit#).

### Prerequisites to build uProxy

Note: you will either need to run these as root, or set the directories they
modify (`/usr/local`) to being editable by your user (`sudo chown -R $USER /usr/local`)

- [git](https://git-scm.com/)
    - Most machines will have git pre-installed. If you need to install git, you can find instructions from the [git website](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git).
    - For Windows, install the [desktop git app](https://desktop.github.com/), which provides an easy-to-use interface for git.

- [node](http://nodejs.org/) and npm (Node's package manager):

    - On **Mac** with Brew, you can do: `brew install node` (You may need to update your brew package manager, e.g. `brew update`). You can also install directly from a Mac package off the [NodeJS Website](http://nodejs.org/).
        - If you do not have [Homebrew](http://brew.sh), you can install it by running `ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"`

    - On **Ubuntu**, you can do `apt-get install nodejs`.
    - You may need to create a symlink (if we are not running legacy node) <br>
      Use this: <br>
      ln -s /usr/bin/nodejs /usr/bin/node

    - On **Archlinux**, you can do 'pacman -S nodejs'.

    - On **Windows**, you can download the installer from the [NodeJS Website](http://nodejs.org/).

    - You may need to set your `$NODE_PATH` environment variable appropriately
      (e.g. it might be: `/usr/local/share/npm/lib/node_modules`).

    - To run binaries from globally-installed npm packages without
      fully-qualifying paths, make sure you have added your npm bin directory to your path
        - on Mac or Ubuntu, e.g. `export PATH=$PATH:/usr/local/share/npm/bin/grunt`
        - on Windows,
            - Open Control Panel > System and Security > System > Advanced System Settings
            - In the Advanced tab, click on "Environment Variables"
            - In System Variables, click on "Path" (or "PATH")
            - At the end of the "Variable value:" string, append a ";" and the path to your bin directory, e.g. "C:\Program Files\nodejs\node_modules\npm\lib;C:\Users\<YOUR_PATH>\AppData\Roaming\npm\node_modules\grunt-cli\bin"

- [Grunt](http://gruntjs.com/): Install globally with `npm install -g grunt-cli`
    - To install globally on Windows, open the command prompt as admin and then run the command

### Building uProxy from source

 1. In your terminal, navigate to a directory where you would like to download uProxy. E.g., `cd ~/uProxy`

 1. Clone the uProxy repository: `git clone https://github.com/uProxy/uProxy.git` or `git clone git@github.com:uProxy/uproxy.git` if you have your ssh access to GitHub set up (useful if you use 2-step auth for GitHub, which you should do).

 1. Navigate into uProxy's root directory with `cd uproxy`

 1. Setup build tools and third-party dependencies:
   * In OS X or Linux, run `./setup.sh install`
   * In Windows, run `.\setup.cmd install` instead (in cmd or PowerShell).
 1. Run `grunt` - this will build everything, including uProxy for Chrome and Firefox.

Note that if any local dependencies have changed (i.e. changes to bower dependencies, updates to FreeDOM), you will have to run `./setup.sh install` to update these dependencies, then rerun `grunt`

### Installing and running

#### Chrome

These are the steps to try uProxy in the Chrome browser.

- In Chrome, go to `chrome://extensions`, make sure 'Developer mode' is enabled
- Click 'Load unpacked extension...' and select `build/dev/uproxy/chrome/app`
- Click 'Load unpacked extension...' and select `build/dev/uproxy/chrome/extension`

You need both the uProxy Chrome App and the uProxy Extension.

You can use `grunt build_chrome` from the root directory of the repository to re-compile just Chrome components.

#### Firefox

These are the steps to try uProxy in the Firefox browser.

- To run the add-on you need to have the Firefox add-on SDK installed.
Instructions can be found here: https://developer.mozilla.org/en-US/Add-ons/SDK/Tutorials/Installation
    - A quick way to get started is to download/extract the zip mentioned in "Prerequisites"

- Run `cd build/dev/uproxy/firefox`

- Run `cfx run` and Firefox should launch with the uProxy add-on installed

You can use `grunt build_firefox` from the root directory of the repository to compile just Firefox comonents.

### Development and re-building uProxy

uProxy uses the Grunt build system for its build tasks. Here is a list
of uProxy's Grunt commands:

 *  `build` - Builds everything, making stuff in the `build` directory (and runs tests).
   *  `build_chrome` - Build Chrome app and extension
     *  `build_chrome_app` - Build just Chrome app
     *  `build_chrome_ext` - Build just Chrome extension
   *  `build_firefox` - Build just Firefox
 *  `dist` - Generates distribution files, including the Firefox xpi
 *  `clean` - Cleans up
 *  `test` - Run unit tests
 *  `integration_test` - Run integration tests
 *  `everything` - 'build', 'test' and then 'integration_test'

The easiest way to stay current is to pull changes, run `grunt build` to build
your distribution, and re-run as you make changes to the files.

Before submitting any changes to the repository, make sure to run `grunt test`
to make sure it passes all unit tests. Failing tests are enough to immediately
reject submissions. :)

### uProxy for Android

uProxy can now be built as an Android App, using the Cordova Chrome Apps (CCA)
tool, also known as the [Chrome Apps for Mobile Toolchain](https://github.com/MobileChromeApps/mobile-chrome-apps).
After following the steps under "Building uProxy from source",
 1. Install the Android SDK.  The easiest way to get it is as part of [Android Studio](https://developer.android.com/sdk/index.html).
   * *Linux-only* Add the Android tools to your path, e.g. by modifying your `.bashrc` to include `PATH=$PATH:$HOME/android-studio/tools`.
 1. Install the `adb` tool.
   * MacOS: `adb` is included with Android Studio.
   * Linux: `adb` is available through your package manager.  For example, on Ubuntu run `apt-get install android-tools-adb`.
 1. Confirm that your `cca` package is ready by running `node_modules/.bin/cca checkenv` from the git checkout root directory.
   * If this fails, set the `ANDROID_HOME` variable to the Android SDK path in your `.bashrc`, e.g. `export ANDROID_HOME=$HOME/Android/Sdk`

Then you can build the app using `grunt build_android`.  The output, a file ending
in `.apk`, will appear in `build/dev/uproxy/android/platforms/android/build/outputs/apk/`.
Depending on the build configuration, the file might be named `android-debug.apk`,
`android-armv7-debug.apk`, etc..

#### Installing on an Android device
* To install the app, first [Enable USB Debugging](http://developer.android.com/tools/device.html#device-developer-options)
on your test phone, then connect it to your computer and accept the connection
on the phone.
* Then, on your computer, install the app on the phone using a command like
`adb install -r build/dev/uproxy/android/platforms/android/build/outputs/apk/android-debug.apk`.
* You may then launch the app from the phone. Rerunning this command should close the app
and replace it with a new version, but will not overwrite saved state on the device.

If you encounter an error or want to complete delete uProxy from your phone, you can do so via
`Settings -> Apps -> uProxy`, which as a button labeled "Uninstall for all users".

#### Installing on an Android emulator
* Create a virtual device using the [Android Virtual Device
Manager](http://developer.android.com/tools/devices/index.html) with an API of 21
(Lollipop) or higher.
* Launch the emulator and check `adb devices` at the command line to
make sure an emulator is running. 
* Install the app from the command line with `adb install -r build/dev/uproxy/android/platforms/android/build/outputs/apk/android-debug.apk`. You should see `success` if the app is installed.
* You may then launch the app from the emulator.

#### Creating a Play Store release build
Android app release builds must be signed.  To create a release build:
 1. Get the appropriate `play_store_keys.p12` and `android-release-keys.properties` files, and symlink them into a `keys` directory in the git repo root.
   * The uProxy team's release keys are stored in a secure location, not in the public git repository.  Symlinking ensures that you do not accidentally copy the keys into insecure storage.
 1. Run `grunt release_android`
 1. From the `build/dev/uproxy/android/platforms/android/build/outputs/apk/` directory, upload `android-release.apk`, `android-x86-release.apk`, and `android-armv7-release.apk` to the Play Store using [the multiple APK upload procedure](http://developer.android.com/google/play/publishing/multiple-apks.html).
   * This allows us to have a smaller build (~10 MB) for modern Android, and a larger build (~33 MB) for older Android versions that need [Crosswalk](https://crosswalk-project.org/) because the system webview is too old to run uProxy.

### uProxy for iOS
uProxy can be built on iOS by using CCA, similarly to uProxy on Android. You can only run uProxy for iOS on an OS X operating system with Xcode and the iOS SDK installed. 

* Install Xcode (6.0 or higher) if it's not already installed (https://developer.apple.com/xcode/download/)
* Once Xcode is installed, several command-line tools need to be enabled for CCA to run. From the Xcode menu, select Preferences, then the Downloads tab. From the Components panel, press the Install button next to the Command Line Tools listing.
* `npm install -g ios-sim`
* `npm install -g ios-deploy`

Note: In order for uProxy to work on a device right now, crypto must be disabled for both the getter and the sharer. You need to use this version of uProxy for both the iOS instance and the other instance you're connecting to.

#### Running on an iOS emulator
* `grunt emulate_ios`
  * uProxy should run in an emulator even if you see a grunt warning that exec:ccaEmulateIos failed.

#### Running on an iOS device
* Attach a device to your Mac 
* `grunt build_ios`
* `cd build/dev/uproxy/ios/`
* `cca run ios --device`

#### Open uProxy in Xcode
* `grunt build_ios`
* `open build/dev/uproxy/ios/platforms/ios/uProxy.xcodeproj/`
* When prompted with the question "Convert to Latest Swift Syntax?" choose "Cancel"

  Because we use cordova-plugin-iosrtc to implement the WebRTC protocol, there are a few Build Settings you need to update when running uProxy from Xcode:
* Within the project Build Settings set "Enable Bitcode" to "No"
* Within the project Build Settings set "Objective-C Bridging Header" to "uProxy/Plugins/cordova-plugin-iosrtc/cordova-plugin-iosrtc-Bridging-Header.h"
* Within the project Build Settings add an entry to the "Runpath Search Paths" setting with value "@executable_path/Frameworks"
* Now you can edit uProxy code and run it from either an emulator or device

### Fixing compilation and setup

- If something is going wrong during the build process, please try running `grunt
clean`, `./setup.sh clean`, and re-running `./setup.sh install`

- If things are not working, check that you have recent versions of bower, npm, and node.


## Layout of files

Configuration and setup files
 * `Gruntfile.js` a file that specifies common tasks, e.g. how to build and package uProxy.
 * `bower.json` specifies dependent libraries from Bower.
 * `package.json` specifies dependent libraries from NPM.
 * `.gitignore` what git should ignore
 * `.bowerrc` tells bower where to put files
 * `.travis.yml` Travis auto-testing
 * `tools` directory contains some typescript and javascript to help Grunt.
 * `third_party/tsd.json` specifies the typescript definitions to use

Source code
 * `src` holds all source code; no compiled files
 * `src/generic_ui` generic user interface code
 * `src/generic_core` generic uproxy core-functionality code
 * `src/chrome/app` code specific to the chrome app
 * `src/chrome/extension` code specific to the chrome extension
 * `src/firefox` code specific to firefox
 * `third_party` holds external libraries we depend on that are copied into this repository
 * `node_modules` dynamically generated npm module dependencies
 * `scraps` temporary holding for sharing scraps of code

Dynamically created directories (`grunt clean` should remove them)
 * `build` created by grunt tasks; holds the built code, but none of the code that was compiled.
 * `build/dist` created by grunt tasks; holds final distribution versions
 * `.grunt` holds grunt cache stuff
 * `.tscache` holds typescript cache stuff
