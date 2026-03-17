import type { ResolvedObjectDef, ResolvedSchemaIR } from "../parser/types";
import type { InferredRelation } from "./types";

/**
 * Infer relations from a resolved schema.
 *
 * Scans all object definitions (root + definitions) for properties
 * with refTarget and determines the relation kind:
 * - Single ref → one_to_many (default)
 * - Array ref with x-relation: "many-to-many" → many_to_many
 * - Array ref without annotation → depends on defaultArrayRefRelation
 *   and whether target appears in multiple arrays
 */
export const inferRelations = (
	resolved: ResolvedSchemaIR,
	defaultArrayRefRelation: "one_to_many" | "many_to_many" = "one_to_many",
): InferredRelation[] => {
	const relations: InferredRelation[] = [];

	// Collect all object definitions (root + definitions)
	// Use Set to avoid duplicates (in case definition name matches root name)
	const defSet = new Map<string, ResolvedObjectDef>();
	defSet.set(resolved.root.name, resolved.root);
	for (const [name, def] of resolved.definitions) {
		defSet.set(name, def);
	}

	const allDefs = Array.from(defSet.entries()).map(([name, def]) => ({
		name,
		def,
	}));

	// Count how many array refs point to each target definition
	const arrayRefCount = new Map<string, number>();
	for (const { def } of allDefs) {
		for (const prop of def.properties) {
			if (prop.refTarget !== undefined && isArrayRef(prop.schema)) {
				arrayRefCount.set(
					prop.refTarget,
					(arrayRefCount.get(prop.refTarget) ?? 0) + 1,
				);
			}
		}
	}

	// Infer relations for each ref property
	for (const { name: sourceTable, def } of allDefs) {
		for (const prop of def.properties) {
			if (prop.refTarget === undefined) continue;

			const isArray = isArrayRef(prop.schema);
			const isExplicitManyToMany = hasExplicitManyToMany(prop.schema);
			const arrayCount = arrayRefCount.get(prop.refTarget) ?? 0;

			// Determine relation kind
			let kind: "one_to_one" | "one_to_many" | "many_to_many";
			if (isExplicitManyToMany) {
				kind = "many_to_many";
			} else if (isArray) {
				// Array refs: check default option or heuristic
				if (defaultArrayRefRelation === "many_to_many" || arrayCount > 1) {
					kind = "many_to_many";
				} else {
					kind = "one_to_many";
				}
			} else {
				// Single refs: default to one_to_many
				kind = "one_to_many";
			}

			relations.push({
				kind,
				sourceTable,
				sourceProperty: prop.name,
				targetDef: prop.refTarget,
				isRequired: prop.required,
			});
		}
	}

	return relations;
};

/**
 * Check if a schema represents an array reference.
 */
const isArrayRef = (schema: unknown): boolean => {
	if (typeof schema !== "object" || schema === null) return false;
	const s = schema as { type?: unknown; items?: unknown };
	return (
		s.type === "array" &&
		typeof s.items === "object" &&
		s.items !== null &&
		!Array.isArray(s.items)
	);
};

/**
 * Check if a schema has explicit "many-to-many" relation annotation.
 */
const hasExplicitManyToMany = (schema: unknown): boolean => {
	if (typeof schema !== "object" || schema === null) return false;
	const s = schema as { "x-relation"?: unknown };
	return s["x-relation"] === "many-to-many";
};
