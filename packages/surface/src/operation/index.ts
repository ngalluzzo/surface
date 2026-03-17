export type {
	BindingValidationIssue,
	BindingValidationIssueCode,
	NormalizedSurfaceBinding,
	OperationRegistryWithHooks,
	SchemaMetadata,
	SchemaRegistryInstance,
	SchemaRegistryZodRegistry,
} from "../registry";
export {
	assertNoBindingValidationIssues,
	BindingValidationError,
	composeRegistries,
	collectDuplicateTargetIssues,
	createSchemaRegistry,
	defaultRegistry,
	defineRegistry,
	formatBindingValidationIssue,
	formatBindingValidationIssues,
	exportSchemas,
	forSurface,
	getSurfaceBindingLookupKey,
	normalizeOperationSurfaceBindings,
	resolveOperationSurfaceBinding,
	normalizeSurfaceBindings,
	registerOperationSchema,
	validateBindings,
	validateSurfaceBindings,
} from "../registry";
export type { CreateOpsOptions } from "./create-ops";
export { createOps } from "./create-ops";
export { defineGuardPolicy } from "./define-guard-policy";
export { defineOperation } from "./define-operation";
