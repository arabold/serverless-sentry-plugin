'use strict';

/**
 * Action: Code Package: Lambda
 * - Accepts one function
 * - Collects the function's Lambda code in a distribution folder
 * - Don't attach "options" to context, it will be overwritten in concurrent operations
 * - WARNING: This Action runs concurrently
 */

module.exports = function(S) {

	const path    = require('path'),
		BbPromise = require('bluebird'),
		SError    = require(S.getServerlessPath('Error')),
		fs        = BbPromise.promisifyAll(require('fs'));

	class CodePackageLambda extends S.classes.Plugin {

		static getName() {
			return 'serverless.core.' + this.name;
		}

		/**
		 * Register Hooks
		 */
		registerHooks() {

			S.addHook(this._postPackage.bind(this), {
				action: 'codePackageLambda',
				event:  'post'
			});

			return BbPromise.resolve();
		}

		/**
		 * Code Package Lambda Hook
		 */

		_postPackage(evt) {
			let packager = new Packager();
			return packager.package(evt);
		}
	}

	/**
	 * Packager
	 * - Necessary for this action to run concurrently
	 */

	class Packager {

		package(evt) {

			let _this     = this;
			_this.evt     = evt;

			// Flow
			return _this._validateAndPrepare()
			.bind(_this)
			.then(_this._package)
			.then(function() {

				/**
				 * Return EVT
				 */

				return _this.evt;

			});
		}

		/**
		 * Validate And Prepare
		 */

		_validateAndPrepare() {

			let _this = this;

			// Instantiate classes
			_this.function = S.getProject().getFunction( _this.evt.options.name );
			if (!_this.function) {
				BbPromise.reject(new SError(`Function could not be found: ${_this.evt.options.name}`));
			}

			return BbPromise.resolve();
		}

		/**
		 * Package
		 * - Build lambda package
		 */

		_package() {
			let _this = this;
			let handlerDir = path.dirname(this.function.handler);
			let handlerJs = path.join(this.evt.data.pathDist, handlerDir, '_serverless_handler.js');

			return fs.readFileAsync(handlerJs)
			.then((js) => {
				// Wrap the original handler and inject Sentry code
				js = js.toString("utf8") + `
					if (process.env.SENTRY_DSN) {
						var raven = require("raven");
						var ravenClient = global.sls_raven = new raven.Client(process.env.SENTRY_DSN);

						ravenClient.setTagsContext({
							Lambda: process.env.AWS_LAMBDA_FUNCTION_NAME,
							Version: process.env.AWS_LAMBDA_FUNCTION_VERSION,
							LogStream: process.env.AWS_LAMBDA_LOG_STREAM_NAME,
							ProjectName: process.env.SERVERLESS_PROJECT_NAME,
							Stage: process.env.SERVERLESS_STAGE,
							Region: process.env.SERVERLESS_REGION
						});
						ravenClient.patchGlobal(function() {
							process.exit(1);
						});

						function sentryWrapCb(cb, event, context, timeout) {
							return function(err, data) {
								clearTimeout(timeout);

								if (err) {
									var onCaptured = function() {
										ravenClient.removeListener("logged", onCaptured);
										ravenClient.removeListener("error",  onCaptured);
										return cb(err, data);
									};

									ravenClient.on("logged", onCaptured);
									ravenClient.on("error",  onCaptured);
									ravenClient.captureException(err, {
										extra: {
											Event: event,
											Context: context
										}
									});
								}
								else {
									return cb(err, data);
								}
							};
						}

						var origHandler = exports.handler;
						exports.handler = function(event, context, cb) {
							var timeout = setTimeout(function() {
								ravenClient.captureMessage("Execution time exceeds ${_this.function.timeout/2} seconds.", {
									level: "warning",
									extra: {
										Event: event,
										Context: context
									}
								});
							}, ${_this.function.timeout*500});

							if (cb) {
								cb = sentryWrapCb(cb, event, context, timeout);
							}

							var wrappedCtx     = require("util")._extend({}, context);
							wrappedCtx.done    = sentryWrapCb(context.done, event, context, timeout);
							wrappedCtx.error   = function(err) { wrappedCtx.done(err); };
							wrappedCtx.success = function(data) { wrappedCtx.done(null, data); };

							return origHandler(event, wrappedCtx, cb);
						};
					}
				`;
				return fs.writeFileAsync(handlerJs, js);
			});
		}
	}

	return( CodePackageLambda );
};