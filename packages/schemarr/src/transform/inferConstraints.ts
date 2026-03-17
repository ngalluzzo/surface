import type { ConstraintIR } from "../lib/types";
import type { InferConstraintInput, InferConstraintOutput } from "./types";

/**
 * Escape a pattern string for PostgreSQL pattern matching.
 * Single quotes are escaped by doubling them to prevent SQL injection.
 */
const escapePattern = (pattern: string): string => {
	return pattern.replace(/'/g, "''");
};

/**
 * Infer constraints from a JSON Schema property.
 *
 * Constraints are inferred from:
 * - Property named "id" → PRIMARY KEY
 * - Property required flag → Column nullable attribute (returned separately, not in ConstraintIR[])
 * - minimum/maximum/exclusiveMinimum/exclusiveMaximum → CHECK constraint
 * - pattern → CHECK constraint
 * - uniqueItems → UNIQUE constraint
 *
 * Note: NOT NULL is not returned as a ConstraintIR since it's handled
 * via the column's nullable attribute. Use the required flag to set nullable.
 */
export const inferConstraints = (
	input: InferConstraintInput,
): InferConstraintOutput => {
	const {
		propertyName,
		columnName,
		tableName,
		schema,
		startingCheckCount = 0,
	} = input;
	const constraints: ConstraintIR[] = [];
	let checkCount = startingCheckCount;

	// PRIMARY KEY for property named "id" (case-insensitive)
	if (propertyName.toLowerCase() === "id") {
		constraints.push({
			kind: "primary_key",
			name: `${tableName}_pkey`,
			columns: [columnName],
		});
	}

	// CHECK constraints for numeric boundaries
	const hasExclusiveMinimum = schema.exclusiveMinimum !== undefined;
	const hasMinimum = schema.minimum !== undefined;

	if (hasMinimum && !hasExclusiveMinimum) {
		const min = schema.minimum;
		constraints.push({
			kind: "check",
			name: `${tableName}_${columnName}_check_${String(++checkCount)}`,
			expression: `${columnName} >= ${String(min)}`,
		});
	}

	if (schema.maximum !== undefined && schema.exclusiveMaximum === undefined) {
		const max = schema.maximum;
		constraints.push({
			kind: "check",
			name: `${tableName}_${columnName}_check_${String(++checkCount)}`,
			expression: `${columnName} <= ${String(max)}`,
		});
	}

	if (schema.exclusiveMinimum !== undefined) {
		const exclMin = schema.exclusiveMinimum;
		if (typeof exclMin === "boolean") {
			if (schema.minimum !== undefined) {
				const min = schema.minimum;
				constraints.push({
					kind: "check",
					name: `${tableName}_${columnName}_check_${String(++checkCount)}`,
					expression: `${columnName} > ${String(min)}`,
				});
			}
		} else {
			constraints.push({
				kind: "check",
				name: `${tableName}_${columnName}_check_${String(++checkCount)}`,
				expression: `${columnName} > ${String(exclMin)}`,
			});
		}
	}

	if (schema.exclusiveMaximum !== undefined) {
		const exclMax = schema.exclusiveMaximum;
		if (typeof exclMax === "boolean") {
			if (schema.maximum !== undefined) {
				const max = schema.maximum;
				constraints.push({
					kind: "check",
					name: `${tableName}_${columnName}_check_${String(++checkCount)}`,
					expression: `${columnName} < ${String(max)}`,
				});
			}
		} else {
			constraints.push({
				kind: "check",
				name: `${tableName}_${columnName}_check_${String(++checkCount)}`,
				expression: `${columnName} < ${String(exclMax)}`,
			});
		}
	}

	// CHECK constraint for pattern
	if (schema.pattern !== undefined) {
		constraints.push({
			kind: "check",
			name: `${tableName}_${columnName}_check_${String(++checkCount)}`,
			expression: `${columnName} ~ '${escapePattern(schema.pattern)}'`,
		});
	}

	// CHECK constraint for minLength
	if (schema.minLength !== undefined) {
		constraints.push({
			kind: "check",
			name: `${tableName}_${columnName}_check_${String(++checkCount)}`,
			expression: `char_length(${columnName}) >= ${String(schema.minLength)}`,
		});
	}

	// UNIQUE constraint for uniqueItems
	if (schema.uniqueItems === true) {
		constraints.push({
			kind: "unique",
			name: `${tableName}_${columnName}_key`,
			columns: [columnName],
		});
	}

	return { constraints, nextCheckCount: checkCount };
};
