/**
 * Token types for SQL CHECK expression parsing.
 */
type TokenType = "identifier" | "operator" | "number" | "string" | "unknown";

/**
 * Token from a SQL CHECK expression.
 */
type Token = {
	type: TokenType;
	value: string;
	position: number;
};

/**
 * Zod refinement types.
 */
export type ZodRefinement =
	| { readonly kind: "min"; readonly value: number }
	| { readonly kind: "max"; readonly value: number }
	| { readonly kind: "gt"; readonly value: number }
	| { readonly kind: "lt"; readonly value: number }
	| { readonly kind: "regex"; readonly pattern: string }
	| { readonly kind: "unsupported"; readonly expression: string };

/**
 * Tokenize a SQL CHECK expression.
 *
 * Handles:
 * - Identifiers (column names)
 * - Operators (>=, <=, >, <, ~, etc.)
 * - Numbers (integers and decimals, including negative)
 * - Strings (single-quoted, with escaped single quotes)
 *
 * Returns an array of tokens in order.
 */
export const tokenize = (expression: string): Token[] => {
	const tokens: Token[] = [];
	let i = 0;
	const n = expression.length;

	while (i < n) {
		const char = expression[i];

		if (char === undefined) continue;

		// Skip whitespace
		if (/\s/.test(char)) {
			i++;
			continue;
		}

		// Identifier (column name)
		if (/[a-zA-Z_]/.test(char)) {
			const start = i;
			while (i < n) {
				const c = expression[i];
				if (c === undefined) break;
				if (!/[0-9a-zA-Z_]/.test(c)) break;
				i++;
			}
			tokens.push({
				type: "identifier",
				value: expression.slice(start, i),
				position: start,
			});
			continue;
		}

		// Multi-character operators
		if (
			expression.slice(i, i + 2) === ">=" ||
			expression.slice(i, i + 2) === "<="
		) {
			tokens.push({
				type: "operator",
				value: expression.slice(i, i + 2),
				position: i,
			});
			i += 2;
			continue;
		}
		const nextExpr = expression[i + 1];
		// Negative number (must come before operator check for '-')
		if (
			nextExpr !== undefined &&
			char === "-" &&
			i + 1 < n &&
			/[0-9]/.test(nextExpr)
		) {
			const start = i;
			i++;
			while (i < n) {
				const c = expression[i];
				if (c === undefined) break;
				if (!/[0-9]/.test(c)) break;
				i++;
			}
			if (i < n && expression[i] === ".") {
				i++;
				while (i < n) {
					const c = expression[i];
					if (c === undefined) break;
					if (!/[0-9]/.test(c)) break;
					i++;
				}
			}
			tokens.push({
				type: "number",
				value: expression.slice(start, i),
				position: start,
			});
			continue;
		}

		// Number (including decimal)
		if (/[0-9]/.test(char)) {
			const start = i;
			while (i < n) {
				const c = expression[i];
				if (c === undefined) break;
				if (!/[0-9]/.test(c)) break;
				i++;
			}
			if (i < n && expression[i] === ".") {
				i++;
				while (i < n) {
					const c = expression[i];
					if (c === undefined) break;
					if (!/[0-9]/.test(c)) break;
					i++;
				}
			}
			tokens.push({
				type: "number",
				value: expression.slice(start, i),
				position: start,
			});
			continue;
		}

		// Single-character operators (excluding '-' which is handled above)
		if ([">", "<", "~", "+", "*", "/", "(", ")", ","].includes(char)) {
			tokens.push({
				type: "operator",
				value: char,
				position: i,
			});
			i++;
			continue;
		}

		// String (single-quoted)
		if (char === "'") {
			const start = i;
			i++;
			let value = "";
			while (i < n) {
				// Handle escaped single quotes ('')
				if (
					expression[i] === "'" &&
					expression[i + 1] !== undefined &&
					expression[i + 1] === "'"
				) {
					value += "'";
					i += 2;
					continue;
				}
				// Handle escaped backslashes (\\)
				if (
					expression[i] === "\\" &&
					expression[i + 1] !== undefined &&
					expression[i + 1] === "\\"
				) {
					value += "\\";
					i += 2;
					continue;
				}
				// Check for closing quote
				if (expression[i] === "'") {
					i++; // Skip closing quote
					break;
				}
				const c = expression[i];
				if (c !== undefined) {
					value += c;
				}
				i++;
			}
			tokens.push({
				type: "string",
				value,
				position: start,
			});
			continue;
		}

		// Unknown token
		tokens.push({
			type: "unknown",
			value: char,
			position: i,
		});
		i++;
	}

	return tokens;
};

/**
 * Parse a SQL CHECK expression into a Zod refinement.
 *
 * Supported patterns:
 * - column >= number  → min
 * - column <= number  → max
 * - column > number   → gt
 * - column < number   → lt
 * - column ~ pattern  → regex
 *
 * Unsupported patterns:
 * - Compound expressions (cost + tax)
 * - Function calls (NOW())
 * - Other operators (BETWEEN, IN, etc.)
 * - Column name mismatch
 * - Invalid value types (boolean where number expected)
 */
export const parseCheckExpression = (
	expression: string,
	columnName: string,
): ZodRefinement => {
	const tokens = tokenize(expression);

	// Check for supported patterns: column op value
	if (tokens.length >= 3) {
		const col = tokens[0];
		const op = tokens[1];
		const val = tokens[2];
		const rest = tokens.slice(3);

		// Check column name matches
		if (col?.type !== "identifier" || col.value !== columnName) {
			return { kind: "unsupported", expression };
		}

		// Check operator type
		if (
			op?.type !== "operator" ||
			![">=", "<=", ">", "<", "~"].includes(op.value)
		) {
			return { kind: "unsupported", expression };
		}

		// Check value type and ensure no extra tokens
		if (!val || (val.type !== "number" && val.type !== "string")) {
			return { kind: "unsupported", expression };
		}

		if (rest.length > 0) {
			return { kind: "unsupported", expression };
		}

		// Parse numeric refinements
		if (val.type === "number") {
			const numValue = parseFloat(val.value);
			if (Number.isNaN(numValue)) {
				return { kind: "unsupported", expression };
			}

			switch (op.value) {
				case ">=":
					return { kind: "min", value: numValue };
				case "<=":
					return { kind: "max", value: numValue };
				case ">":
					return { kind: "gt", value: numValue };
				case "<":
					return { kind: "lt", value: numValue };
				default:
					return { kind: "unsupported", expression };
			}
		}

		// Parse regex refinement
		if (op.value === "~") {
			return { kind: "regex", pattern: `/${val.value}/` };
		}
		return { kind: "unsupported", expression };
	}

	return { kind: "unsupported", expression };
};

/**
 * Convert a Zod refinement to a Zod method call string.
 *
 * Returns null for unsupported refinements.
 */
export const refinementToZod = (refinement: ZodRefinement): string | null => {
	switch (refinement.kind) {
		case "min":
			return `.min(${String(refinement.value)})`;
		case "max":
			return `.max(${String(refinement.value)})`;
		case "gt":
			return `.gt(${String(refinement.value)})`;
		case "lt":
			return `.lt(${String(refinement.value)})`;
		case "regex":
			return `.regex(${refinement.pattern})`;
		case "unsupported":
			return null;
	}
};

/**
 * Order refinements for correct Zod chaining.
 *
 * Order: range (min, max, gt, lt) before pattern (regex).
 */
export const orderRefinements = (
	refinements: ZodRefinement[],
): ZodRefinement[] => {
	const range: ZodRefinement[] = [];
	const pattern: ZodRefinement[] = [];
	const unsupported: ZodRefinement[] = [];

	for (const ref of refinements) {
		switch (ref.kind) {
			case "min":
			case "max":
			case "gt":
			case "lt":
				range.push(ref);
				break;
			case "regex":
				pattern.push(ref);
				break;
			case "unsupported":
				unsupported.push(ref);
				break;
		}
	}

	return [...range, ...pattern, ...unsupported];
};
