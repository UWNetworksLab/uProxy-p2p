/// <reference path='../../../third_party/freedom-typings/freedom-common.d.ts' />
/// <reference path='../../../third_party/freedom-typings/freedom-module-env.d.ts' />
/// 
var PortControl = require('./churn-pipe');
if (typeof freedom !== 'undefined') {
    freedom['portControl']().providePromises(PortControl);
}
module.exports = PortControl;
