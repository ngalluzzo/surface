export type {
	NormalizedSurfaceBinding,
	OperationRegistryWithHooks,
	SchemaMetadata,
	SchemaRegistryInstance,
	SchemaRegistryZodRegistry,
} from "../registry";
export {
	composeRegistries,
	createSchemaRegistry,
	defaultRegistry,
	defineRegistry,
	exportSchemas,
	forSurface,
	getSurfaceBindingLookupKey,
	normalizeOperationSurfaceBindings,
	resolveOperationSurfaceBinding,
	normalizeSurfaceBindings,
	registerOperationSchema,
} from "../registry";
export type { CreateOpsOptions } from "./create-ops";
export { createOps } from "./create-ops";
export { defineGuardPolicy } from "./define-guard-policy";
export { defineOperation } from "./define-operation";
