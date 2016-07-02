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
			let handlerFilePath = path.join(this.evt.data.pathDist, handlerDir, '_serverless_handler.js');
			let wrapperFilePath = path.join(__dirname, 'LambdaWrapper.js');

			return BbPromise.join(
				fs.readFileAsync(handlerFilePath),
				fs.readFileAsync(wrapperFilePath)
			)
			.spread((handlerJs, wrapperJs) => {
				var sentryConfig = this.function.custom.sentry || {};

				// Wrap the original handler and inject Sentry code
				handlerJs = handlerJs.toString("utf8");
				wrapperJs = wrapperJs.toString("utf8")
						.replace(/"use strict";/ig, "")
						.replace(/\$\(CUSTOM\)/ig, JSON.stringify(sentryConfig));

				var js = [ handlerJs, wrapperJs ].join("\n");
				return fs.writeFileAsync(handlerFilePath, js);
			});
		}
	}


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

	return( CodePackageLambda );
};