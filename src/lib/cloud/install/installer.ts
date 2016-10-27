import '../social/monkey/process';

import * as arraybuffers from '../../arraybuffers/arraybuffers';
import * as linefeeder from '../../net/linefeeder';
import * as logging from '../../logging/logging';
import Pinger from '../../net/pinger';
import * as queue from '../../handler/queue';

// https://github.com/borisyankov/DefinitelyTyped/blob/master/ssh2/ssh2-tests.ts
import * as ssh2 from 'ssh2';
var Client = require('ssh2').Client;

var log: logging.Log = new logging.Log('cloud installer');

// Command to install uProxy.
const INSTALL_COMMAND = 'curl -sSL https://raw.githubusercontent.com/uProxy/uproxy-docker/master/install-cloud.sh | sh -s -- -a';

// Prefix for invitation URLs.
const INVITATION_PREFIX = 'CLOUD_INSTANCE_DETAILS_JSON:';

// Prefix for progress updates.
const PROGRESS_PREFIX = 'CLOUD_INSTALL_PROGRESS';

// Prefix for status updates.
const STATUS_PREFIX = 'CLOUD_INSTALL_STATUS';

// Retry timing for SSH connection establishment.
const INITIAL_CONNECTION_INTERVAL_MS = 500;
const MAX_CONNECTION_INTERVAL_MS = 10000;

// Timeouts for established SSH connections.
// We define these chiefly so that the installer fails quickly
// in case the server is destroyed during installation, e.g.
// when the user cancels install.
const KEEPALIVE_INTERVAL_MS = 1000;
const KEEPALIVE_MAX_FAILURES = 120;

// Installs uProxy on a server, via SSH.
// The process is as close as possible to a manual install
// so that we have fewer paths to test.
export default class CloudInstaller {
  constructor(private dispatchEvent_: (name: string, args: Object) => void) {}

  // Runs the install command via SSH, resolving with the invitation URL.
  public install = (
      host:string,
      port:number,
      username:string,
      key:string) : Promise<Object> => {
    log.debug('installing uproxy on %1:%2 as %3', host, port, username);

    const connectConfig: ssh2.ConnectConfig = {
      host: host,
      port: port,
      username: username,
      privateKey: key,
      keepaliveInterval: KEEPALIVE_INTERVAL_MS,
      keepaliveCountMax: KEEPALIVE_MAX_FAILURES,
      // Remaining fields only for type-correctness.
      tryKeyboard: false,
      debug: undefined
    };

    return new Promise<string>((F, R) => {
      const connection = new Client();
      connection.on('ready', () => {
        log.debug('logged into server');

        const stdoutRaw = new queue.Queue<ArrayBuffer, void>();
        const stdout = new linefeeder.LineFeeder(stdoutRaw);
        stdout.setSyncHandler((line: string) => {
          log.debug('STDOUT: %1', line);
          // Search for the URL anywhere in the line so we will
          // continue to work in the face of minor changes
          // to the install script.
          if (line.indexOf(INVITATION_PREFIX) === 0) {
            const inviteJson = line.substring(INVITATION_PREFIX.length);
            try {
              F(JSON.parse(inviteJson));
            } catch (e) {
              R({
                message: 'could not parse invite: ' + inviteJson
              });
            }
          } else if (line.indexOf(PROGRESS_PREFIX) === 0) {
            const tokens = line.split(' ');
            if (tokens.length < 2) {
              log.warn('could not parse progress update');
            } else {
              const progress = parseInt(tokens[1], 10);
              this.dispatchEvent_('progress', progress);
            }
          } else if (line.indexOf(STATUS_PREFIX) === 0) {
            this.dispatchEvent_('status', line);
          }
        });

        const stderrRaw = new queue.Queue<ArrayBuffer, void>();
        const stderr = new linefeeder.LineFeeder(stderrRaw);
        stderr.setSyncHandler((line: string) => {
          log.error('STDERR: %1', line);
        });

        connection.exec(INSTALL_COMMAND, (e: Error, stream: ssh2.Channel) => {
          if (e) {
            connection.end();
            R({
              message: 'could not execute command: ' + e.message
            });
            return;
          }
          stream.on('end', () => {
            stdout.flush();
            stderr.flush();
            connection.end();
            R({
              message: 'invitation URL not found'
            });
          }).on('data', (data: Buffer) => {
            // Make a copy before passing to the async queue.
            stdoutRaw.handle(arraybuffers.bufferToArrayBuffer(new Buffer(data)));
          }).stderr.on('data', (data: Buffer) => {
            // Make a copy before passing to the async queue.
            stderrRaw.handle(arraybuffers.bufferToArrayBuffer(new Buffer(data)));
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
        R({
          message: 'connection end without invitation URL'
        });
      }).on('close', (hadError: boolean) => {
        log.debug('connection close, with%1 error', (hadError ? '' : 'out'));
        R({
          message: 'connection close without invitation URL'
        });
      }).connect(connectConfig);
    }).then((invite: any) => {
      // It can take several seconds before the SSH server running
      // in the new Docker container becomes active.
      return new Pinger(host, 5000).ping().then(() => {
        return invite;
      });
    });
  }
}
