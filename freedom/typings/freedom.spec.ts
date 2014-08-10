// This is a dummy file to make sure that we typescheck the freedom-stypescript-
// api files.

/// <reference path='../freedom/typings/freedom.d.ts' />
/// <reference path='../freedom/typings/peer-connection.d.ts' />
/// <reference path='../freedom/typings/social.d.ts' />
/// <reference path='../freedom/typings/storage.d.ts' />
/// <reference path='../freedom/typings/tcp-socket.d.ts' />
/// <reference path='../freedom/typings/udp-socket.d.ts' />
/// <reference path='../freedom/typings/transport.d.ts' />

var fdomCore :freedom.Core = freedom.core();
freedom.emit('foo');
freedom.emit('foo', 'bar');
freedom.emit('foo', {});
freedom.on('foo', () => { console.log('pants'); });
