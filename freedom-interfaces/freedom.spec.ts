// This is a dummy file to make sure that we typescheck the freedom-stypescript-
// api files.

/// <reference path='../freedom-interfaces/freedom.d.ts' />
/// <reference path='../freedom-interfaces/peer-connection.d.ts' />
/// <reference path='../freedom-interfaces/social.d.ts' />
/// <reference path='../freedom-interfaces/storage.d.ts' />
/// <reference path='../freedom-interfaces/tcp-socket.d.ts' />
/// <reference path='../freedom-interfaces/udp-socket.d.ts' />
/// <reference path='../freedom-interfaces/transport.d.ts' />

var fdomCore :freedom.Core = freedom.core();
freedom.emit('foo');
freedom.emit('foo', 'bar');
freedom.emit('foo', {});
freedom.on('foo', () => { console.log('pants'); });
