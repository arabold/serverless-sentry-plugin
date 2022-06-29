import * as path from "path";

import { PromisePool } from "@supercharge/promise-pool";
import * as AdmZip from "adm-zip";
import * as SemVer from "semver";
import Serverless from "serverless";
import Plugin from "serverless/classes/Plugin";
import Service from "serverless/classes/Service";
import Aws from "serverless/plugins/aws/provider/awsProvider";
import * as request from "superagent";
import { v4 as uuid } from "uuid";

import GitRev from "./git-rev";

export type SentryRelease = {
  version: string | boolean;
  refs?:
    | {
        repository: string;
        commit: string;
        previousCommit?: string;
      }[]
    | false;
};

export type SentryOptions = {
  dsn?: string;
  environment?: string;
  authToken?: string;
  organization?: string;
  project?: string;
  release?: SentryRelease | string | boolean;

  /** Specifies whether this SDK should activate and send events to Sentry (defaults to `true`) */
  enabled?: boolean;
  /** Don't report errors from local environments (defaults to `true`) */
  filterLocal?: boolean;
  /** Enable source maps (defaults to `false`) */
  sourceMaps?:
    | boolean
    | {
        /** Filepath prefix for sourcemaps uploaded to Sentry */
        urlPrefix: string;
      };
  /** Automatically create breadcrumbs (see Sentry SDK docs, default to `true`) */
  autoBreadcrumbs?: boolean;
  /** Capture Lambda errors (defaults to `true`) */
  captureErrors?: boolean;
  /** Capture unhandled Promise rejections (defaults to `true`) */
  captureUnhandledRejections?: boolean;
  /** Capture uncaught exceptions (defaults to `true`) */
  captureUncaughtException?: boolean;
  /** Monitor memory usage (defaults to `true`) */
  captureMemoryWarnings?: boolean;
  /** Monitor execution timeouts (defaults to `true`) */
  captureTimeoutWarnings?: boolean;
};

/** Short form for encoding URI components */
const _e = encodeURIComponent;

/** Helper type for Serverless functions with an optional `sentry` configuration setting */
type FunctionDefinitionWithSentry = Serverless.FunctionDefinition & {
  sentry?: boolean | SentryOptions;
};

/** Required parameters for creating/updating releases in the API */
type ApiParameters = {
  authToken: string;
  organization: string;
  project?: string;
  refs?: SentryRelease["refs"];
  version: string;
};

/**
 * Serverless Plugin forward Lambda exceptions to Sentry (https://sentry.io)
 */
export class SentryPlugin implements Plugin {
  sentry: Partial<SentryOptions>;
  serverless: Serverless;
  options: Serverless.Options;
  custom: Service.Custom;
  hooks: { [event: string]: (...rest: any[]) => any };
  provider: Aws;
  validated: boolean;
  isInstrumented: boolean;

  constructor(serverless: Serverless, options: Serverless.Options) {
    this.serverless = serverless;
    this.options = options;
    this.custom = this.serverless.service.custom;
    this.provider = this.serverless.getProvider("aws");

    // Create schema for our properties. For reference use https://github.com/ajv-validator/ajv
    serverless.configSchemaHandler.defineCustomProperties({
      type: "object",
      properties: {
        sentry: {
          type: "object",
          properties: {
            dsn: { type: "string" },
            environment: { type: "string" },
            authToken: { type: "string" },
            organization: { type: "string" },
            project: { type: "string" },
            release: {
              anyOf: [{ type: "object" }, { type: "string" }, { type: "boolean" }],
            },
            enabled: { type: "boolean" },
            filterLocal: { type: "boolean" },
            sourceMaps: {
              oneOf: [
                { type: "boolean" },
                {
                  type: "object",
                  properties: {
                    urlPrefix: { type: "string" },
                  },
                },
              ],
            },
            autoBreadcrumbs: { type: "boolean" },
            captureErrors: { type: "boolean" },
            captureUnhandledRejections: { type: "boolean" },
            captureUncaughtException: { type: "boolean" },
            captureMemoryWarnings: { type: "boolean" },
            captureTimeoutWarnings: { type: "boolean" },
          },
          required: ["dsn"],
          additionalProperties: false,
        },
      },
      required: ["sentry"],
    });

    this.hooks = {
      "before:package:initialize": async () => this.validate(),

      "after:package:initialize": async () => {
        await this.setRelease();
        await this.instrumentFunctions();
      },

      "before:deploy:deploy": async () => {
        await this.validate();
        await this.setRelease();
        await this.instrumentFunctions();
      },

      "after:deploy:deploy": async () => {
        await this.createSentryRelease();
        await this.uploadSentrySourcemaps();
        await this.deploySentryRelease();
      },

      "before:deploy:function:deploy": async () => {
        await this.validate();
        await this.setRelease();
        await this.instrumentFunctions();
      },

      "after:deploy:function:deploy": async () => {
        await this.createSentryRelease();
        await this.uploadSentrySourcemaps();
        await this.deploySentryRelease();
      },

      "before:invoke:local:invoke": async () => {
        await this.validate();
        await this.setRelease();
        await this.instrumentFunctions(true);
      },

      "before:offline:start": async () => {
        await this.validate();
        await this.setRelease();
        await this.instrumentFunctions();
      },

      "before:offline:start:init": async () => {
        await this.validate();
        await this.setRelease();
        await this.instrumentFunctions();
      },
    };

    this.configPlugin();
  }

  configPlugin(): void {
    this.sentry = {};
    if (typeof this.custom.sentry === "object") {
      Object.assign(this.sentry, this.custom.sentry);
    }
  }

  async validate(): Promise<void> {
    if (this.validated) {
      // Already ran
      return;
    }

    // Check required serverless version
    if (SemVer.gt("1.12.0", this.serverless.getVersion())) {
      throw new Error("Serverless verion must be >= 1.12.0");
    }

    // Set configuration
    this.validated = true;
    this.sentry = { ...(this.serverless.service.custom.sentry || {}) } as Partial<SentryOptions>;

    // Validate Sentry options
    if (!this.sentry.dsn) {
      this.serverless.cli.log("DSN not set. Serverless Sentry plugin is disabled.", "sentry");
    }

    if (this.sentry.enabled === false) {
      this.serverless.cli.log("Serverless Sentry is disabled from provided options.", "sentry");
    }

    // Set default option values
    if (!this.sentry.environment) {
      this.sentry.environment = this.options.stage ?? undefined;
    }

    if (this.sentry.authToken && (!this.sentry.organization || !this.sentry.project)) {
      this.serverless.cli.log(
        "Sentry: In order to use the Sentry API " +
          "make sure to set `organization` and `project` in your `serverless.yml`.",
        "sentry",
      );
      this.sentry.authToken = undefined;
    }
  }

  instrumentFunction(originalDefinition: Serverless.FunctionDefinition, setEnv: boolean): FunctionDefinitionWithSentry {
    const newDefinition: FunctionDefinitionWithSentry = { ...originalDefinition };
    const sentryConfig = { ...this.sentry };
    const localConfig = newDefinition.sentry;
    if (typeof localConfig === "object") {
      Object.assign(sentryConfig, localConfig);
    }

    // Environment variables have to be a string in order to be processed properly
    newDefinition.environment = newDefinition.environment ?? {};
    if (typeof sentryConfig.dsn !== "undefined") {
      newDefinition.environment.SENTRY_DSN = String(sentryConfig.dsn);
      setEnv && (process.env.SENTRY_DSN = newDefinition.environment.SENTRY_DSN);
    }
    if (typeof sentryConfig.release === "object" && sentryConfig.release.version) {
      newDefinition.environment.SENTRY_RELEASE = String(sentryConfig.release.version);
      setEnv && (process.env.SENTRY_RELEASE = newDefinition.environment.SENTRY_RELEASE);
    }
    if (typeof sentryConfig.environment !== "undefined") {
      newDefinition.environment.SENTRY_ENVIRONMENT = String(sentryConfig.environment);
      setEnv && (process.env.SENTRY_ENVIRONMENT = newDefinition.environment.SENTRY_ENVIRONMENT);
    }
    if (typeof sentryConfig.autoBreadcrumbs !== "undefined") {
      newDefinition.environment.SENTRY_AUTO_BREADCRUMBS = String(sentryConfig.autoBreadcrumbs);
      setEnv && (process.env.SENTRY_AUTO_BREADCRUMBS = newDefinition.environment.SENTRY_AUTO_BREADCRUMBS);
    }
    if (typeof sentryConfig.sourceMaps !== "undefined") {
      newDefinition.environment.SENTRY_SOURCEMAPS = JSON.stringify(sentryConfig.sourceMaps);
      setEnv && (process.env.SENTRY_SOURCEMAPS = newDefinition.environment.SENTRY_SOURCEMAPS);
    }
    if (typeof sentryConfig.filterLocal !== "undefined") {
      newDefinition.environment.SENTRY_FILTER_LOCAL = String(sentryConfig.filterLocal);
      setEnv && (process.env.SENTRY_FILTER_LOCAL = newDefinition.environment.SENTRY_FILTER_LOCAL);
    }
    if (typeof sentryConfig.captureErrors !== "undefined") {
      newDefinition.environment.SENTRY_CAPTURE_ERRORS = String(sentryConfig.captureErrors);
      setEnv && (process.env.SENTRY_CAPTURE_ERRORS = newDefinition.environment.SENTRY_CAPTURE_ERRORS);
    }
    if (typeof sentryConfig.captureUnhandledRejections !== "undefined") {
      newDefinition.environment.SENTRY_CAPTURE_UNHANDLED = String(sentryConfig.captureUnhandledRejections);
      setEnv && (process.env.SENTRY_CAPTURE_UNHANDLED = newDefinition.environment.SENTRY_CAPTURE_UNHANDLED);
    }
    if (typeof sentryConfig.captureUncaughtException !== "undefined") {
      newDefinition.environment.SENTRY_CAPTURE_UNCAUGHT = String(sentryConfig.captureUncaughtException);
      setEnv && (process.env.SENTRY_CAPTURE_UNCAUGHT = newDefinition.environment.SENTRY_CAPTURE_UNCAUGHT);
    }
    if (typeof sentryConfig.captureMemoryWarnings !== "undefined") {
      newDefinition.environment.SENTRY_CAPTURE_MEMORY = String(sentryConfig.captureMemoryWarnings);
      setEnv && (process.env.SENTRY_CAPTURE_MEMORY = newDefinition.environment.SENTRY_CAPTURE_MEMORY);
    }
    if (typeof sentryConfig.captureTimeoutWarnings !== "undefined") {
      newDefinition.environment.SENTRY_CAPTURE_TIMEOUTS = String(sentryConfig.captureTimeoutWarnings);
      setEnv && (process.env.SENTRY_CAPTURE_TIMEOUTS = newDefinition.environment.SENTRY_CAPTURE_TIMEOUTS);
    }

    return newDefinition;
  }

  /**
   *
   * @param setEnv set to `true` to set `process.env`. Useful when invoking the Lambda locally
   */
  async instrumentFunctions(setEnv: boolean = false): Promise<void> {
    if (!this.sentry.dsn || this.sentry.enabled === false) {
      return; // Sentry not enabled
    }
    if (this.isInstrumented && !setEnv) {
      return; // already instrumented in a previous step; no need to run again
    }

    const functionNames = this.serverless.service.getAllFunctions();
    const functions = functionNames.reduce((functions, functionName) => {
      const functionObject: FunctionDefinitionWithSentry = this.serverless.service.getFunction(functionName);
      if ((functionObject.sentry ?? true) !== false) {
        process.env.SLS_DEBUG && this.serverless.cli.log(`Instrumenting ${String(functionObject.name)}`, "sentry");
        functions[functionName] = this.instrumentFunction(functionObject, setEnv);
      } else {
        process.env.SLS_DEBUG && this.serverless.cli.log(`Skipping ${String(functionObject.name)}`, "sentry");
      }
      return functions;
    }, {} as { [key: string]: FunctionDefinitionWithSentry });
    this.serverless.service.update({ functions });
    this.isInstrumented = true;
  }

  async _resolveGitRefs(gitRev: GitRev, release: SentryRelease): Promise<SentryRelease> {
    const origin = await gitRev.origin();
    const commit = await gitRev.long();
    let repository = /[:/]([^/]+\/[^/]+?)(?:\.git)?$/i.exec(origin)?.[1];
    if (repository && origin.includes("gitlab")) {
      // GitLab uses spaces around the slashes in the repository name
      repository = repository.replace(/\//g, " / ");
    }

    if (Array.isArray(release.refs)) {
      const refs = release.refs;
      refs.forEach((ref) => {
        if (ref && ref.repository === "git") {
          ref.repository = repository ?? "";
        }
        if (ref && ref.commit === "git") {
          ref.commit = commit;
        }
        if (ref && ref.previousCommit === "git") {
          delete ref.previousCommit; // not available via git
        }
      });
      return { ...release, refs };
    } else {
      return { ...release, refs: undefined };
    }
  }

  async setRelease(): Promise<void> {
    let release: SentryRelease | undefined;
    if (this.sentry.release && typeof this.sentry.release === "string") {
      // Expand to the long form
      release = {
        version: this.sentry.release,
      };
    } else {
      release = this.sentry.release as SentryRelease;
    }

    const version = release?.version;
    if (typeof version === "undefined" || String(version) === "false") {
      // nothing to do
      this.sentry.release = undefined;
      return;
    }

    if (version === true || version === "true" || version === "git") {
      try {
        const gitRev = new GitRev({ cwd: this.serverless.config.servicePath });
        const version = (await gitRev.exactTag()) ?? (await gitRev.short());
        release.version = version;

        if (!release.refs) {
          // By default use git to resolve repository and commit hash
          release.refs = [
            {
              repository: "git",
              commit: "git",
            },
          ];
        }

        release = await this._resolveGitRefs(gitRev, release);
      } catch (err) {
        // No git available.
        if (version === "git") {
          // Error out
          throw new Error(`Sentry: No Git available - ${(err as Error).toString()}`);
        }
        // Fall back to use a random number instead.
        process.env.SLS_DEBUG &&
          this.serverless.cli.log("No Git available. Creating a random release version...", "sentry");
        release.version = this.getRandomVersion();
        release.refs = undefined;
      }
    } else if (version === "random") {
      process.env.SLS_DEBUG && this.serverless.cli.log("Creating a random release version...", "sentry");
      release.version = this.getRandomVersion();
    } else {
      const str = String(version).trim();
      process.env.SLS_DEBUG && this.serverless.cli.log(`Setting release version to "${str}"...`, "sentry");
      release.version = str;
    }

    this.sentry.release = release;
  }

  async createSentryRelease(): Promise<void> {
    const apiParameters = this._apiParameters();
    if (!apiParameters) {
      // Nothing to do
      return;
    }

    const { authToken, project, refs, version, organization } = apiParameters;
    const payload = {
      projects: [project],
      refs,
      version,
    };

    this.serverless.cli.log(`Creating new release "${version}"...: ${JSON.stringify(payload)}`, "sentry");
    try {
      await request
        .post(`https://sentry.io/api/0/organizations/${_e(organization)}/releases/`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(payload);
    } catch (err) {
      if ((err as request.ResponseError)?.response?.text) {
        this.serverless.cli.log(
          `Received error response from Sentry:\n${String((err as request.ResponseError)?.response?.text)}`,
          "sentry",
        );
      }
      throw new Error(`Sentry: Error uploading release - ${(err as Error).toString()}`);
    }
  }

  async uploadSentrySourcemaps(): Promise<void> {
    const apiParameters = this._apiParameters();
    if (!apiParameters || !this.sentry.sourceMaps) {
      // Nothing to do
      return;
    }

    this.serverless.cli.log("Uploading source maps to Sentry", "sentry");

    const artifacts = new Set(
      this.serverless.service
        .getAllFunctions()
        .map((name) => this.serverless.service.getFunction(name).package?.artifact)
        .filter((artifact): artifact is string => typeof artifact === "string"),
    );

    const results: (() => Promise<void>)[] = [];

    artifacts.forEach((artifact) => {
      const zip = new AdmZip(artifact);

      zip.getEntries().forEach((entry) => {
        if ((!entry.isDirectory && entry.name.endsWith(".js")) || entry.name.endsWith(".js.map")) {
          results.push(() => this._uploadSourceMap(entry, apiParameters));
        }
      });
    });

    // Upload artifacts in parallel. 50 parallel web sockets is the default of the AWS JavaScript SDK.
    // see https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/node-configuring-maxsockets.html
    await PromisePool.withConcurrency(50)
      .for(results)
      .process(async (nextArtifact) => await nextArtifact());
  }

  async _uploadSourceMap(entry: AdmZip.IZipEntry, params: ApiParameters): Promise<void> {
    const prefix = typeof this.sentry.sourceMaps === "object" && this.sentry.sourceMaps.urlPrefix;
    const filePath = prefix ? path.join(prefix, entry.entryName) : entry.entryName;
    const data = entry.getData();

    try {
      await request
        .post(`https://sentry.io/api/0/organizations/${_e(params.organization)}/releases/${_e(params.version)}/files/`)
        .set("Authorization", `Bearer ${params.authToken}`)
        .field("name", filePath)
        .attach("file", data, { filename: entry.name });
    } catch (err) {
      const responseError = err as request.ResponseError;

      if (responseError?.response?.status === 409) {
        process.env.SLS_DEBUG && this.serverless.cli.log(`Skipping already uploaded file: ${entry.name}`, "sentry");
        return;
      } else if (responseError?.response?.text) {
        this.serverless.cli.log(
          `Received error response from Sentry:\n${String((err as request.ResponseError)?.response?.text)}`,
          "sentry",
        );
      }

      throw new Error(`Sentry: Error uploading sourcemap file - ${(err as Error).toString()}`);
    }
  }

  async deploySentryRelease(): Promise<void> {
    const apiParameters = this._apiParameters();
    if (!apiParameters || !this.sentry.sourceMaps) {
      // Nothing to do
      return;
    }

    this.serverless.cli.log(`Deploying release "${String(apiParameters.version)}"...`, "sentry");
    try {
      await request
        .post(
          `https://sentry.io/api/0/organizations/${_e(apiParameters.organization)}/releases/${_e(
            apiParameters.version,
          )}/deploys/`,
        )
        .set("Authorization", `Bearer ${apiParameters.authToken}`)
        .send({
          environment: this.sentry.environment,
          name: `Deployed ${this.serverless.service.getServiceName()}`,
        });
    } catch (err) {
      if ((err as request.ResponseError)?.response?.text) {
        this.serverless.cli.log(
          `Received error response from Sentry:\n${String((err as request.ResponseError)?.response?.text)}`,
          "sentry",
        );
      }
      throw new Error(`Sentry: Error deploying release - ${(err as Error).toString()}`);
    }
  }

  _apiParameters(): ApiParameters | undefined {
    if (!this.sentry.dsn || !this.sentry.authToken || !this.sentry.release) {
      // Not configured for API access
      return;
    }

    const organization = this.sentry.organization;
    const release = this.sentry.release;
    if (!organization) {
      throw new Error("Organization not set");
    }
    if (typeof release !== "object" || typeof release?.version !== "string") {
      throw new Error("Release version not set");
    }

    return {
      authToken: this.sentry.authToken,
      organization,
      project: this.sentry.project,
      refs: release.refs,
      version: release.version,
    };
  }

  getRandomVersion(): string {
    return uuid().replace(/-/g, "");
  }
}

module.exports = SentryPlugin;
