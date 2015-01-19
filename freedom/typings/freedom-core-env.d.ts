/// <reference path="../../../third_party/typings/es6-promise/es6-promise.d.ts" />
/// <reference path="./freedom-common.d.ts" />

// The freedom file, when loaded, will assume that a new variable |freedomcfg|
// on the global window object may be set.
interface Window {
  // The freedom config variable can be set in the window to let an application
  // register additional core-providers. When Freedom starts up, if the
  // |freedomcfg| var is defined, it will call it passing it the internal core-
  // provider registration function. |providerName| should be a name of a core-
  // provider as defined in |freedom/interface/core.js|, and the function-
  // argument should be a class that meets that interface of |providerName|.
  freedomcfg ?: (register:(providerName:string, classFn:Function) => void)
    => void;
}

declare var freedom :freedom.FreedomInCoreEnv;
