/// <reference path='../../../../third_party/typings/index.d.ts' />

import copypaste_api = require('../copypaste-api');
declare module browserified_exports {
  var copypaste :copypaste_api.CopypasteApi;
}
import copypaste = browserified_exports.copypaste;

Polymer({
  model: copypaste.model
});
