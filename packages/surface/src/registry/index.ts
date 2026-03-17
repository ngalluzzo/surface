export type { OperationRegistryWithHooks } from "../operation/types";
export {
	composeRegistries,
	defineRegistry,
	forSurface,
} from "./define-registry";
export type {
	NormalizedSurfaceBinding,
	OperationSurfaceBindingUnion,
	RegistrySurfaceBindingUnion,
} from "./normalize-surface-bindings";
export {
	getSurfaceBindingLookupKey,
	normalizeOperationSurfaceBindings,
	normalizeSurfaceBindings,
	resolveOperationSurfaceBinding,
} from "./normalize-surface-bindings";
export type {
	SchemaMetadata,
	SchemaRegistryInstance,
	SchemaRegistryZodRegistry,
} from "./schema-registry";
export {
	createSchemaRegistry,
	defaultRegistry,
	exportSchemas,
	registerOperationSchema,
} from "./schema-registry";
export type {
	BindingValidationIssue,
	BindingValidationIssueCode,
} from "./validate-bindings";
export {
	assertNoBindingValidationIssues,
	BindingValidationError,
	collectDuplicateTargetIssues,
	formatBindingValidationIssue,
	formatBindingValidationIssues,
	validateBindings,
	validateSurfaceBindings,
} from "./validate-bindings";
