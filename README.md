# serverless-sentry-plugin

[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com)

This plugin adds automatic forwarding of errors and exceptions to Sentry (getsentry.com) to Serverless 0.5.x.


## Overview
The plugin lets you forward errors and exceptions in your Lambda code to Sentry (getsentry.com) without
requiring any code changes.

**IMPORTANT:** Currently this plugin only supports the `nodejs` and `nodejs4.3` runtimes.
Any help to add Python support is appreciated.


## Installation

1. Install the plugin module.

   `npm install serverless-sentry-plugin --save` will install the latest version of the plugin.

   If you want to debug, you also can reference the source repository at a specific version or branch
   with `npm install https://github.com/arabold/serverless-sentry-plugin#<tag or branch name>`

2. Install the `raven` module to forward exceptions to Sentry.

   `npm install raven --save`

   If you use a different `package.json` for your source code than for your project itself, then make
   sure to add `raven` there. 

3. Set the `SENTRY_DSN` as well as the `SERVERLESS_*` environment variables.

   Open up your `s-function.json` and make sure to set the following environment variables. Without
   `SENTRY_DSN` set the plugin will not report any errors.
   ```
   {
     "name": "test-function",
     "runtime": "nodejs4.3",
     "handler": "handler.handler",
     "timeout": 6,
     "memorySize": 1024,
     "custom": {},
     "environment": {
       "SERVERLESS_PROJECT_NAME": "${project}",
       "SERVERLESS_STAGE": "${stage}",
       "SERVERLESS_REGION": "${region}",
       "SENTRY_DSN": "https://*****@app.getsentry.com/76507"
     }
   }
   ```

4. Activate the plugin in your Serverless project.

   Add `serverless-sentry-plugin` to the plugins array in your `s-project.json`.
   ```
   {
     "name": "my-project",
     "custom": {},
     "plugins": [
       "serverless-sentry-plugin"
     ]
   }
   ```


## Usage

### Function Deploy
The plugin automatically hooks into `serverless function deploy` and does not require
any manual invocation.


## How It Works
The plugin injects code into the generated `_serverless_handler.js` Lambda entry point and
extends it with automatic error reporting. Whenever your Lambda handler sets an error response, it is
forwarded to Sentry with additional context information.

### Development
To avoid false reporting, the plugin will only run on an AWS environment, not on local development machines.

### Use With Serverless Optimizer Plugin
The current version 0.3.0 of `lsmod` has a small bug that prevents the use of this plugin in
combination with the [Serverless Optimizer Plugin](https://github.com/serverless/serverless-optimizer-plugin).
Until a fix is released feel free to use a patched [Raven Module](https://github.com/arabold/raven-node).

For minified projects with a large code base and many dependencies the `raven` reported might fail 
to publish events to Sentry. This seems to be due to a bug with the serialization of messages. As a workaround
please _disable minification for your project_.


## Releases

### 0.1.0
* Initial release

### To Dos
* Create releases in Sentry when functions are deployed
* Automatic upload of source map files to Sentry
* Add support for Python runtime
