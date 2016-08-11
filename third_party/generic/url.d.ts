// Type definitions for the URL interface
// https://github.com/Microsoft/TypeScript/issues/2583

interface URLConstructor {
    hash: string;
    search: string;
    pathname: string;
    port: string;
    hostname: string;
    host: string;
    password: string;
    username: string;
    protocol: string;
    origin: string;
    href: string;
}
interface URL {
    revokeObjectURL(url: string): void;
    createObjectURL(object: any, options?: ObjectURLOptions): string;
    new(url: string, base?: string): URLConstructor
}
declare var URL: URL;
