/// <reference path='../../third_party/typings/jasmine/jasmine.d.ts' />

describe("logger from core environment", () => {
  var log1 = new Logging.Log('tag1');
  var log2 = new Logging.Log('tag2');

  var message1 = Logging.makeMessage('D', 'tag', 'simple string', []);
  var message2 = Logging.makeMessage('D', 'tag', 'simple string');
  var message3 = Logging.makeMessage('I', 'test-module', 'second string', []);
  var message4 = Logging.makeMessage('W', 'test', '%1 pinged %2 with id=%3',
      ['Bob', 'Alice', '123456']);

  beforeEach(() => {
    Logging.clearLogs();
  });

  it('format string', () => {
    expect(Logging.formatMessage(message1))
        .toMatch(/.*\|tag\|D\|simple string/);
    expect(Logging.formatMessage(message2))
        .toMatch(/.*\|tag\|D\|simple string/);
    expect(Logging.formatMessage(message3))
        .toMatch(/.*\|test-module\|I\|second string/);
    expect(Logging.formatMessage(message4))
        .toMatch(/.*\|test\|W\|Bob pinged Alice with id=123456/);
  });

  it('grab logs', () => {
    log1.debug('simple string');
    log2.info('second string');
    expect(Logging.getLogStrings().join('\n')).toMatch(
      /.*\|tag1\|D\|simple string\n.*\|test-module\|I\|second string/);
  });

  it('format message like printf', () => {
    log1.error('%1 pinged %2 with id=%3', ['Bob', 'Alice', '123456']);
    expect(Logging.getLogStrings().join('\n')).toMatch(
      /.*\|tag1\|E\|Bob pinged Alice with id=123456/);
  });
});
