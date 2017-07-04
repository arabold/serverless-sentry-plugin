# ⚡️ Serverless Sentry Plugin

[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com)
[![npm](https://img.shields.io/npm/v/serverless-sentry.svg)](https://www.npmjs.com/package/serverless-sentry)
[![license](https://img.shields.io/github/license/arabold/serverless-sentry-plugin.svg)](https://github.com/arabold/serverless-sentry-plugin/blob/master/LICENSE)
[![dependencies](https://img.shields.io/david/arabold/serverless-sentry-plugin.svg)](https://www.npmjs.com/package/serverless-sentry)

This plugin simplifies automatic forwarding of errors and exceptions to Sentry
(sentry.io) to Serverless 1.x.


## Overview

Sentry integration splits into two components:

1. This plugin which simplifies installation with the Serverless Framework
2. The [serverless-sentry-lib](https://github.com/arabold/serverless-sentry-lib)
   which does the heavy lifting.

For a detailed overview of how to use the
[serverless-sentry-lib](https://github.com/arabold/serverless-sentry-lib)
refer to its [README.md](https://github.com/arabold/serverless-sentry-lib/blob/master/README.md).

## Installation

* Install the `node-raven` module as a production dependency:
  ```bash
  npm install --save raven
  ```
* Install the [serverless-sentry-lib](https://github.com/arabold/serverless-sentry-lib)
  as a production dependency:
  ```bash
  npm install --save serverless-sentry-lib
  ```
* Install this plugin as a _development dependency_ (you don't want to package
  it with your release artifacts):
  ```bash
  npm install --save-dev serverless-sentry
  ```
* Check out the examples below how to integrate it with your project
  by updating `serverless.yml` as well as your Lambda handler code.

## Usage
The [Serverless Sentry Plugin](https://github.com/arabold/serverless-sentry-plugin)
allows configuration of the library through the `serverless.yml`
and will upload your source-maps automatically during deployment (if wanted).
This is the recommended way of using the `serverless-sentry-lib` library.

### Step 1: Load the Plugin
The plugin determines your environment during deployment and adds the
`SENTRY_DSN` environment variables to your Lambda function. All you need to
do is to load the plugin and set the `dsn` configuration option as follows:

```yaml
service: my-serverless-project
provider:
  # ...
plugins:
  serverless-sentry
custom:
  sentry:
    dsn: https://xxxx:yyyy@sentry.io/zzzz # URL provided by Sentry
```

#### Configuration Options
Configure the Sentry plugin using the following options in your
`serverless.yml`:

* `dsn` - Your Sentry project's DSN url (required)
* `release` - Explicitly set a Sentry release (defaults to your current git
  commit hash or a random number if git is not available)
* `environment` - Explicitly set the Sentry environment (defaults to the
  Serverless stage)

#### Source Map Support
In case you're generating external source-maps (e.g. using Webpack) and want
those to be available in Sentry, set the following options:

* `organization` - Organization name
* `project` - Project name
* `authToken` - API authentication token with `project:write` access
* `sourcemaps` - An array of source map locations (glob format) to upload to
  Sentry during deployment. Set this if you use the
  [Serverless Webpack Plugin](https://github.com/elastic-coders/serverless-webpack)
  or Babel to transpile your code.

#### Enabling and Disabling Error Reporting Features
In addition you can configure the Sentry error reporting on a service as well
as a per-function level. For more details about the individual configuration
options see the [serverless-sentry-lib documentation](https://github.com/arabold/serverless-sentry-lib/blob/master/README.md).

* `autoBreadcrumbs` - Automatically create breadcrumbs (see Sentry Raven docs, defaults to `true`)
* `filterLocal` - Don't report errors from local environments (defaults to `true`)
* `captureErrors` - Capture Lambda errors (defaults to `true`)
* `captureUnhandledRejections` - Capture unhandled exceptions (defaults to `true`)
* `captureMemoryWarnings` - Monitor memory usage (defaults to `true`)
* `captureTimeoutWarnings` - Monitor execution timeouts (defaults to `true`)

#### Example Configuration

```yaml
service: my-serverless-project
provider:
  # ...
plugins:
  serverless-sentry
custom:
  sentry:
    dsn: https://xxxx:yyyy@sentry.io/zzzz # URL provided by Sentry
    organization: my-sentry-organziation
    project: my-sentry-project
    authToken: my-sentry-api-key
    sourcemaps:
      - 'dist/**/*.map'
functions:
  HelloWorld:
    handler: hello.handler
    description: Hello World
    sentry:
      captureErrors: false # Disable error capturing for this specific function only
```


### Step 2: Wrap Your Function Handler Code
`serverless-sentry-lib` acts as a wrapper around your original AWS Lambda
handler code (your `handler.js` or similar). The `RavenLambdaWrapper` adds
error and exception handling, and takes care of configuring the Raven client
automatically.

The `RavenLambdaWrapper` is pre-configured to reasonable defaults and
doesn't need much setup. Simply pass in your Raven client to the wrapper
function as shown below - that's it. Passing in your own `Raven` client is
necessary to ensure that the wrapper uses the same environment as the rest
of your code. In the rare circumstances that this isn't desired, you can
pass in `null` instead.

**Original Lambda Handler Code Before Adding RavenLambdaWrapper**:
```js
"use strict";

module.exports.hello = function(event, context, callback) {
  callback(null, { message: 'Go Serverless! Your function executed successfully!', event });
};
```

**New Lambda Handler Code With RavenLambdaWrapper For Sentry Reporting**
```js
"use strict";

const Raven = require("raven"); // Official `raven` module
const RavenLambdaWrapper = require("serverless-sentry-lib");

module.exports.hello = RavenLambdaWrapper.handler(Raven, (event, context, callback) => {
  callback(null, { message: 'Go Serverless! Your function executed successfully!', event });
});
```

For more details about the different configuration options available refer to
the [serverless-sentry-lib documentation](https://github.com/arabold/serverless-sentry-lib/blob/master/README.md).


## Version History

### 1.0.0-rc.1
* First official release of this plugin for use with Serverless 1.x
* For older versions of this plugin that work with Serverless 0.5, see
  https://github.com/arabold/serverless-sentry-plugin/tree/serverless-0.5
