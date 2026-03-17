import type { ColumnIR, ConstraintIR } from "../../lib/types";
import type { ZodRefinement } from "./parseCheckExpression";
import {
	orderRefinements,
	parseCheckExpression,
	refinementToZod,
} from "./parseCheckExpression";
import { mapTypeToZod } from "./typeMap";

export type EmitFieldContext = {
	readonly checks: readonly (ConstraintIR & { kind: "check" })[];
};

const formatLiteralValue = (value: string | number | boolean): string => {
	if (typeof value === "string") {
		return `"${value}"`;
	}
	return String(value);
};

export const emitField = (col: ColumnIR, ctx: EmitFieldContext): string => {
	const parts: string[] = [];

	const baseType = mapTypeToZod(col.type);
	parts.push(baseType);

	const refinements: ZodRefinement[] = [];
	for (const check of ctx.checks) {
		const refinement = parseCheckExpression(check.expression, col.name);
		refinements.push(refinement);
	}

	const orderedRefinements = orderRefinements(refinements);
	const hasRegex = orderedRefinements.some((ref) => ref.kind === "regex");
	for (const ref of orderedRefinements) {
		const zodCall = refinementToZod(ref);
		if (zodCall !== null) {
			parts.push(zodCall);
		}
	}

	if (col.nullable) {
		parts.push(".nullable()");
	}
	if (col.default?.kind === "literal") {
		parts.push(`.default(${formatLiteralValue(col.default.value)})`);
	}
	if (col.nullable && !col.default) {
		parts.push(".optional()");
	}

	if (hasRegex) {
		const multiLineParts: string[] = [];
		const firstPart = parts[0];

		if (firstPart) {
			let remaining = firstPart;
			const firstDotIndex = remaining.indexOf(".");
			if (firstDotIndex !== -1) {
				multiLineParts.push(remaining.slice(0, firstDotIndex));
				remaining = remaining.slice(firstDotIndex);
			} else {
				multiLineParts.push(remaining);
				remaining = "";
			}

			let match = remaining.match(/\.[a-zA-Z_]+\([^)]*\)/);
			while (match?.[0]) {
				const methodCall = match[0];
				multiLineParts.push(methodCall);
				remaining = remaining.slice(methodCall.length);
				match = remaining.match(/\.[a-zA-Z_]+\([^)]*\)/);
			}

			if (remaining) {
				multiLineParts.push(remaining);
			}
		}

		for (let i = 1; i < parts.length; i++) {
			const part = parts[i];
			if (part) {
				multiLineParts.push(part);
			}
		}

		return multiLineParts.join("\n    ");
	}

	return parts.join("");
};
