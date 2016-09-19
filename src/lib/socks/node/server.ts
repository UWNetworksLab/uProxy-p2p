/// <reference path='../../../../third_party/typings/index.d.ts' />

import net = require('net');
import piece = require('../piece');

export class NodeSocksServer {
    private getSocksSession: () => piece.SocksPiece;

    constructor(
        private requestedAddress_: string,
        private requestedPort_: number) { }

    // Configures a callback which is invoked when a new SOCKS client has connected.
    public onConnection = (callback: () => piece.SocksPiece): NodeSocksServer => {
        this.getSocksSession = callback;
        return this;
    }

    public listen = () => {
        const server = net.createServer((client) => {
            console.info('new SOCKS client from ' + client.remoteAddress + ':' + client.remotePort);
            const session = this.getSocksSession();
            session.onDataForSocksClient((ab) => {
                client.write(new Buffer(ab));
            });

            session.onDisconnect(() => {
                console.log('forwarding socket disconnected');
            });

            client.on('data', (buffer:Buffer) => {
                session.handleDataFromSocksClient(buffer.buffer);
            });

            // client.on('disconnect', (info) => {
            //     log.info('%1: disconnected from SOCKS client %2 (%3)', this.name_, clientId, info);
            //     // TODO: use counter to guard against early onDisconnect notifications
            //     freedom['core.tcpsocket'].close(clientSocket);
            //     socksSession.handleDisconnect();
            // });
        });

        return new Promise((F, R) => {
            try {
                server.listen({
                    host: this.requestedAddress_,
                    port: this.requestedPort_
                }, F);
            } catch (e) {
                R(e);
            }
        });
    }
}
