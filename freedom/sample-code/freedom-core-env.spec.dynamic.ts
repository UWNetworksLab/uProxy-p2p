// This is a dummy file to make sure that we typecheck the
// freedom-typescript-api files.

/// <reference path='../typings/freedom-common.d.ts' />
/// <reference path='../typings/freedom-core-env.d.ts' />

// Some imaginary trivial code for a freedom core env code to load a module
// handle messages and send a message.
freedom('freedom-module.json', {
      'logger': 'loggingprovider.json',
      'debug': 'log'})
  .then((moduleFactory:() => freedom.OnAndEmit<any,any>) => {
    var moduleStub :freedom.OnAndEmit<any,any> = moduleFactory();

    moduleStub.on('messageFromModuleType', (x:string) => {
      console.log(x);
    });

    moduleStub.emit('messageToModuleType', {});
  }, (e:Error) => {
    console.error('Could not load freedom module: ' + e.message);
  });
