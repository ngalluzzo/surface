import type { JSONSchema7 } from "json-schema";
import { z } from "zod";
import type { ParseError } from "../lib/errors";
import { parseError } from "../lib/errors";
import type { Result } from "../lib/result";
import { err, ok } from "../lib/result";
import type { ValidatedSchema } from "./types";

const jsonSchemaShape = z
	.object({
		title: z.string().min(1),
		type: z.literal("object"),
	})
	.loose();

/**
 * Validate that raw input is a valid JSON Schema root object.
 *
 * Checks:
 * - Input is a non-null, non-array object
 * - Has `type: "object"`
 * - Has a non-empty `title` string
 */
export const validateSchema = (
	input: unknown,
): Result<ValidatedSchema, ParseError> => {
	if (
		input === null ||
		input === undefined ||
		typeof input !== "object" ||
		Array.isArray(input)
	) {
		return err(parseError.invalidJson("Input must be a non-null object"));
	}

	const record = input as { type?: unknown };

	if (record.type === undefined) {
		return err(parseError.missingType("/"));
	}

	const parsed = jsonSchemaShape.safeParse(input);

	if (!parsed.success) {
		const issue = parsed.error.issues[0];
		const recordForType = input as { type?: unknown };
		if (
			issue?.path !== undefined &&
			Array.isArray(issue.path) &&
			issue.path.includes("type") &&
			typeof recordForType.type === "string"
		) {
			return err(
				parseError.invalidSchema(
					`Root schema must have type "object", got "${recordForType.type}"`,
				),
			);
		}
		return err(parseError.invalidSchema(issue?.message ?? "Invalid schema"));
	}

	return ok({
		title: parsed.data.title,
		schema: input as JSONSchema7,
	});
};
