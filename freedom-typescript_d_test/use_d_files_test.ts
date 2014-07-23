// This is a dummy file to make sure that we typescheck the freedom-stypescript-
// api files.

/// <reference path='../freedom-typescript-api/interfaces/freedom.d.ts' />
/// <reference path='../freedom-typescript-api/interfaces/peer-connection.d.ts' />
/// <reference path='../freedom-typescript-api/interfaces/social.d.ts' />
/// <reference path='../freedom-typescript-api/interfaces/storage.d.ts' />
/// <reference path='../freedom-typescript-api/interfaces/tcp-socket.d.ts' />
/// <reference path='../freedom-typescript-api/interfaces/udp-socket.d.ts' />
/// <reference path='../freedom-typescript-api/interfaces/transport.d.ts' />

var fdomCore :freedom.Core = freedom.core();
freedom.emit('foo');
freedom.emit('foo', 'bar');
freedom.emit('foo', {});
freedom.on('foo', () => { console.log('pants'); });
