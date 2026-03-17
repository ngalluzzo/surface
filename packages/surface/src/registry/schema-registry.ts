import { z } from "zod";
import type { AnyOperation, DefaultContext, Surface } from "../operation/types";

/**
 * Metadata shape for operation schemas in the Zod registry.
 * Used by {@link createSchemaRegistry} and for JSON Schema / codegen.
 */
export interface SchemaMetadata {
	id: string;
	title: string;
	description?: string;
	version?: number;
	surfaces?: Array<Surface>;
	domain?: string;
}

/** Type of a Zod metadata registry instance. */
export type SchemaRegistryZodRegistry = ReturnType<typeof z.registry>;

/**
 * Schema registry instance — register operations and export JSON Schema.
 * Create via {@link createSchemaRegistry}. Optional: pass to {@link createOps}
 * so that defineOperation registers each operation's schema here.
 */
export interface SchemaRegistryInstance {
	/** Zod registry for toJSONSchema(..., { metadata: instance.registry }) */
	readonly registry: SchemaRegistryZodRegistry;
	/** Register an operation's schema. Called by defineOperation when using createOps({ schemaRegistry }). Accepts any context. */
	register<C extends DefaultContext>(op: AnyOperation<C>): void;
	/** Export all registered schemas as a JSON Schema document. */
	exportSchemas(
		target?: "draft-2020-12" | "openapi-3.0",
	): Record<string, unknown>;
}

/**
 * Creates an instance-based schema registry. Use when you want to control
 * which operations are registered (e.g. pass to createOps({ schemaRegistry })).
 */
export function createSchemaRegistry(): SchemaRegistryInstance {
	const schemaIndex = new Map<
		string,
		{
			schema: z.ZodType;
			outputSchema: z.ZodType;
			outputChunkSchema?: z.ZodType;
			meta: SchemaMetadata;
		}
	>();
	const registry = z.registry<SchemaMetadata>();

	return {
		registry,
		register<C extends DefaultContext>(op: AnyOperation<C>): void {
			const surfaces = Object.keys(op.expose) as Array<Surface>;
			const domain = op.name.split(".")[0] ?? op.name;
			const meta: SchemaMetadata = {
				id: op.name,
				title: op.name,
				...(op.description !== undefined && { description: op.description }),
				...(op.version !== undefined && { version: op.version }),
				surfaces,
				domain,
			};
			op.schema.register(registry, meta);
			const outputMeta: SchemaMetadata = {
				...meta,
				id: `${op.name}.output`,
				title: `${op.name}.output`,
			};
			op.outputSchema.register(registry, outputMeta);
			if (op.outputChunkSchema != null) {
				const chunkMeta: SchemaMetadata = {
					...meta,
					id: `${op.name}.outputChunk`,
					title: `${op.name}.outputChunk`,
				};
				op.outputChunkSchema.register(registry, chunkMeta);
			}
			schemaIndex.set(op.name, {
				schema: op.schema,
				outputSchema: op.outputSchema,
				...(op.outputChunkSchema != null && {
					outputChunkSchema: op.outputChunkSchema,
				}),
				meta,
			});
		},
		exportSchemas(target: "draft-2020-12" | "openapi-3.0" = "draft-2020-12") {
			const entries = [...schemaIndex.entries()].flatMap(
				([id, { schema, outputSchema, outputChunkSchema }]) => {
					const base = [
						[id, schema] as const,
						[`${id}.output`, outputSchema] as const,
					];
					if (outputChunkSchema != null) {
						base.push([`${id}.outputChunk`, outputChunkSchema] as const);
					}
					return base;
				},
			);
			return z.toJSONSchema(z.object(Object.fromEntries(entries)), {
				target,
				metadata: registry,
			}) as Record<string, unknown>;
		},
	};
}

const defaultSchemaRegistry = createSchemaRegistry();

/**
 * Registers an operation's schema into the default registry.
 * Called automatically by standalone {@link defineOperation} when not using createOps({ schemaRegistry }).
 */
export function registerOperationSchema<C extends DefaultContext>(
	op: AnyOperation<C>,
): void {
	defaultSchemaRegistry.register(op);
}

/**
 * Exports all schemas from the default registry as JSON Schema.
 */
export function exportSchemas(
	target: "draft-2020-12" | "openapi-3.0" = "draft-2020-12",
) {
	return defaultSchemaRegistry.exportSchemas(target);
}

/** Default Zod registry (from default schema registry). */
export const defaultRegistry = defaultSchemaRegistry.registry;
