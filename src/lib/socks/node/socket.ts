/// <reference path='../../../../third_party/typings/index.d.ts' />

import net = require('net');
import piece = require('../piece');

export class NodeForwardingSocket implements piece.SocksPiece {
    private socket = new net.Socket();
    private onDataCallback: (buffer: ArrayBuffer) => void;

    constructor() {
        this.socket.on('data', (buffer: Buffer) => {
            this.onDataCallback(buffer.buffer);
        });
        // this.socket_.on('onDisconnect', (info: freedom.TcpSocket.DisconnectInfo) => {
        //   this.onDisconnect_();
        // });
    }

    public onDataForSocksClient = (callback: (buffer: ArrayBuffer) => void): NodeForwardingSocket => {
        this.onDataCallback = callback;
        return this;
    }

    private onDisconnect_: () => void;
    public onDisconnect = (callback: () => void): NodeForwardingSocket => {
        // this.onDisconnect_ = callback;
        return this;
    }

    public handleDataFromSocksClient = (buffer: ArrayBuffer) => {
        this.socket.write(new Buffer(buffer));
    };

    public handleDisconnect = () => {
        // log.debug('SOCKS client has disconnected');
    }

    public connect = (host: string, port: number) => {
        return new Promise((F, R) => {
            this.socket.on('error', (e: any) => {
                console.error('could not connect', e);
                R(e);
            });
            return this.socket.connect(port, host, () => {
                console.log('connected!');
                F();
            });
        });
    }
}
