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
// TODO: update the URL once the uproxy-docker pull request is submitted
const INSTALL_COMMAND = 'curl -sSL https://raw.githubusercontent.com/uProxy/uproxy-docker/trevj-curl-installer/install-cloud.sh | sh';

// Prefix for the output line containing the invitation code.
const INVITATION_LINE_PREFIX = 'invite code: ';

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

    const client = new Client();
    return new Promise<string>((F, R) => {
      client.on('ready', () => {
        log.debug('logged into server');
        client.exec(INSTALL_COMMAND, (e: Error, stream: ssh2.Channel) => {
          if (e) {
            R({
              message: 'could not execute command: ' + e.message
            });
            return;
          }
          stream.on('end', () => {
            log.debug('exec stream closed');
            // TODO: is it correct to reject if we haven't already resolved?
            R({
              message: 'invitation URL not found'
            });
          }).on('data', function(data: Buffer) {
            const output = data.toString();
            log.debug('STDOUT: %1', output);
            if (output.indexOf(INVITATION_LINE_PREFIX) === 0) {
              F(output.substring(INVITATION_LINE_PREFIX.length));
            }
          }).stderr.on('data', function(data: Buffer) {
            log.error(data.toString());
          });
        });
      }).on('error', (e: Error) => {
        // This occurs when:
        //  - user supplies the wrong username or password
        //  - host cannot be reached, e.g. non-existant hostname
        log.warn('failed to connect: %1', e);
        R({
          message: 'could not login: ' + e.message
        });
      }).on('end', () => {
        log.debug('end');
      }).on('close', (hadError: boolean) => {
        log.debug('close');
      }).connect(connectConfig);
    });
  }
}

export = CloudInstaller;
