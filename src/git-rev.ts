import { exec } from "child_process";

export type Options = {
  cwd: string;
};

export default class GitRev {
  opts: Options;

  constructor(opts?: Options) {
    this.opts = opts ?? { cwd: __dirname };
  }

  async _command(cmd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      exec(cmd, this.opts, function (err, stdout /*, stderr */) {
        return err ? reject(err) : resolve(stdout.replace(/\n/g, "").trim());
      });
    });
  }

  async short(): Promise<string> {
    return this._command("git rev-parse --short HEAD");
  }

  async long(): Promise<string> {
    return this._command("git rev-parse HEAD");
  }

  async branch(): Promise<string> {
    return this._command("git rev-parse --abbrev-ref HEAD");
  }

  async tag(): Promise<string> {
    return this._command("git describe --always --tag --abbrev=0");
  }

  async log(): Promise<string[]> {
    let str = await this._command(
      'git log --no-color --pretty=format:\'[ "%H", "%s", "%cr", "%an" ],\' --abbrev-commit',
    );
    str = str.substr(0, str.length - 1);
    return JSON.parse("[" + str + "]") as string[];
  }

  async exactTag(): Promise<string | undefined> {
    // Suppress errors
    return this._command("git describe --exact-match --tags HEAD").catch(() => undefined);
  }

  async origin(): Promise<string> {
    return this._command("git config --get remote.origin.url");
  }
}
