# ⚡️ Serverless Sentry Plugin

[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com)
[![npm](https://img.shields.io/npm/v/serverless-sentry.svg)](https://www.npmjs.com/package/serverless-sentry)
[![license](https://img.shields.io/github/license/arabold/serverless-sentry-plugin.svg)](https://github.com/arabold/serverless-sentry-plugin/blob/master/LICENSE)
[![dependencies](https://img.shields.io/david/arabold/serverless-sentry-plugin.svg)](https://www.npmjs.com/package/serverless-sentry)


## About
This Serverless plugin simplifies integration of [Sentry](https://sentry.io)
with the popular [Serverless Framework](https://serverless.com) and AWS Lambda.

Currently we support **Node.js 4.3.2**, **Node.js 6.10.2** as well as
**Python** running on AWS Lambda. Other platforms can be added by
providing a respective integration library. Pull Requests are welcome!


### What is Raven and Sentry?
It's a bit confusing, but _Raven_ is the official name of the error reporting
SDK that will forward errors, exceptions and messages to the _Sentry_ server.
For more details of what Raven and Sentry actually is, refer to the official
Sentry documentation: https://docs.sentry.io/.

The Serverless Sentry plugin and library is not affiliated with either Sentry or
Serverless but developed independently and in my spare time.


### Benefits

* Easy to use.
* Integrates with [Serverless Framework](http://www.serverless.com) for AWS Lambda.
* Wraps your Node.js and Python code with [Sentry](http://sentry.io) error capturing.
* Forwards any errors returned by your AWS Lambda function to Sentry.
* Warn if your code is about to hit the execution timeout limit.
* Warn if your Lambda function is low on memory.
* Catches and reports unhandled exceptions.
* Automated release creation and deployment notifications for Sentry.
* Serverless, Sentry and as well as this library are all Open Source. Yay! 🎉


## Overview

Sentry integration splits into two components:

1. This plugin which simplifies installation with the Serverless Framework
2. The [serverless-sentry-lib](https://github.com/arabold/serverless-sentry-lib)
   which performs the runtime monitoring and error reporting.

For a detailed overview of how to use the
[serverless-sentry-lib](https://github.com/arabold/serverless-sentry-lib) refer
to its [README.md](https://github.com/arabold/serverless-sentry-lib/blob/master/README.md).


## Installation

* Install the `node-raven` module as a _production dependency_ (so it gets
  packaged together with your source code):
  ```bash
  npm install --save raven
  ```

* Install the [serverless-sentry-lib](https://github.com/arabold/serverless-sentry-lib)
  as a _production dependency_ as well:
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
and will create release and deployment information for you (if wanted).
This is the recommended way of using the `serverless-sentry-lib` library.

### ▶️ Step 1: Load the Plugin
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

### ▶️ Step 2: Wrap Your Function Handler Code

The actual reporting to Sentry happens in platform specific libraries. Currently
only Node.js and Python are supported.

Each library provides a `RavenLambdaWrapper` helper that act as decorators
around your original AWS Lambda handler code and is configured via this
plugin or manually through environment variables.

For more details refer to the individual libraries' repositories:

* Node.js: [serverless-sentry-lib](https://github.com/arabold/serverless-sentry-lib)
* Python: [Netflix-Skunkworks/raven-python-lambda](https://github.com/Netflix-Skunkworks/raven-python-lambda)


#### Node.js
Import `RavenLambdaWrapper` from the `serverless-sentry-lib` Node.js module
and pass in your `Raven` client as shown below - that's it.
Passing in your own client is necessary to ensure that the wrapper uses
the same environment as the rest of your code. In the rare circumstances that
this isn't desired, you can pass in `null` instead.

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


#### Python 🐍
Import `RavenLambdaWrapper` from the `raven-python-lambda` module as shown
below:

**Original Lambda Handler Code Before Adding RavenLambdaWrapper**:
```python
def handler(event, context):
    print("Go Serverless! Your function executed successfully")
```

**New Lambda Handler Code With RavenLambdaWrapper For Sentry Reporting**
```python
from raven import Client # Offical `raven` module
from raven-python-lambda import RavenLambdaWrapper

@RavenLambdaWrapper()
def handler(event, context):
    print("Go Serverless! Your function executed successfully")
```

For more details about the Python integration refer to official repository
at [Netflix-Skunkworks/raven-python-lambda](https://github.com/Netflix-Skunkworks/raven-python-lambda)


## Plugin Configuration Options
Configure the Sentry plugin using the following options in your
`serverless.yml`:

* `dsn` - Your Sentry project's DSN url (required)
* `environment` - Explicitly set the Sentry environment (defaults to the
  Serverless stage)

### Sentry API access
In order for some features such as releases and deployments to work,
you need to grant API access to this plugin by setting the following options:

  * `organization` - Organization name
  * `project` - Project name
  * `authToken` - API authentication token with `project:write` access

👉 **Important**: You need to make sure you’re using
[Auth Tokens](https://docs.sentry.io/api/auth/#auth-tokens) not API Keys,
which are deprecated.


### Releases
Releases are used by Sentry to provide you with additional context when
determining the cause of an issue. The plugin can automatically create releases
for you and tag all messages accordingly. To find out more about releases in
Sentry, refer to the
[official documentation](https://docs.sentry.io/learn/releases/).

In order to enable release tagging, you need to set the `release` option in
your `serverless.yml`:

```yaml
custom:
  sentry:
    dsn: https://xxxx:yyyy@sentry.io/zzzz
    organization: my-sentry-organziation
    project: my-sentry-project
    authToken: my-sentry-api-key
    release:
      version: <RELEASE VERSION>
      refs:
        - repository: <REPOSITORY NAME>
          commit: <COMMIT HASH>
          previousCommit: <COMMIT HASH>
```

* `version` - Set the release version used in Sentry. Use any of the below
  values:
  - `git` - Uses the current git commit hash or tag as release identifier.
  - `random` - Generates a random release during deployment.
  - `true` - First tries to determine the release via `git` and falls back
    to `random` if Git is not available.
  - `false` - Disable release versioning.
  - any fixed string - Use a fixed string for the release. Serverless variables
    are allowed.

* `refs` - If you have set up Sentry to collect commit data, you can use commit
  refs to associate your commits with your Sentry releases. Refer to the
  [Sentry Documentation](https://docs.sentry.io/learn/releases/) for details
  about how to use commit refs. If you set your `version` to `git` (or `true`),
  the `refs` options are populated automatically and don't need to be set.

If you don't specify any refs, you can also use the short notation for `release`
and simply set it to the desired release version as follows:

```yaml
custom:
  sentry:
    dsn: https://xxxx:yyyy@sentry.io/zzzz
    release: <RELEASE VERSION>
```

If you don't need or want the plugin to create releases and deployments, you can
omit the `authToken`, `organization` and `project` options. Messages and
exceptions sent by your Lambda functions will still be tagged with the release
version and show up grouped in Sentry nonetheless.

👉 **Pro Tip:** The possibility to use a fixed string in combination with
Serverless variables allows you to inject your release version through the
command line, e.g. when running on your continuous integration machine.

```yaml
custom:
  sentry:
    dsn: https://xxxx:yyyy@sentry.io/zzzz
    organization: my-sentry-organziation
    project: my-sentry-project
    authToken: my-sentry-api-key
    release:
      version: ${opt:sentryVersion}
      refs:
        - repository: ${opt:sentryRepository}
          commit: ${opt:sentryCommit}
```

And then deploy your project using the command line options from above:

```bash
sls deploy --sentryVersion 1.0.0 --sentryRepository foo/bar --sentryCommit 2da95dfb
```

👉 **Tip when using Sentry with multiple projects:** Releases in Sentry are
specific to the organization and can span multiple projects. Take this in
consideration when choosing a version name. If your version applies to the
current project only, you should prefix it with your project name.

If no option for `release` is provided, releases and deployments are _disabled_.


### Enabling and Disabling Error Reporting Features
In addition you can configure the Sentry error reporting on a service as well
as a per-function level. For more details about the individual configuration
options see the [serverless-sentry-lib documentation](https://github.com/arabold/serverless-sentry-lib/blob/master/README.md).

* `autoBreadcrumbs` - Automatically create breadcrumbs (see Sentry Raven docs, defaults to `true`)
* `filterLocal` - Don't report errors from local environments (defaults to `true`)
* `captureErrors` - Capture Lambda errors (defaults to `true`)
* `captureUnhandledRejections` - Capture unhandled exceptions (defaults to `true`)
* `captureMemoryWarnings` - Monitor memory usage (defaults to `true`)
* `captureTimeoutWarnings` - Monitor execution timeouts (defaults to `true`)

### Example Configuration

```yaml
service: my-serverless-project
provider:
  # ...
plugins:
  serverless-sentry
custom:
  sentry:
    dsn: https://xxxx:yyyy@sentry.io/zzzz # URL provided by Sentry
    captureTimeoutWarnings: false # disable timeout warnings globally for all functions
functions:
  FuncFoo:
    handler: Foo.handler
    description: Hello World
    sentry:
      captureErrors: false # Disable error capturing for this specific function only
      captureTimeoutWarnings: true # Turn timeout warnings back on
  FuncBar:
    handler: Bar.handler
    sentry: false # completely turn off Sentry reporting
```


## Troubleshooting

### No errors are reported in Sentry
Double check the DSN settings in your `serverless.yml` and compare it with what
Sentry shows you in your project settings under "Client Keys (DSN)".
You need a URL in the following format - see the
[Sentry Quick Start](https://docs.sentry.io/quickstart/#configure-the-dsn):
```
{PROTOCOL}://{PUBLIC_KEY}:{SECRET_KEY}@{HOST}/{PATH}{PROJECT_ID}
```

Also make sure to add the plugin to your plugins list in the `serverless.yml`:

```yaml
plugins:
  serverless-sentry
custom:
  sentry:
    dsn: https://xxxx:yyyy@sentry.io/zzzz # URL provided by Sentry
```

### The plugin doesn't create any releases or deployments
Make sure to set the `authToken`, `organization` as well as `project` options
in your `serverless.yml`, and set `release` to a non-empty value as shown in
the example below:

```yaml
plugins:
  serverless-sentry
custom:
  sentry:
    dsn: https://xxxx:yyyy@sentry.io/zzzz # URL provided by Sentry
    organization: my-sentry-organziation
    project: my-sentry-project
    authToken: my-sentry-api-key
    release: git
```

### When using Raven in my code, exception logs are missing details or an error is thrown during runtime
This typically happens if you forgot to pass in the original Raven instance to
the `RavenLambdaWrapper`. If you pass in `null` instead, then the
`serverless-sentry-lib` will ultimately use a different instance of Raven than
the rest of your code. This is typically not what you want. Make sure to pass
in the Raven instance during initialization of the `RavenLambdaWrapper` as shown
in the examples above.

### Raven throws an uncaught error: Cannot read property 'user' of undefined
Raven is not initialized correctly. If you use `raven-node` directly you must
either pass in the `Raven` class to the `RavenLambdaWrapper.handler()` function
as shown in step 2 above, or manually initialize your instance of the raven
module.

### I'm testing my Raven integration locally but no errors or messages are reported
Check out the `filterLocal` configuration setting. If you test Raven locally and
want to make sure your messages are sent, set this flag to `false`. Once done
testing, don't forget to switch it back to `true` as otherwise you'll spam your
Sentry projects with meaningless errors of local code changes.


## Version History

### 1.0.0-rc.4
* Fixed an issue with creating random version numbers

### 1.0.0-rc.3

* Allow disabling Sentry for specific functions by settings `sentry: false` in
  the `serverless.yml`.
* Added support for the [Serverless Offline Plugin](https://github.com/dherault/serverless-offline).

### 1.0.0-rc.2

* Fixed an issue with the plugin not being initialized properly when deploying
  an existing artifact.

### 1.0.0-rc.1

* First official release of this plugin for use with Serverless 1.x
* For older versions of this plugin that work with Serverless 0.5, see
  https://github.com/arabold/serverless-sentry-plugin/tree/serverless-0.5

### To-Dos

- [ ] Bring back automatic instrumentation of the Lambda code during packaging
- [ ] Optionally upload external source-maps to Sentry
- [ ] Provide CLI commands to create releases and perform other operations in
      Sentry
- [ ] Ensure all exceptions and messages have been sent to Sentry before
      returning; see [#338](https://github.com/getsentry/raven-node/issues/338).
