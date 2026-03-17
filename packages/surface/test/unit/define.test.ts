import { describe, expect, test } from "bun:test";
import { z } from "zod";
import type { AnyOperation, DefaultContext, OperationRegistry } from "../../src/index.js";
import {
	BindingValidationError,
	composeRegistries,
	defineGuardPolicy,
	defineRegistry,
	forSurface,
	normalizeOperationSurfaceBindings,
	resolveOperationSurfaceBinding,
	normalizeSurfaceBindings,
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

function makeOp(
	name: string,
	surfaces: { http?: boolean; cli?: boolean; job?: boolean },
): AnyOperation {
	const expose: AnyOperation["expose"] = {};
	if (surfaces.http)
		expose.http = { default: { method: "POST", path: `/${name}` } };
	if (surfaces.cli)
		expose.cli = { default: { command: name, description: name } };
	if (surfaces.job) expose.job = { default: { queue: "default" } };
	return {
		name,
		schema,
		outputSchema: schema,
		handler: async (p) => ({ ok: true, value: p }),
		expose,
	};
}

describe("defineRegistry", () => {
	test("stores operations by name", () => {
		const op1 = makeOp("domain.a", { http: true });
		const op2 = makeOp("domain.b", { http: true });
		const reg = defineRegistry("domain", [op1, op2]);
		expect(reg.size).toBe(2);
		expect(reg.get("domain.a")).toBe(op1);
		expect(reg.get("domain.b")).toBe(op2);
	});

	test("throws on duplicate operation name in same registry", () => {
		const op = makeOp("domain.dup", { http: true });
		expect(() => defineRegistry("domain", [op, op])).toThrow(
			/Duplicate operation name "domain.dup" in registry "domain"/,
		);
	});
});

describe("composeRegistries", () => {
	test("merges multiple registries into one", () => {
		const regA = defineRegistry("a", [makeOp("a.one", { http: true })]);
		const regB = defineRegistry("b", [makeOp("b.two", { http: true })]);
		const root = composeRegistries([regA, regB]);
		expect(root.size).toBe(2);
		expect(root.get("a.one")).toBeDefined();
		expect(root.get("b.two")).toBeDefined();
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
		expect(bindings.map((binding) => binding.bindingId)).toEqual([
			"test.httpOnly",
			"test.both",
		]);
		expect(bindings.map((binding) => binding.operationName)).toEqual([
			"test.httpOnly",
			"test.both",
		]);
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
		expect(bindings.map((binding) => binding.bindingId)).toEqual([
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
		const registry = new Map([
			[opA.name, opA],
			[opB.name, opB],
		]) as OperationRegistry<DefaultContext>;

		const issues = validateBindings(registry);
		expect(issues).toHaveLength(1);
		expect(issues[0]).toMatchObject({
			code: "duplicate_target",
			surface: "http",
			targetKind: "route",
			target: "POST /duplicate",
			bindings: [
				{ key: "test.duplicateA", ref: { operation: "test.duplicateA", binding: "default" } },
				{ key: "test.duplicateB", ref: { operation: "test.duplicateB", binding: "default" } },
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
		const registry = new Map([
			[opA.name, opA],
			[opB.name, opB],
		]) as OperationRegistry<DefaultContext>;

		const issues = validateSurfaceBindings(registry, "cli");
		expect(issues).toHaveLength(1);
		expect(issues[0]?.surface).toBe("cli");
		expect(issues[0]?.targetKind).toBe("command");
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
						ref: { operation: "test.a", binding: "default" },
					},
					{
						key: "test.b",
						ref: { operation: "test.b", binding: "default" },
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
