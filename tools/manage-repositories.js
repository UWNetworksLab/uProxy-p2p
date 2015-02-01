#!/usr/bin/env nodejs

var child_process = require('child_process');
var fs = require('fs');
var Promise = require('es6-promise').Promise;


console.log('Setup uproxy-related repos script...\n '+
  ' * to test your github credentials: `ssh -T git@github.com` \n ' +
  ' * to list your ssh agents: `ssh-add -l` \n ');

// TODO: not currently used, but a placeholder for how to get args (not
// including this command)
var args = [];
process.argv.slice(2).forEach(function (a) {
  args.push(a);
});

var repositories = [
  {repo: 'git@github.com:uProxy/uProxy.git', dir: 'uproxy' },
  {repo: 'git@github.com:uProxy/uproxy-networking.git', dir: 'uproxy-networking' },
  {repo: 'git@github.com:uProxy/uproxy-lib.git', dir: 'uproxy-lib' },
  {repo: 'git@github.com:uProxy/uproxy-probe.git', dir: 'uproxy-probe' },
  {repo: 'git@github.com:uProxy/uproxy-website.git', dir: 'uproxy-website' },
  {repo: 'git@github.com:uProxy/uproxy-obfuscators.git', dir: 'uproxy-obfuscators' },
  {repo: 'git@github.com:uProxy/uproxy-sas-rtc.git', dir: 'uproxy-sas-rtc' },
  {repo: 'git@github.com:uProxy/uproxy-benchmark.git', dir: 'uproxy-benchmark' },
  {repo: 'git@github.com:uProxy/uproxy-docker.git', dir: 'uproxy-docker' },
  {repo: 'git@github.com:freedomjs/freedom.git', dir: 'freedom' },
  {repo: 'git@github.com:freedomjs/freedom-typescript-api.git', dir: 'freedom-typescript-api' },
  {repo: 'git@github.com:freedomjs/freedom-for-chrome.git', dir: 'freedom-for-chrome' },
  {repo: 'git@github.com:freedomjs/freedom-for-firefox.git', dir: 'freedom-for-firefox' },
  {repo: 'git@github.com:freedomjs/freedom-for-node.git', dir: 'freedom-for-node' },
  {repo: 'git@github.com:freedomjs/freedom-social-xmpp.git', dir: 'freedom-social-xmpp' },
  {repo: 'git@github.com:willscott/grunt-jasmine-chromeapp.git', dir: 'grunt-jasmine-chromeapp' },
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
      console.log('+ Running: ' + cmd + '\n');
      promises.push(new Promise(function (F,R) {
        child_process.exec(cmd, {},
          function (error, stdout, stderr) {
            if(stdout) { console.log('  stdout: ' + stdout); }
            if(stderr) { console.log('  stderr: ' + stderr); }
            if (error !== null) {
              console.log('exec error: ' + error);
              R(error);
            } else {
              F();
            }
          });
      }));
    } else {  // Directory for repo already exists
      console.log('- Skipping: ' + cmd + '\n');
    }
  });
  return Promise.all(promises).then(function () {
    running = false;
    console.log('* Suucessfully ran sub-commands.');
  }).catch(function (e) {
    console.log('* Error: ', e);
  });
}

cloneAll(repositories);
