import { describe, expect, test } from "bun:test";
import { graphql } from "graphql";
import { buildGraphQLSchema } from "../../src/index.js";
import { createMockContext } from "../fixtures/context.js";
import { createRegistryWithMinimalOp } from "../fixtures/operations.js";

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
});
