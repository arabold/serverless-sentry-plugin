"use strict";

const exec = require("child_process").exec
	, BbPromise = require("bluebird")
	, _ = require("lodash");


class GitRev {

	constructor(opts) {
		this.opts = opts || { cwd: __dirname };
	}

	_command(cmd) {
		return new BbPromise((resolve, reject) => {
			exec(cmd, this.opts, function (err, stdout /*, stderr */) {
				return err ? reject(err) : resolve(_.trim(_.replace(stdout, /\n/g, "")));
			});
		});
	}

	short() {
		return this._command("git rev-parse --short HEAD");
	}

	long() {
		return this._command("git rev-parse HEAD");
	}

	branch() {
		return this._command("git rev-parse --abbrev-ref HEAD");
	}

	tag() {
		return this._command("git describe --always --tag --abbrev=0");
	}

	log() {
		return this._command('git log --no-color --pretty=format:\'[ "%H", "%s", "%cr", "%an" ],\' --abbrev-commit')
		.then(str => {
			str = str.substr(0, str.length-1);
			return JSON.parse("[" + str + "]");
		});
	}

	exactTag() {
		// Suppress errors
		return this._command("git describe --exact-match --tags HEAD").catch(_.noop);
	}

	origin() {
		return this._command("git config --get remote.origin.url");
	}
}

module.exports = GitRev;
