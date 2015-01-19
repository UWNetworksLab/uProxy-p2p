// This is a dummy file to make sure that we typescheck the freedom-stypescript-
// api files.

/// <reference path='freedom-common.d.ts' />
/// <reference path='freedom-core-env.d.ts' />

/// <reference path='console.d.ts' />
/// <reference path='pgp.d.ts' />
/// <reference path='social.d.ts' />
/// <reference path='storage.d.ts' />
/// <reference path='tcp-socket.d.ts' />
/// <reference path='udp-socket.d.ts' />
/// <reference path='transport.d.ts' />
/// <reference path='rtcdatachannel.d.ts' />
/// <reference path='rtcpeerconnection.d.ts' />

// Some imaginary trivial code for a freedom core env code to load a module
// handle messages and send a message.
freedom('freedom-module.json', {
    'logger': 'loggingprovider.json',
    'debug': 'log'
  }).then((moduleFactory:() => freedom.OnAndEmit<any,any>) => {

  var moduleStub :freedom.OnAndEmit<any,any> = moduleFactory();

  moduleStub.on('messageFromModuleType', (x:string) => {
    console.log(x);
  });

  moduleStub.emit('messageToModuleType', {});
}, (e:Error) => {
  console.error('Could not load freedom module: ' + e.message);
});
