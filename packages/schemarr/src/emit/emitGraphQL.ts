import {
	GraphQLBoolean,
	GraphQLEnumType,
	GraphQLFloat,
	GraphQLInputObjectType,
	type GraphQLInputType,
	GraphQLInt,
	GraphQLList,
	type GraphQLNamedType,
	GraphQLNonNull,
	GraphQLObjectType,
	type GraphQLOutputType,
	GraphQLString,
} from "graphql";
import type { JSONSchema7, JSONSchema7Definition } from "json-schema";
import type { ResolvedObjectDef, ResolvedSchemaIR } from "../parser/types";

export type EmitGraphQLOptions = {
	/** Prefix for generated type names (e.g. operation name). */
	namePrefix?: string;
	/** Build input types (GraphQLInputObjectType) or output types (GraphQLObjectType). */
	mode: "input" | "output";
};

export type EmitGraphQLResult = {
	/** Root type (input or output depending on mode). */
	rootType: GraphQLInputType | GraphQLOutputType;
	/** All named types built (root + definitions). Useful for schema validation. */
	typeMap: Map<string, GraphQLNamedType>;
};

const isJSONSchema7 = (s: JSONSchema7Definition): s is JSONSchema7 =>
	typeof s === "object" && s !== null && !Array.isArray(s);

function safeName(name: string): string {
	return name.replace(/\W/g, "_");
}

/**
 * Build GraphQL type for a single property from JSON Schema.
 * Handles refTarget (use cached definition type), scalars, enum, object, array.
 */
function propertySchemaToGraphQL(
	propName: string,
	propSchema: JSONSchema7Definition,
	required: boolean,
	refTarget: string | undefined,
	cache: Map<string, GraphQLNamedType>,
	mode: "input" | "output",
	namePrefix: string,
	definitions: ReadonlyMap<string, ResolvedObjectDef>,
): GraphQLInputType | GraphQLOutputType {
	const wrapNonNull = <T extends GraphQLInputType | GraphQLOutputType>(
		t: T,
		isRequired: boolean,
	): T => (isRequired ? (new GraphQLNonNull(t) as unknown as T) : t);

	if (refTarget !== undefined) {
		const refType = cache.get(refTarget);
		if (!refType)
			throw new Error(`GraphQL type not found for $ref: ${refTarget}`);
		return wrapNonNull(
			refType as GraphQLInputType & GraphQLOutputType,
			required,
		);
	}

	if (!isJSONSchema7(propSchema)) {
		return wrapNonNull(GraphQLString, required); // fallback
	}

	if (propSchema.enum && Array.isArray(propSchema.enum)) {
		const values = propSchema.enum.filter(
			(v): v is string => typeof v === "string",
		);
		const enumName = `${namePrefix}_${safeName(propName)}_Enum`;
		if (!cache.has(enumName)) {
			const gqlEnum = new GraphQLEnumType({
				name: enumName,
				values: Object.fromEntries(values.map((v) => [v, { value: v }])),
			});
			cache.set(enumName, gqlEnum);
		}
		return wrapNonNull(
			cache.get(enumName) as GraphQLInputType & GraphQLOutputType,
			required,
		);
	}

	const schemaType = propSchema.type;

	if (schemaType === "string") return wrapNonNull(GraphQLString, required);
	if (schemaType === "integer") return wrapNonNull(GraphQLInt, required);
	if (schemaType === "number") return wrapNonNull(GraphQLFloat, required);
	if (schemaType === "boolean") return wrapNonNull(GraphQLBoolean, required);

	if (schemaType === "array") {
		const items = propSchema.items;
		const itemSchema = Array.isArray(items) ? items[0] : items;
		if (!itemSchema || !isJSONSchema7(itemSchema)) {
			return wrapNonNull(
				new GraphQLList(new GraphQLNonNull(GraphQLString)),
				required,
			);
		}
		const itemType = propertySchemaToGraphQL(
			`${propName}_item`,
			itemSchema,
			true,
			undefined,
			cache,
			mode,
			`${namePrefix}_${safeName(propName)}`,
			definitions,
		);
		const listType =
			mode === "input"
				? new GraphQLList(new GraphQLNonNull(itemType as GraphQLInputType))
				: new GraphQLList(new GraphQLNonNull(itemType as GraphQLOutputType));
		return wrapNonNull(listType, required);
	}

	if (schemaType === "object") {
		const inlineName = `${namePrefix}_${safeName(propName)}`;
		const props = propSchema.properties ?? {};
		const requiredSet = new Set(propSchema.required ?? []);
		const fields: Record<
			string,
			{ type: GraphQLInputType } | { type: GraphQLOutputType }
		> = {};
		for (const [k, v] of Object.entries(props)) {
			if (!v || !isJSONSchema7(v)) continue;
			fields[k] = {
				type: propertySchemaToGraphQL(
					k,
					v,
					requiredSet.has(k),
					undefined,
					cache,
					mode,
					`${inlineName}_${safeName(k)}`,
					definitions,
				) as GraphQLInputType & GraphQLOutputType,
			};
		}
		if (mode === "input") {
			const obj = new GraphQLInputObjectType({
				name: `${inlineName}_Input`,
				fields: () => fields as Record<string, { type: GraphQLInputType }>,
			});
			cache.set(obj.name, obj);
			return wrapNonNull(obj, required);
		}
		const obj = new GraphQLObjectType({
			name: `${inlineName}_Output`,
			fields: () => fields as Record<string, { type: GraphQLOutputType }>,
		});
		cache.set(obj.name, obj);
		return wrapNonNull(obj, required);
	}

	return wrapNonNull(GraphQLString, required);
}

/**
 * Build GraphQL type for a resolved object definition.
 */
function buildObjectType(
	def: ResolvedObjectDef,
	cache: Map<string, GraphQLNamedType>,
	mode: "input" | "output",
	namePrefix: string,
	definitions: ReadonlyMap<string, ResolvedObjectDef>,
): GraphQLInputObjectType | GraphQLObjectType {
	const typeName =
		mode === "input"
			? `${safeName(namePrefix)}_${safeName(def.name)}_Input`
			: `${safeName(namePrefix)}_${safeName(def.name)}_Output`;

	const fields: Record<
		string,
		{ type: GraphQLInputType } | { type: GraphQLOutputType }
	> = {};
	for (const prop of def.properties) {
		const propType = propertySchemaToGraphQL(
			prop.name,
			prop.schema,
			prop.required,
			prop.refTarget,
			cache,
			mode,
			`${namePrefix}_${safeName(def.name)}_${safeName(prop.name)}`,
			definitions,
		);
		fields[prop.name] = {
			type: propType as GraphQLInputType & GraphQLOutputType,
		};
	}

	if (mode === "input") {
		const t = new GraphQLInputObjectType({
			name: typeName,
			fields: () => fields as Record<string, { type: GraphQLInputType }>,
		});
		cache.set(def.name, t);
		cache.set(typeName, t);
		return t;
	}
	const t = new GraphQLObjectType({
		name: typeName,
		fields: () => fields as Record<string, { type: GraphQLOutputType }>,
	});
	cache.set(def.name, t);
	cache.set(typeName, t);
	return t;
}

/**
 * Emit GraphQL types from ResolvedSchemaIR (object-shaped).
 * Does not use toTableIR; walks the resolved object tree and builds input or output types.
 */
export function emitGraphQL(
	resolved: ResolvedSchemaIR,
	options: EmitGraphQLOptions,
): EmitGraphQLResult {
	const { mode, namePrefix = "Schema" } = options;
	const cache = new Map<string, GraphQLNamedType>();
	const prefix = safeName(namePrefix);

	const allDefs = new Map(resolved.definitions);
	allDefs.set(resolved.root.name, resolved.root);

	const order: string[] = [resolved.root.name];
	for (const [name] of resolved.definitions) {
		if (name !== resolved.root.name) order.push(name);
	}

	for (const defName of order) {
		const def = allDefs.get(defName);
		if (!def) continue;
		if (cache.has(defName)) continue;
		buildObjectType(def, cache, mode, prefix, allDefs);
	}

	const rootType = cache.get(resolved.root.name);
	if (!rootType) {
		throw new Error("Failed to build root GraphQL type");
	}

	return {
		rootType: rootType as GraphQLInputType & GraphQLOutputType,
		typeMap: new Map(cache),
	};
}
