/// <reference path='../../../../third_party/typings/index.d.ts' />

export import logging_provider = require('./loggingprovider');

declare const freedom: freedom.FreedomInModuleEnv;

export var moduleName = 'loggingprovider'

// Register the interfaces with freedom. Note: |freedom().provideSynchronous| is
// used to set class that corresponds to the 'default' freedom interface in the
// |freedom-module.json| freedom manifest.
freedom().provideSynchronous(logging_provider.Log);
freedom['loggingcontroller']().provideSynchronous(logging_provider.LoggingController);
freedom['logginglistener']().provideSynchronous(logging_provider.LoggingListener);
