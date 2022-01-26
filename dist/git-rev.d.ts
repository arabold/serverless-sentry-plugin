export declare type Options = {
    cwd: string;
};
export default class GitRev {
    opts: Options;
    constructor(opts?: Options);
    private _command;
    short(): Promise<string>;
    long(): Promise<string>;
    branch(): Promise<string>;
    tag(): Promise<string>;
    log(): Promise<string[]>;
    exactTag(): Promise<string | undefined>;
    origin(): Promise<string>;
}
