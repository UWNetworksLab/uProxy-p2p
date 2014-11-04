/// <reference path='../third_party/typings/jasmine/jasmine.d.ts' />
/// <reference path="logging.d.ts" />

describe("logger from core environment", () => {
  var log1 = new Logging.Log('tag1');
  var log2 = new Logging.Log('tag2');

  var message1 = Logging.makeMessage('D', 'tag', 'simple string', []);
  var message2 = Logging.makeMessage('D', 'tag', 'simple string');
  var message3 = Logging.makeMessage('I', 'test-module', 'second string', []);
  var message4 = Logging.makeMessage('W', 'test', '%1 pinged %2 with id=%3',
      ['Bob', 'Alice', '123456']);
  var message5 = Logging.makeMessage('E', 'test', '%1 pinged %2 with id=%3',
      ['Bob', 'Alice', '123456']);

  beforeEach(() => {
    Logging.clearLogs();
  });

  it('format string', () => {
    expect(Logging.formatMessage(message1))
        .toMatch(/D \[.*\] simple string/);
    expect(Logging.formatMessage(message2))
        .toMatch(/D \[.*\] simple string/);
    expect(Logging.formatMessage(message3))
        .toMatch(/I \[.*\] second string/);
    expect(Logging.formatMessage(message4))
        .toMatch(/W \[.*\] Bob pinged Alice with id=123456/);
    expect(Logging.formatMessage(message5))
        .toMatch(/E \[.*\] Bob pinged Alice with id=123456/);
  });

  it('grab logs', () => {
    // testing default behavior, only log error messages.
    log1.debug('simple string');
    log2.info('second string');
    log2.error('third string');
    expect(Logging.getLogs().join('\n')).toMatch(
      /E \[.*\] third string/);

    // set to log all messages.
    Logging.clearLogs();
    Logging.setBufferedLogFilter(['*:D']);
    log1.debug('simple string');
    log2.info('second string');
    log2.error('third string');
    expect(Logging.getLogs().join('\n')).toMatch(
      /D \[.*\] simple string\nI \[.*\] second string\nE \[.*\] third string/);

     // set to log messages with level >= info.
    Logging.clearLogs();
    Logging.setBufferedLogFilter(['*:I']);
    log1.debug('simple string');
    log2.info('second string');
    log2.error('third string');
    expect(Logging.getLogs().join('\n')).toMatch(
      /I \[.*\] second string\nE \[.*\] third string/);

    // restore back to default.
    Logging.setBufferedLogFilter(['*:E']);
  });

  it('format message like printf', () => {
    log1.error('%1 pinged %2 with id=%3', ['Bob', 'Alice', '123456']);
    expect(Logging.getLogs().join('\n')).toMatch(
      /E \[.*\] Bob pinged Alice with id=123456/);
  });
});
