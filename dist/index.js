"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SentryPlugin = void 0;
var SemVer = require("semver");
var request = require("superagent");
var uuid_1 = require("uuid");
var git_rev_1 = require("./git-rev");
/** Short form for encoding URI components */
var _e = encodeURIComponent;
/**
 * Serverless Plugin forward Lambda exceptions to Sentry (https://sentry.io)
 */
var SentryPlugin = /** @class */ (function () {
    function SentryPlugin(serverless, options) {
        var _this = this;
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
                        sourceMaps: { type: "boolean" },
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
            "before:package:initialize": function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                return [2 /*return*/, this.validate()];
            }); }); },
            "after:package:initialize": function () { return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.setRelease()];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, this.instrumentFunctions()];
                        case 2:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); },
            "before:deploy:deploy": function () { return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.validate()];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, this.setRelease()];
                        case 2:
                            _a.sent();
                            return [4 /*yield*/, this.instrumentFunctions()];
                        case 3:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); },
            "after:deploy:deploy": function () { return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.createSentryRelease()];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, this.deploySentryRelease()];
                        case 2:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); },
            "before:deploy:function:deploy": function () { return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.validate()];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, this.setRelease()];
                        case 2:
                            _a.sent();
                            return [4 /*yield*/, this.instrumentFunctions()];
                        case 3:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); },
            "after:deploy:function:deploy": function () { return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.createSentryRelease()];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, this.deploySentryRelease()];
                        case 2:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); },
            "before:invoke:local:invoke": function () { return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.validate()];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, this.setRelease()];
                        case 2:
                            _a.sent();
                            return [4 /*yield*/, this.instrumentFunctions(true)];
                        case 3:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); },
            "before:offline:start": function () { return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.validate()];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, this.setRelease()];
                        case 2:
                            _a.sent();
                            return [4 /*yield*/, this.instrumentFunctions()];
                        case 3:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); },
            "before:offline:start:init": function () { return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.validate()];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, this.setRelease()];
                        case 2:
                            _a.sent();
                            return [4 /*yield*/, this.instrumentFunctions()];
                        case 3:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); },
        };
        this.configPlugin();
    }
    SentryPlugin.prototype.configPlugin = function () {
        this.sentry = {};
        if (typeof this.custom.sentry === "object") {
            Object.assign(this.sentry, this.custom.sentry);
        }
    };
    SentryPlugin.prototype.validate = function () {
        var _a;
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_b) {
                if (this.validated) {
                    // Already ran
                    return [2 /*return*/];
                }
                // Check required serverless version
                if (SemVer.gt("1.12.0", this.serverless.getVersion())) {
                    throw new Error("Serverless verion must be >= 1.12.0");
                }
                // Set configuration
                this.validated = true;
                this.sentry = __assign({}, (this.serverless.service.custom.sentry || {}));
                // Validate Sentry options
                if (!this.sentry.dsn) {
                    this.serverless.cli.log("DSN not set. Serverless Sentry plugin is disabled.", "sentry");
                }
                if (this.sentry.enabled === false) {
                    this.serverless.cli.log("Serverless Sentry is disabled from provided options.", "sentry");
                }
                // Set default option values
                if (!this.sentry.environment) {
                    this.sentry.environment = (_a = this.options.stage) !== null && _a !== void 0 ? _a : undefined;
                }
                if (this.sentry.authToken && (!this.sentry.organization || !this.sentry.project)) {
                    this.serverless.cli.log("Sentry: In order to use the Sentry API " +
                        "make sure to set `organization` and `project` in your `serverless.yml`.", "sentry");
                    this.sentry.authToken = undefined;
                }
                return [2 /*return*/];
            });
        });
    };
    SentryPlugin.prototype.instrumentFunction = function (originalDefinition, setEnv) {
        var _a;
        var newDefinition = __assign({}, originalDefinition);
        var sentryConfig = __assign({}, this.sentry);
        var localConfig = newDefinition.sentry;
        if (typeof localConfig === "object") {
            Object.assign(sentryConfig, localConfig);
        }
        // Environment variables have to be a string in order to be processed properly
        newDefinition.environment = (_a = newDefinition.environment) !== null && _a !== void 0 ? _a : {};
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
            newDefinition.environment.SENTRY_SOURCEMAPS = String(sentryConfig.sourceMaps);
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
    };
    /**
     *
     * @param setEnv set to `true` to set `process.env`. Useful when invoking the Lambda locally
     */
    SentryPlugin.prototype.instrumentFunctions = function (setEnv) {
        if (setEnv === void 0) { setEnv = false; }
        return __awaiter(this, void 0, void 0, function () {
            var functionNames, functions;
            var _this = this;
            return __generator(this, function (_a) {
                if (!this.sentry.dsn || this.sentry.enabled === false) {
                    return [2 /*return*/]; // Sentry not enabled
                }
                if (this.isInstrumented && !setEnv) {
                    return [2 /*return*/]; // already instrumented in a previous step; no need to run again
                }
                functionNames = this.serverless.service.getAllFunctions();
                functions = functionNames.reduce(function (functions, functionName) {
                    var _a;
                    var functionObject = _this.serverless.service.getFunction(functionName);
                    if (((_a = functionObject.sentry) !== null && _a !== void 0 ? _a : true) !== false) {
                        process.env.SLS_DEBUG && _this.serverless.cli.log("Instrumenting " + String(functionObject.name), "sentry");
                        functions[functionName] = _this.instrumentFunction(functionObject, setEnv);
                    }
                    else {
                        process.env.SLS_DEBUG && _this.serverless.cli.log("Skipping " + String(functionObject.name), "sentry");
                    }
                    return functions;
                }, {});
                this.serverless.service.update({ functions: functions });
                this.isInstrumented = true;
                return [2 /*return*/];
            });
        });
    };
    SentryPlugin.prototype._resolveGitRefs = function (gitRev, release) {
        var _a;
        return __awaiter(this, void 0, void 0, function () {
            var origin, commit, repository, refs;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, gitRev.origin()];
                    case 1:
                        origin = _b.sent();
                        return [4 /*yield*/, gitRev.long()];
                    case 2:
                        commit = _b.sent();
                        repository = (_a = /[:/]([^/]+\/[^/]+?)(?:\.git)?$/i.exec(origin)) === null || _a === void 0 ? void 0 : _a[1];
                        if (repository && origin.includes("gitlab")) {
                            // GitLab uses spaces around the slashes in the repository name
                            repository = repository.replace(/\//g, " / ");
                        }
                        if (Array.isArray(release.refs)) {
                            refs = release.refs;
                            refs.forEach(function (ref) {
                                if (ref && ref.repository === "git") {
                                    ref.repository = repository !== null && repository !== void 0 ? repository : "";
                                }
                                if (ref && ref.commit === "git") {
                                    ref.commit = commit;
                                }
                                if (ref && ref.previousCommit === "git") {
                                    delete ref.previousCommit; // not available via git
                                }
                            });
                            return [2 /*return*/, __assign(__assign({}, release), { refs: refs })];
                        }
                        else {
                            return [2 /*return*/, __assign(__assign({}, release), { refs: undefined })];
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    SentryPlugin.prototype.setRelease = function () {
        var _a;
        return __awaiter(this, void 0, void 0, function () {
            var release, version, gitRev, version_1, _b, err_1, str;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (this.sentry.release && typeof this.sentry.release === "string") {
                            // Expand to the long form
                            release = {
                                version: this.sentry.release,
                            };
                        }
                        else {
                            release = this.sentry.release;
                        }
                        version = release === null || release === void 0 ? void 0 : release.version;
                        if (typeof version === "undefined" || String(version) === "false") {
                            // nothing to do
                            this.sentry.release = undefined;
                            return [2 /*return*/];
                        }
                        if (!(version === true || version === "true" || version === "git")) return [3 /*break*/, 9];
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 7, , 8]);
                        gitRev = new git_rev_1.default({ cwd: this.serverless.config.servicePath });
                        return [4 /*yield*/, gitRev.exactTag()];
                    case 2:
                        if (!((_a = (_c.sent())) !== null && _a !== void 0)) return [3 /*break*/, 3];
                        _b = _a;
                        return [3 /*break*/, 5];
                    case 3: return [4 /*yield*/, gitRev.short()];
                    case 4:
                        _b = (_c.sent());
                        _c.label = 5;
                    case 5:
                        version_1 = _b;
                        release.version = version_1;
                        if (!release.refs) {
                            // By default use git to resolve repository and commit hash
                            release.refs = [
                                {
                                    repository: "git",
                                    commit: "git",
                                },
                            ];
                        }
                        return [4 /*yield*/, this._resolveGitRefs(gitRev, release)];
                    case 6:
                        release = _c.sent();
                        return [3 /*break*/, 8];
                    case 7:
                        err_1 = _c.sent();
                        // No git available.
                        if (version === "git") {
                            // Error out
                            throw new Error("Sentry: No Git available - " + err_1.toString());
                        }
                        // Fall back to use a random number instead.
                        process.env.SLS_DEBUG &&
                            this.serverless.cli.log("No Git available. Creating a random release version...", "sentry");
                        release.version = this.getRandomVersion();
                        release.refs = undefined;
                        return [3 /*break*/, 8];
                    case 8: return [3 /*break*/, 10];
                    case 9:
                        if (version === "random") {
                            process.env.SLS_DEBUG && this.serverless.cli.log("Creating a random release version...", "sentry");
                            release.version = this.getRandomVersion();
                        }
                        else {
                            str = String(version).trim();
                            process.env.SLS_DEBUG && this.serverless.cli.log("Setting release version to \"" + str + "\"...", "sentry");
                            release.version = str;
                        }
                        _c.label = 10;
                    case 10:
                        this.sentry.release = release;
                        return [2 /*return*/];
                }
            });
        });
    };
    SentryPlugin.prototype.createSentryRelease = function () {
        var _a, _b, _c, _d;
        return __awaiter(this, void 0, void 0, function () {
            var organization, project, release, payload, err_2;
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0:
                        if (!this.sentry.dsn || !this.sentry.authToken || !this.sentry.release) {
                            // Nothing to do
                            return [2 /*return*/];
                        }
                        organization = this.sentry.organization;
                        project = this.sentry.project;
                        release = this.sentry.release;
                        payload = {
                            version: release.version,
                            refs: release.refs,
                            projects: [project],
                        };
                        if (!organization) {
                            throw new Error("Organization not set");
                        }
                        if (!(release === null || release === void 0 ? void 0 : release.version)) {
                            throw new Error("Release version not set");
                        }
                        this.serverless.cli.log("Creating new release \"" + String(release.version) + "\"...: " + JSON.stringify(payload), "sentry");
                        _f.label = 1;
                    case 1:
                        _f.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, request
                                .post("https://sentry.io/api/0/organizations/" + _e(organization) + "/releases/")
                                .set("Authorization", "Bearer " + this.sentry.authToken)
                                .send(payload)];
                    case 2:
                        _f.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        err_2 = _f.sent();
                        if ((_b = (_a = err_2) === null || _a === void 0 ? void 0 : _a.response) === null || _b === void 0 ? void 0 : _b.text) {
                            this.serverless.cli.log("Received error response from Sentry:\n" + String((_d = (_c = err_2) === null || _c === void 0 ? void 0 : _c.response) === null || _d === void 0 ? void 0 : _d.text), "sentry");
                        }
                        throw new Error("Sentry: Error uploading release - " + err_2.toString());
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    SentryPlugin.prototype.deploySentryRelease = function () {
        var _a, _b, _c, _d;
        return __awaiter(this, void 0, void 0, function () {
            var organization, release, err_3;
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0:
                        if (!this.sentry.dsn || !this.sentry.authToken || !this.sentry.release) {
                            // Nothing to do
                            return [2 /*return*/];
                        }
                        organization = this.sentry.organization;
                        release = this.sentry.release;
                        if (!organization) {
                            throw new Error("Organization not set");
                        }
                        if (!(release === null || release === void 0 ? void 0 : release.version)) {
                            throw new Error("Release version not set");
                        }
                        this.serverless.cli.log("Deploying release \"" + String(release.version) + "\"...", "sentry");
                        _f.label = 1;
                    case 1:
                        _f.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, request
                                .post("https://sentry.io/api/0/organizations/" + _e(organization) + "/releases/" + _e(release.version) + "/deploys/")
                                .set("Authorization", "Bearer " + this.sentry.authToken)
                                .send({
                                environment: this.sentry.environment,
                                name: "Deployed " + this.serverless.service.getServiceName(),
                            })];
                    case 2:
                        _f.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        err_3 = _f.sent();
                        if ((_b = (_a = err_3) === null || _a === void 0 ? void 0 : _a.response) === null || _b === void 0 ? void 0 : _b.text) {
                            this.serverless.cli.log("Received error response from Sentry:\n" + String((_d = (_c = err_3) === null || _c === void 0 ? void 0 : _c.response) === null || _d === void 0 ? void 0 : _d.text), "sentry");
                        }
                        throw new Error("Sentry: Error deploying release - " + err_3.toString());
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    SentryPlugin.prototype.getRandomVersion = function () {
        return (0, uuid_1.v4)().replace(/-/g, "");
    };
    return SentryPlugin;
}());
exports.SentryPlugin = SentryPlugin;
module.exports = SentryPlugin;
