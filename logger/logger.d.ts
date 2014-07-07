declare module freedom {
    function Logger(): any;
}

declare module Logger {
    class Logger {
        public dispatchEvent: any;
        constructor(dispatchEvent: any);
        public getEncrypedLogBuffer: (...tags: string[]) => Promise<ArrayBuffer>;
        public getLogs: (...tags: string[]) => Promise<string>;
        public reset: () => Promise<void>;
        public enable: (newState: boolean) => Promise<void>;
        private getTimestamp;
        public format: (level: string, tag: string, msg: string, args: string[]) => string;
        private isLevelAllowed;
        private doRealLog;
        public setConsoleFilter: (...args: string[]) => Promise<void>;
        public debug: (tag: string, msg: string, ...args: string[]) => Promise<void>;
        public info: (tag: string, msg: string, ...args: string[]) => Promise<void>;
        public warn: (tag: string, msg: string, ...args: string[]) => Promise<void>;
        public error: (tag: string, msg: string, ...args: string[]) => Promise<void>;
    }
}

interface LogProvider {
   getEncrypedLogBuffer(...tags: string[]) : Promise<ArrayBuffer>;
   getLogs(...tags: string[]) : Promise<string>;
   reset() : Promise<void>;
   enable(newState: boolean) : Promise<void>;
   format(level: string, tag: string, msg: string, args: string[]) : string;
   setConsoleFilter(...args: string[]) : Promise<void>;
   debug(tag: string, msg: string, ...args: string[]) : Promise<void>;
   info(tag: string, msg: string, ...args: string[]) : Promise<void>;
   warn(tag: string, msg: string, ...args: string[]) : Promise<void>;
   error(tag: string, msg: string, ...args: string[]) : Promise<void>;
}
