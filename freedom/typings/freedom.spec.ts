// This is a dummy file to make sure that we typescheck the freedom-stypescript-
// api files.

/// <reference path='freedom.d.ts' />
/// <reference path='peer-connection.d.ts' />
/// <reference path='social.d.ts' />
/// <reference path='storage.d.ts' />
/// <reference path='tcp-socket.d.ts' />
/// <reference path='udp-socket.d.ts' />
/// <reference path='transport.d.ts' />

var fdomCore :freedom.Core = freedom.core();
freedom.emit('foo');
freedom.emit('foo', 'bar');
freedom.emit('foo', {});
freedom.on('foo', () => { console.log('pants'); });
