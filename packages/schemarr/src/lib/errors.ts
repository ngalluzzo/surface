// ============================================================
// Error types (discriminated union)
//
// Every error in the pipeline is typed and tagged with `kind`.
// This lets consumers pattern-match on errors without instanceof.
// ============================================================

export type ParseError =
	| {
			readonly kind: "invalid_json";
			readonly message: string;
	  }
	| {
			readonly kind: "invalid_schema";
			readonly message: string;
			readonly path?: string;
	  }
	| {
			readonly kind: "missing_type";
			readonly path: string;
	  }
	| {
			readonly kind: "unsupported_schema_version";
			readonly version: string;
	  }
	| {
			readonly kind: "unrepresentable_type";
			readonly zodType: string;
	  };

export type RefError =
	| {
			readonly kind: "unresolved_ref";
			readonly ref: string;
			readonly path: string;
	  }
	| {
			readonly kind: "circular_ref";
			readonly refs: readonly string[];
	  };

export type TransformError =
	| {
			readonly kind: "unsupported_type";
			readonly jsonSchemaType: string;
			readonly path: string;
	  }
	| {
			readonly kind: "ambiguous_relation";
			readonly message: string;
			readonly path: string;
	  };

export type EmitError =
	| {
			readonly kind: "unknown_column_type";
			readonly columnType: string;
	  }
	| {
			readonly kind: "invalid_identifier";
			readonly identifier: string;
	  };

/**
 * Union of all pipeline errors.
 * Used as the E in Result<T, ConvertError> for the top-level API.
 */
export type ConvertError = ParseError | RefError | TransformError | EmitError;

// --- Constructors ---

export const parseError = {
	invalidJson: (message: string): ParseError => ({
		kind: "invalid_json",
		message,
	}),
	invalidSchema: (message: string, path?: string): ParseError => ({
		kind: "invalid_schema",
		message,
		...(path !== undefined && { path }),
	}),
	missingType: (path: string): ParseError => ({
		kind: "missing_type",
		path,
	}),
	unsupportedVersion: (version: string): ParseError => ({
		kind: "unsupported_schema_version",
		version,
	}),
	unrepresentableType: (zodType: string): ParseError => ({
		kind: "unrepresentable_type",
		zodType,
	}),
};

export const refError = {
	unresolved: (ref: string, path: string): RefError => ({
		kind: "unresolved_ref",
		ref,
		path,
	}),
	circular: (refs: readonly string[]): RefError => ({
		kind: "circular_ref",
		refs,
	}),
};

export const transformError = {
	unsupportedType: (jsonSchemaType: string, path: string): TransformError => ({
		kind: "unsupported_type",
		jsonSchemaType,
		path,
	}),
	ambiguousRelation: (message: string, path: string): TransformError => ({
		kind: "ambiguous_relation",
		message,
		path,
	}),
};

export const emitError = {
	unknownColumnType: (columnType: string): EmitError => ({
		kind: "unknown_column_type",
		columnType,
	}),
	invalidIdentifier: (identifier: string): EmitError => ({
		kind: "invalid_identifier",
		identifier,
	}),
};
