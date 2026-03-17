// Result

// Execution
export { execute, getHooks, testOperation } from "./execution";
export type { Result } from "./execution/result";
export { err, ok } from "./execution/result";
// Idempotency
export type { IdempotencyStore } from "./idempotency";
export {
	createInMemoryIdempotencyStore,
	executeWithIdempotency,
} from "./idempotency";
export type {
	CreateOpsOptions,
	NormalizedSurfaceBinding,
	OperationRegistryWithHooks,
	SchemaMetadata,
	SchemaRegistryInstance,
	SchemaRegistryZodRegistry,
} from "./operation";
// Define & registry & createOps
export {
	composeRegistries,
	createOps,
	createSchemaRegistry,
	defaultRegistry,
	defineGuardPolicy,
	defineOperation,
	defineRegistry,
	exportSchemas,
	forSurface,
	getSurfaceBindingLookupKey,
	normalizeOperationSurfaceBindings,
	resolveOperationSurfaceBinding,
	normalizeSurfaceBindings,
	registerOperationSchema,
} from "./operation";
// Types
export type {
	AnyOperation,
	CliSurfaceConfig,
	CronSurfaceConfig,
	DefaultContext,
	DomainGuard,
	EventSurfaceConfig,
	ExecutionError,
	ExecutionMeta,
	ExecutionState,
	ExposeSurface,
	GraphQLSurfaceConfig,
	GuardError,
	GuardOrPolicy,
	GuardOverride,
	GuardPolicy,
	GuardSuccess,
	HttpSurfaceConfig,
	JobSurfaceConfig,
	LifecycleHooks,
	McpSurfaceConfig,
	Operation,
	OperationMeta,
	OperationRegistry,
	Phase,
	Surface,
	SurfaceBindingConfigMap,
	SurfaceBindings,
	SurfaceConfigMap,
	SurfaceContext,
	SurfaceGuard,
	WebhookSurfaceConfig,
	WsSurfaceConfig,
} from "./operation/types";
export type {
	BuildHttpHandlersOptions,
	BuildWebhookHandlersOptions,
	BuildWsHandlersOptions,
	CronDefinitionLike,
	CronDefinitionOptions,
	CronSchedulerLike,
	EventConsumerDefinition,
	EventTransportLike,
	HttpHandler,
	HttpRequest,
	HttpResponse,
	JobDefinitionLike,
	JobDefinitionOptions,
	JobRunnerLike,
	McpServerLike,
	McpToolDefinition,
	RegisterEventConsumersOptions,
	RunCliOptions,
	SubscriptionHubLike,
	WebhookHandler,
	WebhookRequest,
	WebhookResponse,
	WsConnectionLike,
	WsHandlers,
	WsMessage,
	WsResponse,
} from "./surfaces";
// Surfaces
export {
	buildEventMapFromRegistry,
	buildGraphQLSchema,
	buildHttpHandlers,
	buildHttpMapFromRegistry,
	buildMcpServer,
	buildWebhookHandlers,
	buildWsHandlers,
	createSubscriptionHub,
	NonRetryableError,
	registerCronOperations,
	registerEventConsumers,
	registerJobOperations,
	runCli,
} from "./surfaces";
