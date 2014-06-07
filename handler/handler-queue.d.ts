/// <reference path="../../node_modules/freedom-typescript-api/interfaces/promise.d.ts" />
declare module Handler {
    class Queue<T> {
        constructor();
        public setHandler: (handler:(x:T) => void) => void;
        public clearQueue: () => void;
        public getLength: () => number;
        public handle: (x:T) => void;
        public makePromise: () => Promise<T>;
    }
}
