# ⚡️ Serverless Sentry Plugin

[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com)
[![npm](https://img.shields.io/npm/v/serverless-sentry.svg)](https://www.npmjs.com/package/serverless-sentry)
[![license](https://img.shields.io/github/license/arabold/serverless-sentry-plugin.svg)](https://github.com/arabold/serverless-sentry-plugin/blob/master/LICENSE)
[![dependencies](https://img.shields.io/david/arabold/serverless-sentry-plugin.svg)](https://www.npmjs.com/package/serverless-sentry)

## About

This Serverless plugin simplifies the integration of [Sentry](https://sentry.io)](https://sentry.io) with the popular [Serverless Framework](https://serverless.com) and AWS Lambda.

Currently, we support [Lambda Runtimes for Node.js 12, 14, and 16](https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html) for AWS Lambda. Other platforms can be added by providing a respective integration library. Pull Requests are welcome!

The `serverless-sentry-plugin` and `serverless-sentry-lib` libraries are not affiliated with either Functional Software Inc., Sentry, Serverless or Amazon Web Services but developed independently and in my spare time.

### Benefits

- Easy to use. Promised 🤞
- Integrates with [Serverless Framework](http://www.serverless.com) as well as the [AWS Serverless Application Model](https://aws.amazon.com/serverless/sam/) for AWS Lambda (though no use of any framework is required).
- Wraps your Node.js code with [Sentry](http://getsentry.com) error capturing.
- Forwards any errors returned by your AWS Lambda function to Sentry.
- Warn if your code is about to hit the execution timeout limit.
- Warn if your Lambda function is low on memory.
- Reports unhandled promise rejections.
- Reports uncaught exceptions.
- Serverless, Sentry and as well as this library are all Open Source. Yay! 🎉
- TypeScript support

## Overview

Sentry integration splits into two components:

1. This plugin, which simplifies installation with the Serverless Framework
2. The [serverless-sentry-lib](https://github.com/arabold/serverless-sentry-lib), which performs the runtime monitoring and error reporting.

For a detailed overview of how to use the
[serverless-sentry-lib](https://github.com/arabold/serverless-sentry-lib) refer
to its [README.md](https://github.com/arabold/serverless-sentry-lib/blob/master/README.md).

## Installation

- Install the `@sentry/node` module as a _production dependency_ (so it gets packaged together with your source code):

  ```sh
  npm install --save @sentry/node
  ```

- Install the [serverless-sentry-lib](https://github.com/arabold/serverless-sentry-lib) as a _production dependency_ as well:

  ```sh
  npm install --save serverless-sentry-lib
  ```

- Install this plugin as a _development dependency_ (you don't want to package it with your release artifacts):

  ```sh
  npm install --save-dev serverless-sentry
  ```

- Check out the examples below on how to integrate it with your project
  by updating `serverless.yml` as well as your Lambda handler code.

## Usage

The [Serverless Sentry Plugin](https://github.com/arabold/serverless-sentry-plugin) allows configuration of the library through the `serverless.yml`
and will create release and deployment information for you (if wanted). This is the recommended way of using the `serverless-sentry-lib` library.

### ▶️ Step 1: Load the Plugin

The plugin determines your environment during deployment and adds the
`SENTRY_DSN` environment variables to your Lambda function. All you need to
do is to load the plugin and set the `dsn` configuration option as follows:

```yaml
service: my-serverless-project
provider:
  # ...
plugins:
  - serverless-sentry
custom:
  sentry:
    dsn: https://xxxx:yyyy@sentry.io/zzzz # URL provided by Sentry
```

### ▶️ Step 2: Wrap Your Function Handler Code

The actual reporting to Sentry happens in platform-specific libraries. Currently, only Node.js and Python are supported.

Each library provides a `withSentry` helper that acts as decorators around your original AWS Lambda handler code and is configured via this plugin or manually through environment variables.

For more details refer to the individual libraries' repositories:

- Node.js: [serverless-sentry-lib](https://github.com/arabold/serverless-sentry-lib)

Old, now unsupported libraries:

- Python: [Netflix-Skunkworks/raven-python-lambda](https://github.com/Netflix-Skunkworks/raven-python-lambda)

#### Node.js

For maximum flexibility, this library is implemented as a wrapper around your original AWS Lambda handler code (your `handler.js` or similar function). The `withSentry` higher-order function adds error and exception handling and takes care of configuring the Sentry client automatically.

`withSentry` is pre-configured to reasonable defaults and doesn't need any configuration. It will automatically load and configure `@sentry/node` which needs to be installed as a peer dependency.

**Original Lambda Handler Code**:

```js
exports.handler = async function (event, context) {
  console.log("EVENT: \n" + JSON.stringify(event, null, 2));
  return context.logStreamName;
};
```

**New Lambda Handler Code Using `withSentry` For Sentry Reporting**

```js
const withSentry = require("serverless-sentry-lib"); // This helper library

exports.handler = withSentry(async function (event, context) {
  console.log("EVENT: \n" + JSON.stringify(event, null, 2));
  return context.logStreamName;
});
```

**ES6 Module: Original Lambda Handler Code**:

```ts
export async function handler(event, context) {
  console.log("EVENT: \n" + JSON.stringify(event, null, 2));
  return context.logStreamName;
}
```

**ES6 Module: New Lambda Handler Code Using `withSentry` For Sentry Reporting**

```ts
import withSentry from "serverless-sentry-lib"; // This helper library

export const handler = withSentry(async (event, context) => {
  console.log("EVENT: \n" + JSON.stringify(event, null, 2));
  return context.logStreamName;
});
```

Once your Lambda handler code is wrapped in `withSentry`, it will be extended with automatic error reporting. Whenever your Lambda handler sets an error response, the error is forwarded to Sentry with additional context information. For more details about the different configuration options available refer to the [serverless-sentry-lib documentation](https://github.com/arabold/serverless-sentry-lib/blob/master/README.md).

## Plugin Configuration Options

Configure the Sentry plugin using the following options in your
`serverless.yml`:

- `dsn` - Your Sentry project's DSN URL (required)
- `enabled` - Specifies whether this SDK should activate and send events to Sentry (defaults to `true`)
- `environment` - Explicitly set the Sentry environment (defaults to the
  Serverless stage)

### Sentry API access

In order for some features such as releases and deployments to work,
you need to grant API access to this plugin by setting the following options:

- `organization` - Organization name
- `project` - Project name
- `authToken` - API authentication token with `project:write` access

👉 **Important**: You need to make sure you’re using
[Auth Tokens](https://docs.sentry.io/api/auth/#auth-tokens) not API Keys, which are deprecated.

### Releases

Releases are used by Sentry to provide you with additional context when determining the cause of an issue. The plugin can automatically create releases for you and tag all messages accordingly. To find out more about releases in
Sentry, refer to the [official documentation](https://docs.sentry.io/learn/releases/).

In order to enable release tagging, you need to set the `release` option in your `serverless.yml`:

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

- `version` - Set the release version used in Sentry. Use any of the below values:

  - `git` - Uses the current git commit hash or tag as release identifier.
  - `random` - Generates a random release during deployment.
  - `true` - First tries to determine the release via `git` and falls back to `random` if Git is not available.
  - `false` - Disable release versioning.
  - any fixed string - Use a fixed string for the release. Serverless variables are allowed.

- `refs` - If you have set up Sentry to collect commit data, you can use commit refs to associate your commits with your Sentry releases. Refer to the [Sentry Documentation](https://docs.sentry.io/learn/releases/) for details about how to use commit refs. If you set your `version` to `git` (or `true`), the `refs` options are populated automatically and don't need to be set.

👉 **Tip {"refs":["Invalid repository names: xxxxx/yyyyyyy"]}:** If your repository provider is not supported by Sentry (currently only GitHub or [Gitlab with Sentry Integrations](https://docs.sentry.io/product/integrations/gitlab/)) you have the following options:

1.  set `refs: false`, this will not automatically population the refs but also dismisses your commit id as version
2.  set `refs: true` and `version: true` to populate the version with the commit short id

If you don't specify any refs, you can also use the short notation for `release` and simply set it to the desired release version as follows:

```yaml
custom:
  sentry:
    dsn: https://xxxx:yyyy@sentry.io/zzzz
    release: <RELEASE VERSION>
```

If you don't need or want the plugin to create releases and deployments, you can omit the `authToken`, `organization` and `project` options. Messages and exceptions sent by your Lambda functions will still be tagged with the release version and show up grouped in Sentry nonetheless.

👉 **Pro Tip:** The possibility to use a fixed string in combination with Serverless variables allows you to inject your release version through the command line, e.g. when running on your continuous integration machine.

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

And then deploy your project using the command-line options from above:

```sh
sls deploy --sentryVersion 1.0.0 --sentryRepository foo/bar --sentryCommit 2da95dfb
```

👉 **Tip when using Sentry with multiple projects:** Releases in Sentry are specific to the organization and can span multiple projects. Take this in consideration when choosing a version name. If your version applies to the current project only, you should prefix it with your project name.

If no option for `release` is provided, releases and deployments are _disabled_.

### Source Maps

Sourcemap files can be uploaded to Sentry to display source files in the stack traces rather than the compiled versions. This only uploads existing files
being output, you'll need to configure your bundling tool separately. You'll also need to have releases configured, see above.

Default options:

```yaml
custom:
  sentry:
    sourceMaps: true
```

Add custom prefix (required if your app is not at the filesystem root)

```yaml
custom:
  sentry:
    sourceMaps:
      urlPrefix: /var/task
```

### Enabling and Disabling Error Reporting Features

In addition, you can configure the Sentry error reporting on a service as well as a per-function level. For more details about the individual configuration options see the [serverless-sentry-lib documentation](https://github.com/arabold/serverless-sentry-lib/blob/master/README.md).

- `autoBreadcrumbs` - Automatically create breadcrumbs (see Sentry Raven docs, defaults to `true`)
- `filterLocal` - Don't report errors from local environments (defaults to `true`)
- `captureErrors` - Capture Lambda errors (defaults to `true`)
- `captureUnhandledRejections` - Capture unhandled Promise rejections (defaults to `true`)
- `captureUncaughtException` - Capture unhandled exceptions (defaults to `true`)
- `captureMemoryWarnings` - Monitor memory usage (defaults to `true`)
- `captureTimeoutWarnings` - Monitor execution timeouts (defaults to `true`)

### Example Configuration

```yaml
# serverless.yml
service: my-serverless-project
provider:
  # ...
plugins:
  - serverless-sentry
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

### Example: Configuring Sentry based on stage

In some cases, it might be desired to use a different Sentry configuration depending on the currently deployed stage. To make this work we can use a built-in [Serverless variable resolutions trick](https://forum.serverless.com/t/conditional-serverless-yml-based-on-stage/1763):

```yaml
# serverless.yml
plugins:
  - serverless-sentry
custom:
  config:
    default:
      sentryDsn: ""
    prod:
      sentryDsn: "https://xxxx:yyyy@sentry.io/zzzz" # URL provided by Sentry

  sentry:
    dsn: ${self:custom.config.${self:provider.stage}.sentryDsn, self:custom.config.default.sentryDsn}
    captureTimeoutWarnings: false # disable timeout warnings globally for all functions
```

## Troubleshooting

### No errors are reported in Sentry

Double-check the DSN settings in your `serverless.yml` and compare it with what Sentry shows you in your project settings under "Client Keys (DSN)". You need a URL in the following format - see the [Sentry Quick Start](https://docs.sentry.io/quickstart/#configure-the-dsn):

```
{PROTOCOL}://{PUBLIC_KEY}:{SECRET_KEY}@{HOST}/{PATH}{PROJECT_ID}
```

Also, make sure to add the plugin to your plugins list in the `serverless.yml`:

```yaml
plugins:
  - serverless-sentry
custom:
  sentry:
    dsn: https://xxxx:yyyy@sentry.io/zzzz # URL provided by Sentry
```

### The plugin doesn't create any releases or deployments

Make sure to set the `authToken`, `organization` as well as `project` options in your `serverless.yml`, and set `release` to a non-empty value as shown in the example below:

```yaml
plugins:
  - serverless-sentry
custom:
  sentry:
    dsn: https://xxxx:yyyy@sentry.io/zzzz # URL provided by Sentry
    organization: my-sentry-organziation
    project: my-sentry-project
    authToken: my-sentry-api-key
    release: git
```

### I'm testing my Sentry integration locally but no errors or messages are reported

Check out the `filterLocal` configuration setting. If you test Sentry locally and want to make sure your messages are sent, set this flag to `false`. Once done testing, don't forget to switch it back to `true` as otherwise, you'll spam your Sentry projects with meaningless errors of local code changes.

## Version History

### 2.5.0

- Added support for uploading Source Maps to Sentry. Thanks to [jonmast](https://github.com/jonmast) for the contribution.
- Fixed an issue in the configuration validation. Thanks to [DonaldoLog](https://github.com/DonaldoLog) for the fix.
- Updated dependencies.

### 2.4.0

- Explicitly check for `enabled` flag. Thanks to [aaronbannin](https://github.com/aaronbannin) for the contribution.
- Explicit peer dependency on Serverless
- Updated dependencies minor versions; locked TypeScript to 4.4 for now

### 2.3.0

- Added configuration validation. Serverless will now warn if you pass an invalid configuration value in `custom.sentry`.

### 2.2.0

- Added `captureUncaughtException` configuration option. This already exists in `serverless-sentry-lib` but was never exposed in the plugin.
- Don't fail if `SENTRY_DSN` is not set but simply disable Sentry integration.

### 2.1.0

- Support for deploying individual functions only (`sls deploy -f MyFunction`). Thanks to [dominik-meissner](https://github.com/dominik-meissner)!
- Improved documentation. Thanks to [aheissenberger](https://github.com/aheissenberger)
- Updated dependencies.

### 2.0.2

- Fixed custom release names not being set. Thanks to [botond-veress](https://github.com/botond-veress)!

### 2.0.1

- Fixed error when creating new Sentry releases. Thanks to [dryror](https://github.com/dryror)!

### 2.0.0

- This version of `serverless-sentry-plugin` requires the use of `serverless-sentry-lib` v2.x.x
- Rewrite using TypeScript. The use of TypeScript in your project is fully optional, but if you do, we got you covered!
- Added new default uncaught exception handler.
- Dropped support for Node.js 6 and 8. The only supported versions are Node.js 10 and 12.
- Upgrade from Sentry SDK `raven` to the _Unified Node.js SDK_ [`@sentry/node`](https://docs.sentry.io/error-reporting/configuration/?platform=node).
- Simplified integration using `withSentry` higher-order function. Passing the Sentry instance is now optional.
- Thank you [@aheissenberger](https://github.com/aheissenberger) and [@Vadorequest](https://github.com/Vadorequest) for their contributions to this release! 🤗

### 1.2.0

- Fixed a compatibility issue with Serverless 1.28.0.

### 1.1.1

- Support for `sls invoke local`. Thanks to [sifrenette](https://github.com/sifrenette)
  for his contribution.

### 1.1.0

- ⚠️ Dropped support for Node 4.3. AWS deprecates Node 4.3 starting July 31, 2018.
- Pair with `serverless-sentry-lib` v1.1.x.

### 1.0.0

- Version falls back to git hash if no tag is set for the current head (#15).
- Fixed reporting bugs in the local environment despite config telling otherwise (#17).
  This requires an update of `serverless-sentry-lib` as well!

### 1.0.0-rc.4

- Fixed an issue with creating random version numbers

### 1.0.0-rc.3

- Allow disabling Sentry for specific functions by settings `sentry: false` in
  the `serverless.yml`.
- Added support for the [Serverless Offline Plugin](https://github.com/dherault/serverless-offline).

### 1.0.0-rc.2

- Fixed an issue with the plugin not being initialized properly when deploying
  an existing artifact.

### 1.0.0-rc.1

- First official release of this plugin for use with Serverless 1.x
- For older versions of this plugin that work with Serverless 0.5, see
  https://github.com/arabold/serverless-sentry-plugin/tree/serverless-0.5

### To-Dos

- [ ] Bring back automatic instrumentation of the Lambda code during packaging
- [ ] Provide CLI commands to create releases and perform other operations in Sentry
- [ ] Ensure all exceptions and messages have been sent to Sentry before returning; see [#338](https://github.com/getsentry/raven-node/issues/338).

### Support

That you for supporting me and my projects.

[![](https://www.paypalobjects.com/en_US/i/btn/btn_donateCC_LG.gif)](https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=8Q53B78GGYQAJ&currency_code=USD&source=url)
