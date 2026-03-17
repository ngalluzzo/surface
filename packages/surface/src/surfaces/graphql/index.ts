import { convertZodToGraphQL } from "@gooios/schemarr";
import {
	GraphQLError,
	type GraphQLFieldConfig,
	type GraphQLInputType,
	GraphQLNonNull,
	GraphQLObjectType,
	type GraphQLOutputType,
	GraphQLSchema,
	GraphQLString,
} from "graphql";
import { execute, getHooks } from "../../execution";
import type { OperationRegistryWithHooks } from "../../operation";
import {
	getSurfaceBindingLookupKey,
	normalizeSurfaceBindings,
} from "../../operation";
import type {
	DefaultContext,
	ExecutionError,
	OperationRegistry,
} from "../../operation/types";
import {
	assertNoBindingValidationIssues,
	createDuplicateTargetBindingValidationSpec,
	registerBindingValidationSpecs,
	validateBindingSpecs,
} from "../../registry/binding-validation-core";
import type { NormalizedSurfaceBinding } from "../../registry";

function executionErrorToGraphQLError(error: ExecutionError): GraphQLError {
	let message: string;
	const extensions: Record<string, unknown> = { phase: error.phase };

	switch (error.phase) {
		case "surface-guard":
		case "domain-guard":
			message = `[${error.code}]${error.message ? `: ${error.message}` : ""}`;
			extensions.code = error.code;
			if (error.message) extensions.message = error.message;
			break;
		case "validation":
			message = "Validation failed";
			extensions.issues = error.issues;
			break;
		case "handler":
			if ("error" in error) {
				message = error.error;
				extensions.error = error.error;
			} else {
				message = "Output validation failed";
				extensions.issues = error.issues;
			}
			break;
		default:
			message = "Execution failed";
	}

	return new GraphQLError(message, { extensions });
}

function sanitizeGraphQLFieldIdentifier(value: string): string {
	const sanitized = value.replace(/[^_0-9A-Za-z]/g, "_");
	return /^[A-Za-z_]/.test(sanitized) ? sanitized : `_${sanitized}`;
}

function getGraphQLFieldName<C extends DefaultContext = DefaultContext>(
	binding: NormalizedSurfaceBinding<"graphql", C>,
): string {
	if (binding.config.field) {
		return binding.config.field;
	}

	const base = sanitizeGraphQLFieldIdentifier(binding.operationName);
	if (binding.bindingName === "default") {
		return base;
	}

	return `${base}_${sanitizeGraphQLFieldIdentifier(binding.bindingName)}`;
}

export const graphqlBindingValidationSpecs = [
	createDuplicateTargetBindingValidationSpec({
		surface: "graphql",
		targetKind: "field",
		filter: (binding) => binding.op.outputChunkSchema == null,
		select: (binding) =>
			`${binding.config.type ?? "mutation"}:${getGraphQLFieldName(binding)}`,
	}),
] as const;

registerBindingValidationSpecs(graphqlBindingValidationSpecs);

/**
 * Build a GraphQL schema from operations exposed on the graphql surface.
 * Each operation becomes a query or mutation field; input/output types are
 * derived from Zod schemas via JSON Schema (schemarr).
 *
 * @param registry - Full registry or pre-filtered (forSurface(registry, "graphql"))
 * @param ctx - Context passed to execute()
 * @returns Promise resolving to a GraphQLSchema (use with Apollo, express-graphql, etc.)
 */
export async function buildGraphQLSchema<
	C extends DefaultContext = DefaultContext,
>(
	registry: OperationRegistry<C> | OperationRegistryWithHooks<C>,
	ctx: C,
): Promise<GraphQLSchema> {
	const graphqlBindings = normalizeSurfaceBindings(registry, "graphql").filter(
		(binding) => binding.op.outputChunkSchema == null,
	);
	assertNoBindingValidationIssues(
		validateBindingSpecs(
			graphqlBindings,
			[...graphqlBindingValidationSpecs],
		),
	);
	const hooks = "hooks" in registry ? getHooks(registry) : undefined;
	const typesByOperation = new Map<
		string,
		{
			inputType: GraphQLInputType;
			outputType: GraphQLOutputType;
		}
	>();

	const mutationFields: Record<string, GraphQLFieldConfig<unknown, C>> = {};
	const queryFields: Record<string, GraphQLFieldConfig<unknown, C>> = {};

	for (const binding of graphqlBindings) {
		const { op, config } = binding;
		const fieldName = getGraphQLFieldName(binding);
		const kind = config.type ?? "mutation";

		let types = typesByOperation.get(op.name);
		if (!types) {
			const inputResult = await convertZodToGraphQL(op.schema, {
				rootName: `${op.name}_Input`,
				mode: "input",
			});
			if (inputResult.kind === "err") {
				const err = inputResult.error;
				const msg =
					err && typeof err === "object" && "message" in err
						? (err as { message: string }).message
						: String(err);
				throw new Error(`GraphQL input type for ${op.name}: ${msg}`);
			}

			const outputResult = await convertZodToGraphQL(op.outputSchema, {
				rootName: `${op.name}_Output`,
				mode: "output",
			});
			if (outputResult.kind === "err") {
				const err = outputResult.error;
				const msg =
					err && typeof err === "object" && "message" in err
						? (err as { message: string }).message
						: String(err);
				throw new Error(`GraphQL output type for ${op.name}: ${msg}`);
			}

			types = {
				inputType: inputResult.value.rootType as GraphQLInputType,
				outputType: outputResult.value.rootType as GraphQLOutputType,
			};
			typesByOperation.set(op.name, types);
		}

		const args = {
			input: { type: new GraphQLNonNull(types.inputType) },
		};

		const resolve = async (_source: unknown, argsInput: unknown) => {
			const payload = (argsInput as { input?: unknown }).input;
			const result = await execute(
				op,
				payload,
				ctx,
				"graphql",
				config,
				{
					...(hooks ? { hooks } : {}),
					binding,
				},
			);
			if (!result.ok) {
				throw executionErrorToGraphQLError(result.error);
			}
			return result.value;
		};

		const fieldConfig: GraphQLFieldConfig<unknown, C> = {
			type: new GraphQLNonNull(types.outputType),
			args,
			resolve,
		};

		if (kind === "query") {
			queryFields[fieldName] = fieldConfig;
		} else {
			mutationFields[fieldName] = fieldConfig;
		}
	}

	const mutationType =
		Object.keys(mutationFields).length > 0
			? new GraphQLObjectType<unknown, C>({
					name: "Mutation",
					fields: () => mutationFields,
				})
			: undefined;

	const queryType =
		Object.keys(queryFields).length > 0
			? new GraphQLObjectType<unknown, C>({
					name: "Query",
					fields: () => queryFields,
				})
			: undefined;

	return new GraphQLSchema({
		query:
			queryType ??
			new GraphQLObjectType({
				name: "Query",
				fields: () => ({ _empty: { type: GraphQLString } }),
			}),
		mutation: mutationType,
	});
}
