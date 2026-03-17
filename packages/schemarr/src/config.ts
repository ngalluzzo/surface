import type { SqlDialect } from "./dialect/types";
import type { TransformOptions } from "./transform/types";

// ============================================================
// Top-level configuration
//
// The public API accepts this config to wire together
// the transform options with a dialect.
// ============================================================

/**
 * Full configuration for a JSON Schema → SQL conversion.
 */
export type ConvertConfig = {
	readonly dialect: SqlDialect;
	readonly transform: TransformOptions;
};

/**
 * User-facing config where everything has sensible defaults.
 * Only `dialect` is required.
 */
export type ConvertInput = {
	readonly dialect: SqlDialect;
	readonly transform?: Partial<TransformOptions>;
};
