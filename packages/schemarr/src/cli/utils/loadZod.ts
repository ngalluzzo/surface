import { basename, extname } from "node:path";
import type { Result } from "../../lib/result";
import { err, ok } from "../../lib/result";

export type LoadZodError = {
	readonly kind: "zod_load_error";
	readonly message: string;
};

export type LoadZodOptions = {
	/** Name of the export to use (if not default export) */
	exportName?: string;
};

/**
 * Load a Zod schema from a TypeScript file.

 * Uses Bun's `import()` API to dynamically load the file,
 * then extracts the specified export (or default export).

 * @param filePath - Path to .ts or .mts file
 * @param options - Options for loading
 * @returns Result with Zod schema or error
 */
export const loadZodFromFile = async (
	filePath: string,
	options: LoadZodOptions = {},
): Promise<Result<unknown, LoadZodError>> => {
	try {
		// Validate file extension
		const ext = extname(filePath);
		if (ext !== ".ts" && ext !== ".mts") {
			return err({
				kind: "zod_load_error",
				message: `File must be a TypeScript file (.ts or .mts), got ${ext}`,
			});
		}

		// Dynamically import the file
		const module = await import(filePath);

		// Get all exports from the module
		const exports = Object.keys(module).filter(
			(key) => !key.startsWith("__") && key !== "default",
		);

		if (exports.length === 0) {
			return err({
				kind: "zod_load_error",
				message: "No exports found in the TypeScript file",
			});
		}

		// Determine which export to use
		let schema: unknown;

		if (options.exportName) {
			// Use specified export name
			schema = module[options.exportName];

			if (schema === undefined) {
				return err({
					kind: "zod_load_error",
					message: `Export '${options.exportName}' not found in ${basename(filePath)}. Available exports: ${exports.join(", ")}`,
				});
			}
		} else {
			// Try to find a schema-like export
			// Priority: Schema, then any export ending in 'Schema'
			const schemaExport = exports.find(
				(name) => name === "Schema" || name.endsWith("Schema"),
			);

			if (schemaExport) {
				schema = module[schemaExport];
			} else if (module.default) {
				// Use default export
				schema = module.default;
			} else {
				// Use first export
				const firstExport = exports[0];
				if (!firstExport) {
					return err({
						kind: "zod_load_error",
						message: "No valid export found",
					});
				}
				schema = module[firstExport];
			}
		}

		// Validate that it looks like a Zod schema
		// Zod schemas have a _def property with a typeName
		const schemaObj = schema as Record<string, unknown>;
		if (
			schema === null ||
			typeof schema !== "object" ||
			!("_def" in schemaObj) ||
			typeof schemaObj._def !== "object"
		) {
			return err({
				kind: "zod_load_error",
				message: `Export does not appear to be a valid Zod schema`,
			});
		}

		return ok(schema);
	} catch (error) {
		return err({
			kind: "zod_load_error",
			message: `Failed to load Zod schema from ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
		});
	}
};
