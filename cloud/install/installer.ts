/// <reference path='../../../../third_party/typings/es6-promise/es6-promise.d.ts' />
/// <reference path='../../../../third_party/typings/freedom/freedom-module-env.d.ts' />
/// <reference path='../../../../third_party/typings/node/node.d.ts' />
/// <reference path='../../../../third_party/typings/ssh2/ssh2.d.ts' />

import logging = require('../../logging/logging');

// https://github.com/borisyankov/DefinitelyTyped/blob/master/ssh2/ssh2-tests.ts
import * as ssh2 from 'ssh2';
var Client = require('ssh2').Client;

var log: logging.Log = new logging.Log('cloud installer');

// Command to install uProxy.
const INSTALL_COMMAND = 'curl -sSL https://raw.githubusercontent.com/uProxy/uproxy-docker/master/install-cloud.sh | sh';

// Prefix for invitation URLs.
const INVITATION_URL_PREFIX = 'https://www.uproxy.org/invite/';

// Installs uProxy on a server, via SSH.
// The process is as close as possible to a manual install
// so that we have fewer paths to test.
class CloudInstaller {
  constructor(private dispatchEvent_: (name: string, args: Object) => void) {}

  // Runs the install command via SSH, resolving with the invitation URL.
  public install = (
      host:string,
      port:number,
      username:string,
      key:string) : Promise<string> => {
    log.debug('installing uproxy on %1:%2 as %3', host, port, username);

    const connectConfig: ssh2.ConnectConfig = {
      host: host,
      port: port,
      username: username,
      privateKey: key,
      // Remaining fields only for type-correctness.
      tryKeyboard: false,
      debug: undefined
    };

    const connection = new Client();
    return new Promise<string>((F, R) => {
      connection.on('ready', () => {
        log.debug('logged into server');
        connection.exec(INSTALL_COMMAND, (e: Error, stream: ssh2.Channel) => {
          if (e) {
            connection.end();
            R({
              message: 'could not execute command: ' + e.message
            });
            return;
          }
          stream.on('end', () => {
            connection.end();
            R({
              message: 'invitation URL not found'
            });
          }).on('data', function(data: Buffer) {
            const output = data.toString();
            log.debug('STDOUT: %1', output);
            // Search for the URL anywhere in the line so we will
            // continue to work in the face of minor changes
            // to the install script.
            if (output.indexOf(INVITATION_URL_PREFIX) === 0) {
              F(output.substring(INVITATION_URL_PREFIX.length));
            }
          }).stderr.on('data', function(data: Buffer) {
            log.error(data.toString());
          });
        });
      }).on('error', (e: Error) => {
        // This occurs when:
        //  - user supplies the wrong username or password
        //  - host cannot be reached, e.g. non-existant hostname
        R({
          message: 'could not login: ' + e.message
        });
      }).on('end', () => {
        log.debug('connection end');
      }).on('close', (hadError: boolean) => {
        log.debug('connection close, with%1 error', (hadError ? '' : 'out'));
      }).connect(connectConfig);
    });
  }
}

export = CloudInstaller;
