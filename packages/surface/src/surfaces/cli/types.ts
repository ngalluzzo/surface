import type { SchemaRegistryZodRegistry } from "../../registry/schema-registry";

export interface RunCliOptions {
	/** Use this registry for schema→JSON Schema when parsing argv. Defaults to the package default. */
	schemaRegistry?: { registry: SchemaRegistryZodRegistry };
}
