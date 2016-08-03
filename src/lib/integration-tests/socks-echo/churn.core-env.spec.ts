import echotest = require('./base-spec.core-env');

describe('proxy integration tests using churn', function() {
  echotest.socksEchoTestDescription(true);
});
