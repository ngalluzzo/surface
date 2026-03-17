import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { defineOperation, exportSchemas } from "../../src/index.js";

const schema = z.object({ id: z.string() });

const outputSchema = z.object({ id: z.string() });

describe("registerOperationSchema (via defineOperation)", () => {
	test("defineOperation registers schema and returns the operation", () => {
		const op = defineOperation({
			name: "registryTest.registered",
			version: 1,
			schema,
			outputSchema,
			handler: async (p) => ({ ok: true, value: p }),
			expose: {
				http: { default: { method: "POST", path: "/registryTest" } },
				job: { default: { queue: "default" } },
			},
		});
		expect(op.name).toBe("registryTest.registered");
		expect(op.schema).toBe(schema);
		expect(op.outputSchema).toBe(outputSchema);
		expect(op.version).toBe(1);
	});
});

describe("exportSchemas", () => {
	test("returns object containing registered operation schemas", () => {
		const out = exportSchemas();
		expect(out).toBeDefined();
		expect(typeof out).toBe("object");
		const defs =
			(out as Record<string, unknown>).$defs ??
			(out as Record<string, unknown>);
		const keys = Object.keys(defs);
		expect(keys.length).toBeGreaterThan(0);
		expect(
			keys.some((k) => k.includes("registryTest") || k.includes("test.")),
		).toBe(true);
	});

	test("includes output schemas keyed by operation name + .output", () => {
		const out = exportSchemas();
		const defs =
			(out as Record<string, unknown>).$defs ??
			(out as Record<string, unknown>);
		const keys = Object.keys(defs);
		expect(keys.some((k) => k.endsWith(".output"))).toBe(true);
	});

	test("openapi-3.0 target returns schema catalogue", () => {
		const out = exportSchemas("openapi-3.0") as Record<string, unknown>;
		expect(out).toBeDefined();
		expect(typeof out).toBe("object");
		// Target-specific structure; default draft-2020-12 is tested above for .output keys
		expect(Object.keys(out).length).toBeGreaterThan(0);
	});
});
