import { describe, expect, test } from "bun:test";
import { graphql } from "graphql";
import { buildGraphQLSchema, defineOperation } from "../../src/index.js";
import { createMockContext } from "../fixtures/context.js";
import { createRegistryWithMinimalOp } from "../fixtures/operations.js";
import { z } from "zod";

describe("buildGraphQLSchema", () => {
	test("builds schema with mutation field and runs successfully", async () => {
		const registry = createRegistryWithMinimalOp();
		const ctx = createMockContext();

		const schema = await buildGraphQLSchema(registry, ctx);

		expect(schema.getMutationType()).toBeDefined();
		const mutationType = schema.getMutationType();
		if (!mutationType) throw new Error("Expected mutation type");
		expect(mutationType.getFields().echo).toBeDefined();

		const result = await graphql({
			schema,
			source: `
        mutation {
          echo(input: { id: "test-1" }) {
            id
          }
        }
      `,
			contextValue: ctx,
		});

		expect(result.errors).toBeUndefined();
		expect(result.data).toEqual({ echo: { id: "test-1" } });
	});

	test("invalid input returns GraphQL errors", async () => {
		const registry = createRegistryWithMinimalOp();
		const ctx = createMockContext();

		const schema = await buildGraphQLSchema(registry, ctx);

		// Omit required "id" so request is invalid (GraphQL or Zod validation)
		const result = await graphql({
			schema,
			source: `
        mutation {
          echo(input: {}) {
            id
          }
        }
      `,
			contextValue: ctx,
		});

		expect(result.errors).toBeDefined();
		expect(result.errors?.length).toBeGreaterThanOrEqual(1);
	});

	test("reuses operation input/output types across multiple graphql bindings", async () => {
		const op = defineOperation({
			name: "testEcho",
			schema: z.object({ id: z.string() }),
			outputSchema: z.object({ id: z.string() }),
			handler: async (payload: { id: string }) => ({
				ok: true as const,
				value: payload,
			}),
			expose: {
				graphql: {
					default: { type: "mutation", field: "testEcho" },
					admin: { type: "mutation", field: "testEchoAdmin" },
				},
			},
		});
		const registry = new Map([
			[op.name, op],
		]) as import("../../src/index.js").OperationRegistry<
			import("../../src/index.js").DefaultContext
		>;
		const ctx = createMockContext();

		const schema = await buildGraphQLSchema(registry, ctx);
		const mutationType = schema.getMutationType();
		if (!mutationType) throw new Error("Expected mutation type");
		expect(mutationType.getFields().testEcho).toBeDefined();
		expect(mutationType.getFields().testEchoAdmin).toBeDefined();

		const result = await graphql({
			schema,
			source: `
        mutation {
          testEcho(input: { id: "one" }) { id }
          testEchoAdmin(input: { id: "two" }) { id }
        }
      `,
			contextValue: ctx,
		});

		expect(result.errors).toBeUndefined();
		expect(result.data).toEqual({
			testEcho: { id: "one" },
			testEchoAdmin: { id: "two" },
		});
	});
});
