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
import type {
	DefaultContext,
	ExecutionError,
	OperationRegistry,
} from "../../operation/types";
import { forSurface } from "../../registry";

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
	const graphqlOps = forSurface(registry, "graphql");
	const hooks = getHooks(graphqlOps);

	const mutationFields: Record<string, GraphQLFieldConfig<unknown, C>> = {};
	const queryFields: Record<string, GraphQLFieldConfig<unknown, C>> = {};

	for (const [, op] of graphqlOps) {
		if (op.outputChunkSchema != null) continue;
		const config = op.expose.graphql;
		const fieldName = config?.field ?? op.name;
		const kind = config?.type ?? "mutation";

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

		const inputType = inputResult.value.rootType as GraphQLInputType;
		const args = {
			input: { type: new GraphQLNonNull(inputType) },
		};

		const resolve = async (_source: unknown, argsInput: unknown) => {
			const payload = (argsInput as { input?: unknown }).input;
			const result = await execute(
				op,
				payload,
				ctx,
				"graphql",
				hooks ? { hooks } : undefined,
			);
			if (!result.ok) {
				throw executionErrorToGraphQLError(result.error);
			}
			return result.value;
		};

		const outputType = outputResult.value.rootType as GraphQLOutputType;
		const fieldConfig: GraphQLFieldConfig<unknown, C> = {
			type: new GraphQLNonNull(outputType),
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
