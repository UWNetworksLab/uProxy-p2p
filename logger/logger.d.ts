declare module freedom {
    function Logger(): any;
}
declare module Logger {
    class Logger {
        public dispatchEvent: any;
        constructor(dispatchEvent: any);
        public getLogBlob: (...tags: string[]) => Promise<ArrayBuffer>;
        public getLogs: (...tags: string[]) => Promise<string>;
        public reset: () => Promise<void>;
        public enable: (newState: boolean) => Promise<void>;
        private getTimestamp;
        public format: (level: string, tag: string, msg: string, args: any[]) => string;
        private isLevelAllowed;
        private doRealLog;
        public setConsoleFilter: (...args: string[]) => Promise<void>;
        public debug: (tag: string, msg: string, ...args: any[]) => Promise<void>;
        public info: (tag: string, msg: string, ...args: any[]) => Promise<void>;
        public warn: (tag: string, msg: string, ...args: any[]) => Promise<void>;
        public error: (tag: string, msg: string, ...args: any[]) => Promise<void>;
    }
}
