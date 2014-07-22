#!/usr/bin/env nodejs

var child_process = require('child_process');
var fs = require('fs');
var Promise = require('es6-promise').Promise;


console.log('Setup repos script...\n '+
  ' * to test: `ssh -T git@github.com` \n ' +
  ' * to list your ssh agents: `ssh-add -l` \n ');

// TODO: not currently used, but a placeholder for how to get args (not
// including this command)
var args = [];
process.argv.slice(2).forEach(function (a) {
  args.push(a);
});

var repositories = [
  {repo: 'git@github.com:uProxy/uProxy.git', dir: 'uproxy' },
  {repo: 'git@github.com:uProxy/socks-rtc.git', dir: 'uproxy-networking' },
  {repo: 'git@github.com:uProxy/sas-rtc.git', dir: 'uproxy-sas-rtc' },
  {repo: 'git@github.com:uProxy/uTransformers.git', dir: 'uproxy-uTransformers' },
  {repo: 'git@github.com:uProxy/uproxy-lib.git', dir: 'uproxy-lib' },
  {repo: 'git@github.com:uProxy/libfte.git', dir: 'libfte' },
  {repo: 'git@github.com:uProxy/uProbe.git', dir: 'uproxy-logging' },
  {repo: 'git@github.com:uProxy/turn-relay.git', dir: 'uproxy-churn' },
  {repo: 'git@github.com:uProxy/uproxy-website.git', dir: 'uproxy-website' },
  {repo: 'git@github.com:freedomjs/freedom.git', dir: 'freedom' },
  {repo: 'git@github.com:freedomjs/freedom-typescript-api.git', dir: 'freedom-typescript-api' },
  {repo: 'git@github.com:freedomjs/freedom-for-chrome.git', dir: 'freedom-for-chrome' },
  {repo: 'git@github.com:freedomjs/freedom-for-firefox.git', dir: 'fredom-for-firefox' },
  {repo: 'git@github.com:freedomjs/freedom-for-node.git', dir: 'freedom-for-node' },
  {repo: 'git@github.com:freedomjs/freedom-social-xmpp.git', dir: 'freedom-social-xmpp' },
];

var running = true;

function checkSshAgent() {
  var cmd = 'ssh -T git@github.com';
  // TODO complete this.
  return Promise.reject('Not yet implemented.')
}

function cloneAll(repos) {
  var promises = [];
  var cmd = '';
  repos.forEach(function (r) {
    if(!fs.existsSync(r.dir)) {
      cmd = 'git clone ' + r.repo + ' ' + r.dir;
      console.log('executing: ' + cmd);
      promises.push(new Promise(function (F,R) {
        child_process.exec(cmd, {},
          function (error, stdout, stderr) {
            if(stdout) { console.log('stdout: ' + stdout); }
            if(stderr) { console.log('stderr: ' + stderr); }
            if (error !== null) {
              console.log('exec error: ' + error);
              R(error);
            } else {
              F();
            }
          });
      }));
    }  // if repo didn't exist
  });
  return Promise.all(promises).then(function () {
    running = false;
    console.log('All sub-command promises complete.');
  });
}

cloneAll(repositories);
