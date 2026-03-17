import { describe, expect, test } from "bun:test";
import {
	type GraphQLInputType,
	GraphQLNonNull,
	GraphQLObjectType,
	type GraphQLOutputType,
	GraphQLSchema,
	GraphQLString,
	graphql,
} from "graphql";
import { z } from "zod";
import { convertToGraphQL } from "../convert";
import { convertZodToGraphQL } from "../convertZod";

describe("convertToGraphQL", () => {
	test("converts simple JSON Schema object to GraphQL input type", () => {
		const schema = {
			type: "object",
			title: "EchoInput",
			required: ["id"],
			properties: {
				id: { type: "string" },
			},
		} as unknown;

		const result = convertToGraphQL(schema, {
			rootName: "EchoInput",
			mode: "input",
		});
		expect(result.kind).toBe("ok");
		if (result.kind === "ok") {
			expect(result.value.rootType).toBeDefined();
			expect(result.value.typeMap.size).toBeGreaterThanOrEqual(1);
		}
	});

	test("converts simple JSON Schema object to GraphQL output type", () => {
		const schema = {
			type: "object",
			title: "EchoOutput",
			required: ["id"],
			properties: {
				id: { type: "string" },
			},
		} as unknown;

		const result = convertToGraphQL(schema, {
			rootName: "EchoOutput",
			mode: "output",
		});
		expect(result.kind).toBe("ok");
		if (result.kind === "ok") {
			expect(result.value.rootType).toBeDefined();
		}
	});
});

describe("convertZodToGraphQL", () => {
	test("converts z.object schema to GraphQL input and output types", async () => {
		const schema = z.object({ id: z.string() });

		const inputResult = await convertZodToGraphQL(schema, {
			rootName: "TestInput",
			mode: "input",
		});
		expect(inputResult.kind).toBe("ok");
		if (inputResult.kind === "ok") {
			expect(inputResult.value.rootType).toBeDefined();
		}

		const outputResult = await convertZodToGraphQL(schema, {
			rootName: "TestOutput",
			mode: "output",
		});
		expect(outputResult.kind).toBe("ok");
		if (outputResult.kind === "ok") {
			expect(outputResult.value.rootType).toBeDefined();
		}
	});

	test("built types work in a minimal GraphQL schema", async () => {
		const schema = z.object({ id: z.string() });
		const inputResult = await convertZodToGraphQL(schema, {
			rootName: "EchoInput",
			mode: "input",
		});
		const outputResult = await convertZodToGraphQL(schema, {
			rootName: "EchoOutput",
			mode: "output",
		});
		if (inputResult.kind === "err" || outputResult.kind === "err") {
			throw new Error("Expected both conversions to succeed");
		}

		const gqlSchema = new GraphQLSchema({
			query: new GraphQLObjectType({
				name: "Query",
				fields: () => ({ _empty: { type: GraphQLString } }),
			}),
			mutation: new GraphQLObjectType({
				name: "Mutation",
				fields: {
					echo: {
						type: new GraphQLNonNull(
							outputResult.value.rootType as GraphQLOutputType,
						),
						args: {
							input: {
								type: new GraphQLNonNull(
									inputResult.value.rootType as GraphQLInputType,
								),
							},
						},
						resolve: (_: unknown, args: { input: { id: string } }) =>
							args.input,
					},
				},
			}),
		});

		const result = await graphql({
			schema: gqlSchema,
			source: 'mutation { echo(input: { id: "x" }) { id } }',
		});
		expect(result.errors).toBeUndefined();
		expect(result.data).toEqual({ echo: { id: "x" } });
	});
});
