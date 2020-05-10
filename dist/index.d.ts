import Serverless from "serverless";
import Plugin from "serverless/classes/Plugin";
import Service from "serverless/classes/Service";
import Aws from "serverless/plugins/aws/provider/awsProvider";
import GitRev from "./git-rev";
export declare type SentryRelease = {
    version: string | boolean;
    refs?: {
        repository: string;
        commit: string;
        previousCommit?: string;
    }[] | false;
};
export declare type SentryOptions = {
    dsn: string;
    environment?: string;
    authToken?: string;
    organization?: string;
    project?: string;
    release?: SentryRelease | string | boolean;
    /** Don't report errors from local environments (defaults to `true`) */
    filterLocal?: boolean;
    /** Enable source maps (defaults to `false`) */
    sourceMaps?: boolean;
    /** Automatically create breadcrumbs (see Sentry SDK docs, default to `true`) */
    autoBreadcrumbs?: boolean;
    /** Capture Lambda errors (defaults to `true`) */
    captureErrors?: boolean;
    /** Capture unhandled exceptions (defaults to `true`) */
    captureUnhandledRejections?: boolean;
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
    constructor(serverless: Serverless, options: Serverless.Options);
    configPlugin(): void;
    validate(): Promise<void>;
    instrumentFunction(originalDefinition: Serverless.FunctionDefinition): FunctionDefinitionWithSentry;
    instrumentFunctions(): Promise<void>;
    _resolveGitRefs(gitRev: GitRev, release: SentryRelease): Promise<SentryRelease>;
    setRelease(): Promise<void>;
    createSentryRelease(): Promise<void>;
    deploySentryRelease(): Promise<void>;
    getRandomVersion(): string;
}
export {};
