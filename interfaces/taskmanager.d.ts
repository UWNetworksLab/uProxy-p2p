declare module TaskManager {
    interface Index {
        [s: string]: string[];
    }
    class Manager {
        public taskIndex: Index;
        public add(name: string, subtasks: string[]): void;
        public getUnflattened(name: string): string[];
        public get(name: string): string[];
        public list(): string[];
    }
}
