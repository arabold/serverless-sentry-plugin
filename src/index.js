"use strict";

const _ = require("lodash")
	, BbPromise = require("bluebird")
	, SemVer = require("semver")
	, uuid = require("uuid/v4")
	, request = require("superagent")
	, GitRev = require("./git-rev");

/**
 * Serverless Plugin forward Lambda exceptions to Sentry (https://sentry.io)
 */
class Sentry {
	constructor(serverless, options) {
		this._serverless = serverless;
		this._options = options;
		this._custom = this._serverless.service.custom;
		this._provider = this._serverless.getProvider("aws");

		this.hooks = {
			"before:package:initialize": this.beforePackageInitialize.bind(this),
			"after:package:initialize": this.afterPackageInitialize.bind(this),
			"after:deploy:deploy": this.afterDeployFunctions.bind(this)
		};

		this.configPlugin();
	}

	configPlugin() {
		this.sentry = {};
		if (_.has(this._custom, "sentry") && _.isPlainObject(this._custom.sentry)) {
			_.assign(this.sentry, this._custom.sentry);
		}
	}

	validate() {

		// Check required serverless version
		if (SemVer.gt("1.12.0", this._serverless.getVersion())) {
			return BbPromise.reject(new this._serverless.classes.Error("Serverless verion must be >= 1.12.0"));
		}

		// Set configuration
		this._stage = this._options.stage;
		this._validated = true;

		return this._serverless.variables.populateObject(this.sentry)
		.then(populatedObject => {
			this.sentry = populatedObject;

			// Validate Sentry options
			if (!this.sentry.dsn) {
				return BbPromise.reject(new this._serverless.classes.Error("Sentry DSN must be set."));
			}

			// Set default option values
			if (!this.sentry.environment) {
				this.sentry.environment = this._stage;
			}

			if (this.sentry.authToken && (!this.sentry.organization || !this.sentry.project)) {
				this._serverless.cli.log("Sentry: In order to use the Sentry API " +
					"make sure to set `organization` and `project` in your `serverless.yml`.");
				_.unset(this.sentry, "authToken");
			}
			return BbPromise.resolve();
		});
	}

	beforePackageInitialize() {
		return BbPromise.bind(this)
		.then(this.validate);
	}

	afterPackageInitialize() {
		return BbPromise.bind(this)
		.then(this.setRelease)
		.then(this.instrumentFunctions);
	}

	afterDeployFunctions() {
		return BbPromise.bind(this)
		.then(this.createSentryRelease)
		.then(this.deploySentryRelease);
	}

	instrumentFunctions() {
		// Get functions
		const allFunctions = this._serverless.service.getAllFunctions();

		// Filter functions for instrumentations
		return BbPromise.map(allFunctions, functionName => this._serverless.service.getFunction(functionName))
		.filter(functionObject => {
			// Check if function should be instrumented
			return (_.get(functionObject, "sentry", true) === true);
		})
		.then(functionObjects => {
			if (!functionObjects.length) {
				return true;
			}

			return BbPromise.each(functionObjects, functionObject => this.instrumentFunction(functionObject));
		});
	}

	instrumentFunction(functionObject) {
		const sentryConfig = _.assign({}, this.sentry, _.get(functionObject, "sentry"));
		const envVars = {};

		if (_.has(sentryConfig, "dsn")) {
			functionObject.environment.SENTRY_DSN = sentryConfig.dsn;
		}
		if (_.has(sentryConfig, "release.version")) {
			functionObject.environment.SENTRY_RELEASE = sentryConfig.release.version;
		}
		if (_.has(sentryConfig, "environment")) {
			functionObject.environment.SENTRY_ENVIRONMENT = sentryConfig.environment;
		}
		if (_.has(sentryConfig, "autoBreadcrumbs")) {
			functionObject.environment.SENTRY_AUTO_BREADCRUMBS = sentryConfig.autoBreadcrumbs;
		}
		if (_.has(sentryConfig, "filterLocal")) {
			functionObject.environment.SENTRY_FILTER_LOCAL = sentryConfig.filterLocal;
		}
		if (_.has(sentryConfig, "captureErrors")) {
			functionObject.environment.SENTRY_CAPTURE_ERRORS = sentryConfig.captureErrors;
		}
		if (_.has(sentryConfig, "captureUnhandledRejections")) {
			functionObject.environment.SENTRY_CAPTURE_UNHANDLED = sentryConfig.captureUnhandledRejections;
		}
		if (_.has(sentryConfig, "captureMemoryWarnings")) {
			functionObject.environment.SENTRY_CAPTURE_MEMORY = sentryConfig.captureMemoryWarnings;
		}
		if (_.has(sentryConfig, "captureTimeoutWarnings")) {
			functionObject.environment.SENTRY_CAPTURE_TIMEOUTS = sentryConfig.captureTimeoutWarnings;
		}

		// Extend the function specific environment variables
		functionObject.environment = _.assign(envVars, functionObject.environment);

		return BbPromise.resolve(functionObject);
	}

	setRelease() {
		if (this.sentry.release && !_.isPlainObject(this.sentry.release)) {
			// Expand to the long form
			this.sentry.release = {
				version: this.sentry.release
			};
		}

		const version = _.get(this.sentry, "release.version", false);
		if (version === false || version === "false") {
			// nothing to do
			_.unset(this.sentry, "release");
			return BbPromise.resolve();
		}

		return BbPromise.try(() => {
			if (version === true || version === "true" || version === "git") {
				const gitRev = new GitRev({ cwd: this._serverless.config.servicePath });
				return gitRev.tag()
				.then(version => {
					// Populate the refs (if not set manually already)
					_.set(this.sentry, "release.version", version);
					if (!_.has(this.sentry, "release.refs")) {
						return BbPromise.join(
							gitRev.origin()
								.then(str => str.match(/[:\/]([^\/]+\/[^\/]+?)(\.git)?$/ig)[1])
								.catch(_.noop),
							gitRev.long()
						)
						.spread((repository, commit) => {
							if (repository && commit) {
								const refs = [{ repository, commit }];
								_.set(this.sentry, "release.refs", refs);
							}
						});
					}
				})
				.catch(err => {
					// No git available.
					if (version === "git") {
						// Error out
						return BbPromise.reject(new this._serverless.classes.Error(`Sentry: No Git available - ${err.toString()}`));
					}
					// Fall back to use a random number instead.
					process.env.SLS_DEBUG && this._serverless.cli.log("Sentry: No Git available. Creating a random release version...");
					_.set(this.sentry, "release.version", this.getRandomVersion());
				});
			}
			else if (version === "random") {
				process.env.SLS_DEBUG && this._serverless.cli.log("Sentry: Creating a random release version...");
				_.set(this.sentry, "release.version", this.getRandomVersion());
			}
			else {
				const str = _.trim(String(version));
				process.env.SLS_DEBUG && this._serverless.cli.log(`Sentry: Setting release version to "${str}"...`);
				_.set(this.sentry, "release.version", str);
			}
		});
	}

	createSentryRelease() {
		if (!this.sentry.authToken || !this.sentry.release) {
			// Nothing to do
			return BbPromise.resolve();
		}

		const organization = this.sentry.organization;
		const project = this.sentry.project;
		const release = this.sentry.release;
		this._serverless.cli.log(`Sentry: Creating new release "${release.version}"...`);

		return BbPromise.fromCallback(cb =>
			request.post(`https://sentry.io/api/0/organizations/${organization}/releases/`)
			.set("Authorization", `Bearer ${this.sentry.authToken}`)
			.send({
				version: release.version,
				refs: release.refs,
				projects: [ project ]
			})
			.end(cb)
		)
		.catch(err => {
			if (err && err.response && err.response.text) {
				this._serverless.cli.log(`Sentry: Received error response from Sentry:\n${err.response.text}`);
			}
			return BbPromise.reject(new this._serverless.classes.Error("Sentry: Error uploading release - " + err.toString()));
		});
	}

	deploySentryRelease() {
		if (!this.sentry.authToken || !this.sentry.release) {
			// Nothing to do
			return BbPromise.resolve();
		}

		const organization = this.sentry.organization;
		const release = this.sentry.release;
		this._serverless.cli.log(`Sentry: Deploying release "${release.version}"...`);

		return BbPromise.fromCallback(cb =>
			request.post(`https://sentry.io/api/0/organizations/${organization}/releases/${encodeURIComponent(release.version)}/deploys/`)
			.set("Authorization", `Bearer ${this.sentry.authToken}`)
			.send({
				environment: this.sentry.environment,
				name: `Deployed ${this._serverless.service.service}`
			})
			.end(cb)
		)
		.catch(err => {
			if (err && err.response && err.response.text) {
				this._serverless.cli.log(`Sentry: Received error response from Sentry:\n${err.response.text}`);
			}
			return BbPromise.reject(new this._serverless.classes.Error("Sentry: Error deploying release - " + err.toString()));
		});
	}

	getRandomVersion() {
		return BbPromise.resolve(_.replace(uuid(), /\-/g, ""));
	}
}

module.exports = Sentry;
