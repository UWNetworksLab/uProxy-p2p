// This is a dummy file to make sure that we typescheck the freedom-stypescript-
// api files.

/// <reference path='../freedom-declarations/freedom.d.ts' />
/// <reference path='../freedom-declarations/peer-connection.d.ts' />
/// <reference path='../freedom-declarations/social.d.ts' />
/// <reference path='../freedom-declarations/storage.d.ts' />
/// <reference path='../freedom-declarations/tcp-socket.d.ts' />
/// <reference path='../freedom-declarations/udp-socket.d.ts' />
/// <reference path='../freedom-declarations/transport.d.ts' />

var fdomCore :freedom.Core = freedom.core();
freedom.emit('foo');
freedom.emit('foo', 'bar');
freedom.emit('foo', {});
freedom.on('foo', () => { console.log('pants'); });
