export type { OperationRegistryWithHooks } from "./define-registry";
export {
	composeRegistries,
	defineRegistry,
	forSurface,
} from "./define-registry";
export type { NormalizedSurfaceBinding } from "./normalize-surface-bindings";
export {
	getSurfaceBindingLookupKey,
	normalizeOperationSurfaceBindings,
	resolveOperationSurfaceBinding,
	normalizeSurfaceBindings,
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
