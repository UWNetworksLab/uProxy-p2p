/// <reference path='../../../third_party/typings/node/node.d.ts' />

// Platform independnet way to run the Chrome binary using node.
//
// Example usage with node:
//   var chrome_runner = require('./build/tools/chrome-runner');
//   var c1 = chrome_runner.runChrome(
//     {path: '/Applications/Google\ Chrome\ Canary.app/Contents/MacOS/Google\ Chrome\ Canary',
//      args:['--user-data-dir=tmp/foo'],
//      processOptions:{stdio: 'inherit'}});

import path = require('path');
import childProcess = require('child_process');
import fs = require('fs');

// Utility function to give list of operating system paths that may contain the
// chrome binary.
export function osChromePaths() :string[] {
  if (/^win/.test(process.platform)) {
    // Windows
    var windowsHomeChromePath =
      path.join(process.env['HOMEPATH'],
        'Local Settings\\Application Data\\Google\\Chrome\\Application\\chrome.exe');
    var windowsUserProfileChromePath =
      path.join(process.env['USERPROFILE'],
        '\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe');
    return [windowsHomeChromePath, windowsUserProfileChromePath];
  } else if (process.platform === "darwin") {
    // Mac
    var macSystemChromePath = '/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome';
    var macUserChromePath = path.join(process.env['HOME'], macSystemChromePath);
    return [macUserChromePath, macSystemChromePath];
  } else {
    // Some variant of linux.
    var linuxSystemChromePath = '/usr/bin/google-chrome'
    return [linuxSystemChromePath];
  }
}

// Utility function to pick the first path in the list that exists in the
// filesystem.
function pickFirstExistingPath(paths:string[]) : string {
  for(var i = 0; i < paths.length; ++i) {
    if (fs.existsSync(paths[i])) return paths[i];
  };
  return null;
}

export interface NodeChildProcessOptions
  { cwd?: string; stdio?: any; custom?: any; env?: any; detached?: boolean; };

// Run the chrome binary.
export function runChrome(
    config:{ path?:string;
             args?:string[];
             processOptions?:NodeChildProcessOptions;
    } = {}) : { chosenChromePath :string;
                childProcess :childProcess.ChildProcess } {
  var chromePaths :string[] = config.path ? [config.path] : osChromePaths();
  var chosenChromePath :string = pickFirstExistingPath(chromePaths);

  if (!chosenChromePath) {
    throw new Error('Cannot find Chrome binary in: ' + chromePaths.toString());
  }
  return {
    chosenChromePath: chosenChromePath,
    childProcess :childProcess.spawn(chosenChromePath, config.args,
                                     config.processOptions),
  };
}
