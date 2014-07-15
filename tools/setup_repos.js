#!/usr/bin/env nodejs

var child_process = require('child_process');
var fs = require('fs');
var Promise = require('es6-promise').Promise;


console.log('Setup repos script...\n '+
  ' * to test: `ssh -T git@github.com` \n ' +
  ' * to list your ssh agents: `ssh-add -l` \n ');

var args = [];
process.argv.slice(2).forEach(function (a) {
  args.push(a);
});

var repoNames = [
  'uProxy',
  'socks-rtc',
  'sas-rtc',
  'uTransformers',
  'uproxy-lib',
  'libfte',
  'uProbe',
  'turn-relay',
  'uproxy-website',
];

var running = true;

function checkSshAgent() {
  var cmd = 'ssh -T git@github.com';
  // TODO complete this.
  return Promise.reject('Not yet implemented.')
}

function cloneAll() {
  var promises = [];
  var cmd = '';
  repoNames.forEach(function (n) {
    if(!fs.existsSync(n)) {
      cmd = 'git clone git@github.com:uProxy/' + n + '.git';
      console.log('executing: ' + cmd);
      promises.push(new Promise(function (F,R) {
        child_process.exec(cmd, {},
          function (error, stdout, stderr) {
            console.log('stdout: ' + stdout);
            console.log('stderr: ' + stderr);
            if (error !== null) {
              console.log('exec error: ' + error);
              R(error);
            } else {
              F();
            }
          });
      }));
    }  // if
  });
  return Promise.all(promises).then(function () {
    running = false;
    console.log('All sub-command promises complete.');
  });
}

cloneAll();
