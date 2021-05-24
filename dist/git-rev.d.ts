export declare type Options = {
    cwd: string;
};
export default class GitRev {
    opts: Options;
    constructor(opts?: Options);
    _command(cmd: string): Promise<string>;
    short(): Promise<string>;
    long(): Promise<string>;
    branch(): Promise<string>;
    tag(): Promise<string>;
    log(): Promise<string[]>;
    exactTag(): Promise<string | undefined>;
    origin(): Promise<string>;
}
