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
			let handlerDir = path.dirname(this.function.handler);
			let handlerJs = path.join(this.evt.data.pathDist, handlerDir, '_serverless_handler.js');

			return fs.readFileAsync(handlerJs)
			.then(function(js) {
				// Wrap the original handler and inject Sentry code
				js = js.toString("utf8") + `
					if (process.env.LAMBDA_TASK_ROOT && process.env.SENTRY_DSN) {
						var raven = require("raven");
						var ravenClient = new raven.Client(process.env.SENTRY_DSN);

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

						function sentryWrapCb(cb, event, context) {
							return function(err, data) {
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
											Event: event
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
							if (cb) {
								cb = sentryWrapCb(cb, event, context);
							}

							var wrappedCtx   = require("util")._extend({}, context);
							wrappedCtx.done  = sentryWrapCb(context.done,  event, context);
							wrappedCtx.error = sentryWrapCb(context.error, event, context);

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