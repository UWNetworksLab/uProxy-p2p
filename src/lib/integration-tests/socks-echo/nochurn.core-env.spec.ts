import echotest = require('./base-spec.core-env');

describe('proxy integration tests', function() {
  echotest.socksEchoTestDescription(false);
});
