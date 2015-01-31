// This is a dummy file to make sure that we typecheck the
// freedom-typescript-api files.

/// <reference path='../typings/freedom-common.d.ts' />
/// <reference path='../typings/freedom-module-env.d.ts' />

/// <reference path='../typings/console.d.ts' />
/// <reference path='../typings/pgp.d.ts' />
/// <reference path='../typings/social.d.ts' />
/// <reference path='../typings/storage.d.ts' />
/// <reference path='../typings/tcp-socket.d.ts' />
/// <reference path='../typings/udp-socket.d.ts' />
/// <reference path='../typings/transport.d.ts' />
/// <reference path='../typings/rtcdatachannel.d.ts' />
/// <reference path='../typings/rtcpeerconnection.d.ts' />

var parentModule = freedom();
parentModule.on('message', (x:string) => {
  console.log('got a message: ' + x);
});
parentModule.emit('message', 'foo message');

// Logger variable, initially unbound, but get bound later.
var logger :freedom.Logger = null;

// Create a logger for this module.
var freedomCore :freedom.Core = freedom.core();
freedomCore.getLogger('[Test Module]')
  .then((bound_logger) => {
    logger = bound_logger;
    logger.log('logger ready');
  })
  .then(freedomCore.getId)
  .then((id:string[]) => {
    logger.log('id: ', logger);
  });
