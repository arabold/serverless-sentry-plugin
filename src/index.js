"use strict";

const _ = require("lodash")
	, BbPromise = require("bluebird")
	// , glob = require("glob")
	// , fs = require("fs")
	// , path = require("path")
	// , crypto = require("crypto")
	, request = require("superagent")
	, childProcess = require("child_process")
	, SemVer = require("semver")
	, uuid = require("uuid/v4");

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
			"after:package:createDeploymentArtifacts": this.afterCreateDeploymentArtifacts.bind(this),
			"after:aws:deploy:deploy:uploadArtifacts": this.afterUploadArticfacts.bind(this),
			"after:deploy:deploy": this.afterDeployFunctions.bind(this)
		};

		// // Import function from AWS Provider to determine the artifacts bucket name
		// const setBucketName = require(
		// 	path.join(this._serverless.config.serverlessPath,
		// 		"plugins",
		// 		"aws",
		// 		"lib",
		// 		"setBucketName")
		// );
		//
		// _.assign(
		// 	this,
		// 	setBucketName
		// );
		this.configPlugin();
	}

	configPlugin() {
		this.sentry = {
			dsn: null, // mandatory
			stage: null, // will be set in validate()
			sourcemaps: {
				dir: ".",
				pattern: [ "**/*.map" ]
			}
		};

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

		// Validate Sentry options
		if (!this.sentry.dsn) {
			return BbPromise.reject(new this._serverless.classes.Error("Sentry DSN must be set."));
		}

		if (!this.sentry.stage) {
			this.sentry.stage = this._stage;
		}

		return BbPromise.resolve();
	}

	setBucketName() {
		return this._provider.getServerlessDeploymentBucketName()
		.then(bucketName => this._bucketName = bucketName);
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

	afterCreateDeploymentArtifacts() {
	}

	afterUploadArticfacts() {
		return BbPromise.bind(this)
		.then(this.setBucketName)
		.then(this.uploadSourceMaps);
	}

	afterDeployFunctions() {
		return this.createSentryRelease();
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
		if (_.has(sentryConfig, "release")) {
			functionObject.environment.SENTRY_RELEASE = sentryConfig.release;
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
		if (_.has(this.sentry, "release")) {
			// Already have a release version set
			return BbPromise.resolve();
		}

		return this.getGitRevision()
		.then(gitRev => {
			console.log("GIT REVISION:", gitRev);
			return gitRev;
		})
		.catch(() => {
			// No git available. We use a random number instead.
			process.env.SLS_DEBUG && this._serverless.cli.log("Sentry: No Git available. Creating random release version.");
			return _.replace(uuid(), /\-/g, "");
		})
		.then(version => {
			process.env.SLS_DEBUG && this._serverless.cli.log(`Sentry: Release ${version}.`);
			this.sentry.release = version;
			return BbPromise.resolve();
		});
	}

	createSentryRelease() {
		if (!this.sentry.authToken) {
			// Skip creating release if no auth token is set
			return BbPromise.resolve();
		}
		if (!this.sentry.organization || !this.sentry.project) {
			this._serverless.cli.log("Sentry: Cannot create Sentry release. " +
				"Make sure to set `organization` and `project` in your `serverless.yml`.");
			return BbPromise.resolve();
		}

		const organization = this.sentry.organization;
		const project = this.sentry.project;
		const release = this.sentry.release;
		return BbPromise.fromCallback(cb =>
			request.post(`https://sentry.io/api/0/projects/${organization}/${project}/releases/`)
			.set("Authorization", `Bearer ${this.sentry.authToken}`)
			.send({ version: release })
			.end(cb)
		)
		.then(() => {
			this._serverless.cli.log(`Sentry: Created new release ${release}`);
			return BbPromise.resolve();
		})
		.catch(err => {
			return BbPromise.reject(new this._serverless.classes.Error("Sentry: Error uploading release - " + err.toString()));
		});
	}

	// uploadSourceMaps() {
	// 	if (!this.sentry.authToken) {
	// 		// Skip creating release if no auth token is set
	// 		return BbPromise.resolve();
	// 	}
	//
	// 	let patterns = _.get(this.sentry, "sourcemaps.pattern", []);
	// 	if (_.isString(patterns)) {
	// 		patterns = [ patterns ];
	// 	}
	// 	if (_.isArray(patterns) && !_.isEmpty(patterns)) {
	// 		if (!this.sentry.organization || !this.sentry.project) {
	// 			this._serverless.cli.log("Sentry: Cannot upload source maps. " +
	// 				"Make sure to set `organization` and `project` in your `serverless.yml`.");
	// 			return BbPromise.resolve();
	// 		}
	//
	// 		this._serverless.cli.log("Sentry: Uploading source-maps to S3...");
	// 		const servicePath = this._serverless.config.servicePath;
	// 		const sourceMapsDir = path.resolve(servicePath,
	// 			_.trimStart(_.get(this.sentry, "sourcemaps.dir", "."), path.sep));
	// 		const options = {
	// 			cwd: sourceMapsDir,
	// 			nodir: true,
	// 			ignore: "node_modules/**"
	// 		};
	//
	// 		const date = new Date();
	// 		const organization = this.sentry.organization;
	// 		const project = this.sentry.project;
	// 		const release = this.sentry.release;
	// 		const filesUploadUrl = `https://sentry.io/api/0/projects/${organization}/${project}/releases/${release}/files/`;
	//
	// 		const files = _.flatten(_.map(patterns, globString => glob.sync(globString, options)));
	// 		return BbPromise.each(files, file => {
	// 			const fileName = path.relative(sourceMapsDir, file);
	// 			const fileContent = fs.readFileSync(file);
	// 			const fileHash = crypto
	// 				.createHash("sha1")
	// 				.update(fileContent)
	// 				.digest("base64");
	//
	// 			// Upload to S3 and grant Sentry access
	// 			const s3Key = `${this._serverless.service.package.artifactDirectoryName}/source-maps/${release}/${fileName}`;
	// 			const fileSize = fileContent.length;
	// 			let params = {
	// 				Bucket: this._bucketName,
	// 				Key: s3Key,
	// 				Body: fileContent,
	// 				ContentType: "application/json",
	// 				ACL: "public-read", // FIXME We should provide a better way of protecting this other than just a secret URL
	// 				Metadata: {
	// 					filesha1: fileHash,
	// 				},
	// 			};
	//
	// 			process.env.SLS_DEBUG && this._serverless.cli.log(`Sentry: Uploading "${fileName}" (${fileSize})...`);
	// 			return this._provider.request("S3",
	// 				"putObject",
	// 				params,
	// 				this._options.stage,
	// 				this._options.region
	// 			)
	// 			.then(() => {
	// 				const s3Url = `https://s3.amazonaws.com/${this._bucketName}/${s3Key}`;
	// 				// Add the source map to Sentry
	// 				return BbPromise.fromCallback(cb =>
	// 					request.post(filesUploadUrl)
	// 					.set("Authorization", `Bearer ${this.sentry.authToken}`)
	// 					.field("file", `@${fileName}`)
	// 					.field("name", s3Url)
	// 					.attach(JSON.stringify({
	// 						dateCreated: date.toISOString(),
	// 						headers: {
	// 							"Content-Type": "application/octet-stream"
	// 						},
	// 						id: "1",
	// 						name: s3Url,
	// 						sha1: fileHash,
	// 						size: fileSize
	// 					}))
	// 					.end(cb)
	// 				);
	// 			});
	// 		});
	// 	}
	// }

	/**
	 * The current tag if there is a tag,
	 * otherwise, just returns the current hash
	 */
	getGitRevision() {
		const command = "git describe --always --tag --abbrev=0";
		const cwd = this._serverless.config.servicePath;
		return new BbPromise((resolve, reject) => {
			childProcess.exec(command, { cwd }, (err, stdout, stderr) => {
				if (err) {
					reject(err, stderr);
				}
				else {
					resolve(stdout);
				}
			});
		});
	}
}

module.exports = Sentry;
