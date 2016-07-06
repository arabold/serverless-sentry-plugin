"use strict";

// Variables injected through CodePackageLambda.js:
/* globals $, CUSTOM */


if (process.env.SENTRY_DSN) {
	var raven = require("raven");
	var ravenClient = global.sls_raven = new raven.Client(process.env.SENTRY_DSN);

	// Helper function resembling Node's util._extend
	var _extend = function(origin, add) {
		// Don't do anything if add isn't an object
		if (!add || typeof add !== 'object') {
			return origin;
		}

		var keys = Object.keys(add);
		var i = keys.length;
		while (i--) {
			origin[keys[i]] = add[keys[i]];
		}
		return origin;
	};

	var sentryConfigDefaults = {
		captureErrors: true,
		captureUnhandledExceptions: true,
		captureMemoryWarnings: true,
		captureTimeoutWarnings: true
	};

	var sentryConfig = _extend(sentryConfigDefaults, $(CUSTOM));

	ravenClient.setTagsContext({
		Lambda: process.env.AWS_LAMBDA_FUNCTION_NAME,
		Version: process.env.AWS_LAMBDA_FUNCTION_VERSION,
		LogStream: process.env.AWS_LAMBDA_LOG_STREAM_NAME,
		ProjectName: process.env.SERVERLESS_PROJECT_NAME,
		Stage: process.env.SERVERLESS_STAGE,
		Region: process.env.SERVERLESS_REGION
	});

	if (process.env.LAMBDA_TASK_ROOT) {

		var origHandler = exports.handler;
		exports.handler = function(event, context, cb) {

			// This isn't really best practice as we're changing a global object's
			// state. However, due to the nature of Node and Lambda, this shouldn't
			// be an issue, as no Lambda function code is executed in parallel in the
			// same process space.
			ravenClient.setExtraContext({
				Event: event,
				Context: context
			});

			if (typeof context.identity !== "undefined") {
				// Track the caller's Cognito identity
				ravenClient.setUserContext({ cognitoIdentityId: context.identity.cognitoIdentityId });
			}

			var timeRemaining = context.getRemainingTimeInMillis();
			var memoryLimit = context.memoryLimitInMB;
			var memoryWatch, timeoutWarning, timeoutError;

			function timeoutWarningFunc() {
				ravenClient.captureMessage("Execution Time Exceeds " + 
						(Math.ceil(timeRemaining/1000) / 2.0) + " seconds", {
					level: "warning",
					extra: {
						TimeRemainingInMsec: context.getRemainingTimeInMillis()
					}
				});
			}

			function timeoutErrorFunc() {
				ravenClient.captureMessage("Function Timed Out", {
					level: "error"
				});
			}

			function memoryWatchFunc() {
				var used = process.memoryUsage().rss / 1048576;
				var p = (used / memoryLimit);
				if (p >= 0.75) {
					ravenClient.captureMessage("Low Memory Warning", {
						level: "warning",
						extra: {
							MemoryLimitInMB: memoryLimit,
							MemoryUsedInMB: Math.floor(used)
						}
					});

					if (memoryWatch) {
						clearTimeout(memoryWatch);
						memoryWatch = null;
					}
				}
				else {
					memoryWatch = setTimeout(memoryWatchFunc, 500);
				}
			}

			if (sentryConfig.captureTimeoutWarnings) {
				// We schedule the warning at half the maximum execution time and
				// the error a few milliseconds before the actual timeout happens.
				timeoutWarning = setTimeout(timeoutWarningFunc, timeRemaining/2);
				timeoutError = setTimeout(timeoutErrorFunc, Math.max(timeRemaining - 500, 0));
			}

			if (sentryConfig.captureMemoryWarnings) {
				// Schedule memory watch dog interval. Note that we're not using
				// setInterval() here as we don't want invokes to be skipped.
				memoryWatch = setTimeout(memoryWatchFunc, 500);
			}


			// Captures an error and waits for it to be logged in Sentry
			function captureError(err, cb) {
				var onCaptured = function() {
					ravenClient.removeListener("logged", onCaptured);
					ravenClient.removeListener("error",  onCaptured);
					return cb();
				};

				ravenClient.on("logged", onCaptured);
				ravenClient.on("error",  onCaptured);
				if (err instanceof Error) {
					ravenClient.captureException(err);
				}
				else {
					ravenClient.captureMessage(err, { level: "error" });
				}
			}

			function clearTimers() {
				if (timeoutWarning) {
					clearTimeout(timeoutWarning);
					timeoutWarning = null;
				}
				if (timeoutError) {
					clearTimeout(timeoutError);
					timeoutError = null;
				}
				if (memoryWatch) {
					clearTimeout(memoryWatch);
					memoryWatch = null;
				}
			}

			// Wrap a regular callback function and forward any errors to Sentry
			var sentryWrapCb = function(cb) {
				return function sentryCallbackWrapper(err, data) {
					// Clear all timeouts before finishing the function
					clearTimers();

					if (err && (sentryConfig.captureErrors || err.domainThrown)) {
						captureError(err, function() {
							cb(err, data);
						});
					}
					else {
						cb(err, data);
					}
				};
			};

			if (cb) {
				cb = sentryWrapCb(cb);
			}

			var wrappedCtx     = _extend({}, context);
			wrappedCtx.done    = sentryWrapCb(context.done);
			wrappedCtx.fail    = function(err) { wrappedCtx.done(err); };
			wrappedCtx.succeed = function(data) { wrappedCtx.done(null, data); };

			if (sentryConfig.captureUnhandledExceptions) {
				var domain = require("domain").create();
				domain.on("error", function(err) {
					wrappedCtx.fail(err);
				});

				domain.run(function() {
					return origHandler(event, wrappedCtx, cb);
				});
			}
			else {
				return origHandler(event, wrappedCtx, cb);
			}
		};
	}
}
