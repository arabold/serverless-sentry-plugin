import Serverless from "serverless";
import Plugin from "serverless/classes/Plugin";
import Service from "serverless/classes/Service";
import Aws from "serverless/plugins/aws/provider/awsProvider";
export declare type SentryRelease = {
    version: string | boolean;
    refs?: {
        repository: string;
        commit: string;
        previousCommit?: string;
    }[] | false;
};
export declare type SentryOptions = {
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
    sourceMaps?: boolean | {
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
/** Helper type for Serverless functions with an optional `sentry` configuration setting */
declare type FunctionDefinitionWithSentry = Serverless.FunctionDefinition & {
    sentry?: boolean | SentryOptions;
};
/**
 * Serverless Plugin forward Lambda exceptions to Sentry (https://sentry.io)
 */
export declare class SentryPlugin implements Plugin {
    sentry: Partial<SentryOptions>;
    serverless: Serverless;
    options: Serverless.Options;
    custom: Service.Custom;
    hooks: {
        [event: string]: (...rest: any[]) => any;
    };
    provider: Aws;
    validated: boolean;
    isInstrumented: boolean;
    logging: Plugin.Logging;
    constructor(serverless: Serverless, options: Serverless.Options, logging: Plugin.Logging);
    configPlugin(): void;
    validate(): Promise<void>;
    instrumentFunction(originalDefinition: Serverless.FunctionDefinition, setEnv: boolean): FunctionDefinitionWithSentry;
    /**
     *
     * @param setEnv set to `true` to set `process.env`. Useful when invoking the Lambda locally
     */
    instrumentFunctions(setEnv?: boolean): Promise<void>;
    private _resolveGitRefs;
    setRelease(): Promise<void>;
    createSentryRelease(): Promise<void>;
    uploadSentrySourcemaps(): Promise<void>;
    private _uploadSourceMap;
    deploySentryRelease(): Promise<void>;
    private _getApiParameters;
    private _generateRandomVersion;
}
export {};
