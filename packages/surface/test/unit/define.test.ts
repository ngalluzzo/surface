import { describe, expect, test } from "bun:test";
import { z } from "zod";
import type { AnyOperation } from "../../src/index.js";
import {
	BindingValidationError,
	composeRegistries,
	createOps,
	defineGuardPolicy,
	defineOperation,
	defineRegistry,
	eventBindingRef,
	forSurface,
	normalizeOperationSurfaceBindings,
	normalizeSurfaceBindings,
	resolveOperationSurfaceBinding,
	validateBindings,
	validateSurfaceBindings,
} from "../../src/index.js";

const schema = z.object({ id: z.string() });

describe("defineGuardPolicy", () => {
	test("returns policy with name and guards array", () => {
		const guard = async () => ({ ok: true as const, value: undefined });
		const policy = defineGuardPolicy("testPolicy", [guard]);
		expect(policy.name).toBe("testPolicy");
		expect(policy.guards).toHaveLength(1);
		expect(policy.guards[0]).toBe(guard);
	});
});

describe("createOps", () => {
	test("executeUnknown rejects binding refs for the wrong surface", async () => {
		const ops = createOps();
		const op = makeOp("test.surfaceMismatch", { http: true, event: true });

		await expect(
			ops.executeUnknown(
				op,
				{ id: "x" },
				{},
				{
					surface: "http",
					binding: eventBindingRef("test.surfaceMismatch"),
				},
			),
		).rejects.toThrow(
			'Binding ref surface "event" does not match requested surface "http"',
		);
	});
});

function makeOp(
	name: string,
	surfaces: { http?: boolean; cli?: boolean; job?: boolean; event?: boolean },
) {
	const expose: {
		http?: { default: { method: "POST"; path: string } };
		cli?: { default: { command: string; description: string } };
		job?: { default: { queue: string } };
		event?: {
			default: {
				source: string;
				topic: string;
				parsePayload: (raw: unknown) => unknown;
			};
		};
	} = {};
	if (surfaces.http)
		expose.http = { default: { method: "POST", path: `/${name}` } };
	if (surfaces.cli)
		expose.cli = { default: { command: name, description: name } };
	if (surfaces.job) expose.job = { default: { queue: "default" } };
	if (surfaces.event) {
		expose.event = {
			default: {
				source: "test",
				topic: `${name}.topic`,
				parsePayload: (raw: unknown) => raw,
			},
		};
	}
	return {
		name,
		schema,
		outputSchema: schema,
		handler: async (p: z.infer<typeof schema>) => ({
			ok: true as const,
			value: p,
		}),
		expose,
	};
}

describe("defineRegistry", () => {
	test("stores operations by name", () => {
		const op1 = makeOp("domain.a", { http: true });
		const op2 = makeOp("domain.b", { http: true });
		const reg = defineRegistry("domain", [op1, op2]);
		expect(reg.size).toBe(2);
		const storedA = (reg.get as (name: string) => unknown)("domain.a");
		const storedB = (reg.get as (name: string) => unknown)("domain.b");
		if (!storedA || !storedB) {
			throw new Error("Expected stored operations");
		}
		expect(storedA as unknown).toBe(op1);
		expect(storedB as unknown).toBe(op2);
	});

	test("throws on duplicate operation name in same registry", () => {
		const op = makeOp("domain.dup", { http: true });
		expect(() => defineRegistry("domain", [op, op])).toThrow(
			/Duplicate operation name "domain.dup" in registry "domain"/,
		);
	});

	test('rejects operation names containing ":"', () => {
		expect(() =>
			defineOperation({
				name: "domain:invalid",
				schema,
				outputSchema: schema,
				handler: async (p: z.infer<typeof schema>) => ({
					ok: true as const,
					value: p,
				}),
				expose: {
					http: {
						default: { method: "POST" as const, path: "/invalid" },
					},
				},
			}),
		).toThrow(/cannot contain ":" because it is reserved for binding keys/);
	});

	test('rejects binding names containing ":"', () => {
		expect(() =>
			defineOperation({
				name: "domain.invalidBinding",
				schema,
				outputSchema: schema,
				handler: async (p: z.infer<typeof schema>) => ({
					ok: true as const,
					value: p,
				}),
				expose: {
					http: {
						"admin:v2": {
							method: "POST" as const,
							path: "/invalid-binding",
						},
					},
				},
			}),
		).toThrow(/Binding name "admin:v2" cannot contain ":"/);
	});
});

describe("composeRegistries", () => {
	test("merges multiple registries into one", () => {
		const regA = defineRegistry("a", [makeOp("a.one", { http: true })]);
		const regB = defineRegistry("b", [makeOp("b.two", { http: true })]);
		const root = composeRegistries([regA, regB]);
		expect(root.size).toBe(2);
		expect((root.get as (name: string) => unknown)("a.one")).toBeDefined();
		expect((root.get as (name: string) => unknown)("b.two")).toBeDefined();
	});

	test("throws on duplicate name across registries", () => {
		const regA = defineRegistry("a", [makeOp("same.name", { http: true })]);
		const regB = defineRegistry("b", [makeOp("same.name", { cli: true })]);
		expect(() => composeRegistries([regA, regB])).toThrow(
			/Duplicate operation name "same.name" across registries/,
		);
	});
});

describe("forSurface", () => {
	test("returns only operations exposed on the given surface", () => {
		const httpOnly = makeOp("test.httpOnly", { http: true });
		const cliOnly = makeOp("test.cliOnly", { cli: true });
		const both = makeOp("test.both", { http: true, cli: true });
		const reg = defineRegistry("test", [httpOnly, cliOnly, both]);

		const httpOps = forSurface(reg, "http");
		expect(httpOps.size).toBe(2);
		expect(httpOps.has("test.httpOnly")).toBe(true);
		expect(httpOps.has("test.both")).toBe(true);
		expect(httpOps.has("test.cliOnly")).toBe(false);

		const cliOps = forSurface(reg, "cli");
		expect(cliOps.size).toBe(2);
		expect(cliOps.has("test.cliOnly")).toBe(true);
		expect(cliOps.has("test.both")).toBe(true);
		expect(cliOps.has("test.httpOnly")).toBe(false);
	});

	test("returns empty map when no ops expose the surface", () => {
		const reg = defineRegistry("test", [makeOp("test.http", { http: true })]);
		const jobOps = forSurface(reg, "job");
		expect(jobOps.size).toBe(0);
	});
});

describe("normalizeSurfaceBindings", () => {
	test("returns the default binding for each matching operation", () => {
		const httpOnly = makeOp("test.httpOnly", { http: true });
		const both = makeOp("test.both", { http: true, cli: true });
		const reg = defineRegistry("test", [httpOnly, both]);

		const bindings = normalizeSurfaceBindings(reg, "http");
		expect(bindings).toHaveLength(2);
		expect(bindings.map((binding) => binding.bindingName)).toEqual([
			"default",
			"default",
		]);
		expect(bindings.map((binding) => binding.bindingId) as string[]).toEqual([
			"test.httpOnly",
			"test.both",
		]);
		expect(
			bindings.map((binding) => binding.operationName) as string[],
		).toEqual(["test.httpOnly", "test.both"]);
		expect(bindings.map((binding) => binding.config.path)).toEqual([
			"/test.httpOnly",
			"/test.both",
		]);
	});

	test("returns empty array when the operation is not exposed on that surface", () => {
		const cliOnly = makeOp("test.cliOnly", { cli: true });
		expect(normalizeOperationSurfaceBindings(cliOnly, "http")).toEqual([]);
	});

	test("preserves multiple named bindings for the same operation", () => {
		const op = {
			...makeOp("test.multi", { http: true }),
			expose: {
				http: {
					default: { method: "POST" as const, path: "/multi" },
					admin: { method: "POST" as const, path: "/multi/admin" },
				},
			},
		} satisfies AnyOperation;

		const bindings = normalizeOperationSurfaceBindings(op, "http");
		expect(bindings.map((binding) => binding.bindingName)).toEqual([
			"default",
			"admin",
		]);
		expect(bindings.map((binding) => binding.bindingId) as string[]).toEqual([
			"test.multi",
			"test.multi:admin",
		]);
		expect(resolveOperationSurfaceBinding(op, "http")?.config.path).toBe(
			"/multi",
		);
		expect(
			resolveOperationSurfaceBinding(op, "http", "admin")?.config.path,
		).toBe("/multi/admin");
	});
});

describe("validateBindings", () => {
	test("returns structured issues for duplicate binding targets", () => {
		const opA = {
			...makeOp("test.duplicateA", { http: true }),
			expose: {
				http: {
					default: { method: "POST" as const, path: "/duplicate" },
				},
			},
		} satisfies AnyOperation;
		const opB = {
			...makeOp("test.duplicateB", { http: true }),
			expose: {
				http: {
					default: { method: "POST" as const, path: "/duplicate" },
				},
			},
		} satisfies AnyOperation;
		const typedRegistry = defineRegistry("test", [opA, opB]);

		const issues = validateBindings(typedRegistry);
		expect(issues).toHaveLength(1);
		expect(issues[0]).toMatchObject({
			code: "duplicate_target",
			surface: "http",
			targetKind: "route",
			target: "POST /duplicate",
			bindings: [
				{
					key: "test.duplicateA",
					ref: {
						surface: "http",
						operation: "test.duplicateA",
						binding: "default",
					},
				},
				{
					key: "test.duplicateB",
					ref: {
						surface: "http",
						operation: "test.duplicateB",
						binding: "default",
					},
				},
			],
		});
	});

	test("can validate one surface at a time", () => {
		const opA = makeOp("test.cliA", { cli: true });
		const opB = makeOp("test.cliA2", { cli: true });
		opB.expose.cli = {
			default: {
				command: "test.cliA",
				description: "duplicate cli command",
			},
		};
		const registry = defineRegistry("test", [opA, opB]);

		const issues = validateSurfaceBindings(registry, "cli");
		expect(issues).toHaveLength(1);
		expect(issues[0]?.surface).toBe("cli");
		expect(issues[0]?.targetKind).toBe("command");
	});

	test("returns structured issues for invalid explicit graphql fields", () => {
		const op = {
			...makeOp("test.invalidGraphqlField", {
				http: false,
				cli: false,
				job: false,
			}),
			expose: {
				graphql: {
					default: { type: "mutation" as const, field: "bad-field" },
				},
			},
		} satisfies AnyOperation;
		const registry = defineRegistry("test", [op]);

		const issues = validateBindings(registry);
		expect(issues).toHaveLength(1);
		expect(issues[0]).toMatchObject({
			code: "invalid_target",
			surface: "graphql",
			targetKind: "field",
			target: "bad-field",
			bindings: [
				{
					key: "test.invalidGraphqlField",
					ref: {
						operation: "test.invalidGraphqlField",
						binding: "default",
						surface: "graphql",
					},
				},
			],
		});
	});

	test("BindingValidationError carries structured issues", () => {
		const error = new BindingValidationError([
			{
				code: "duplicate_target",
				surface: "http",
				targetKind: "route",
				target: "POST /duplicate",
				bindings: [
					{
						key: "test.a",
						ref: {
							surface: "http",
							operation: "test.a",
							binding: "default",
						},
					},
					{
						key: "test.b",
						ref: {
							surface: "http",
							operation: "test.b",
							binding: "default",
						},
					},
				],
				message:
					'Duplicate http route "POST /duplicate" for bindings "test.a" and "test.b"',
			},
		]);

		expect(error.name).toBe("BindingValidationError");
		expect(error.issues).toHaveLength(1);
		expect(error.message).toContain('Duplicate http route "POST /duplicate"');
	});
});
