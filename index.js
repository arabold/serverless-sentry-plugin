'use strict';

/**
 * Serverless Sentry Plugin
 */

module.exports = function(S) {

	const BbPromise = require('bluebird');

	/**
	 * Action instantiation. Used to resemble the SLS core layout to
	 * make it easy to integrate into core later.
	 */
	let CodePackageLambda = require('./lib/actions/CodePackageLambda')(S);
	CodePackageLambda = new CodePackageLambda();

	/**
	 * ServerlessPlugin
	 */

	class ServerlessPlugin extends S.classes.Plugin {

		/**
		 * Constructor
		 */

		constructor() {
			super();
		}

		/**
		 * Define your plugins name
		 */

		static getName() {
			return 'com.serverless.' + ServerlessPlugin.name;
		}

		/**
		 * Register Actions
		 */

		registerActions() {

			return BbPromise.resolve();

		}

		/**
		 * Register Hooks
		 */

		registerHooks() {

			return BbPromise.join(
				CodePackageLambda.registerHooks()
			);

		}

	}

	return ServerlessPlugin;
};
