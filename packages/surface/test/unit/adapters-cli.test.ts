import { describe, expect, test } from "bun:test";
import {
	defineOperation,
	type DefaultContext,
	type OperationRegistry,
	runCli,
} from "../../src/index.js";
import { createMockContext } from "../fixtures/context.js";
import { createRegistryWithMinimalOp } from "../fixtures/operations.js";
import { z } from "zod";

const ctx = createMockContext();

describe("runCli", () => {
	test("unknown command exits 1 and prints help", async () => {
		const registry = createRegistryWithMinimalOp();
		const exitCalls: number[] = [];
		const originalExit = process.exit;
		process.exit = ((code?: number) => {
			exitCalls.push(code ?? 0);
		}) as typeof process.exit;

		const logSpy = console.error;
		const errors: string[] = [];
		console.error = (...args: unknown[]) => {
			errors.push(args.map(String).join(" "));
		};

		try {
			await runCli(registry, ctx, ["unknown-command"]);
		} catch {
			// runCli may throw after exit in some environments
		}

		process.exit = originalExit;
		console.error = logSpy;

		expect(exitCalls).toContain(1);
		expect(errors.some((e) => e.includes("Unknown command"))).toBe(true);
	});

	test("known command with valid args runs execute and exits 0 with JSON output", async () => {
		const registry = createRegistryWithMinimalOp();
		const exitCalls: number[] = [];
		const originalExit = process.exit;
		process.exit = ((code?: number) => {
			exitCalls.push(code ?? 0);
		}) as typeof process.exit;

		const out: string[] = [];
		const originalLog = console.log;
		console.log = (...args: unknown[]) => {
			out.push(args.map(String).join(" "));
		};

		try {
			await runCli(registry, ctx, ["test echo", "--id", "cli-1"]);
		} catch {
			// ignore
		}

		process.exit = originalExit;
		console.log = originalLog;

		expect(exitCalls).toContain(0);
		expect(out.length).toBeGreaterThan(0);
		expect(out.some((s) => s.includes("cli-1"))).toBe(true);
	});

	test("--dry-run runs validation and guards but skips handler, exits 0", async () => {
		let handlerRan = false;
		const registry = createRegistryWithMinimalOp();
		const op = registry.get("test.echo");
		if (!op) throw new Error("Expected test.echo");
		const opWithSpy = {
			...op,
			handler: async (payload: unknown) => {
				handlerRan = true;
				return { ok: true as const, value: payload };
			},
		};
		const regWithSpy = new Map(registry);
		regWithSpy.set("test.echo", opWithSpy);

		const exitCalls: number[] = [];
		const originalExit = process.exit;
		process.exit = ((code?: number) => {
			exitCalls.push(code ?? 0);
		}) as typeof process.exit;

		const out: string[] = [];
		const originalLog = console.log;
		console.log = (...args: unknown[]) => {
			out.push(args.map(String).join(" "));
		};

		try {
			await runCli(regWithSpy as typeof registry, ctx, [
				"test echo",
				"--id",
				"x",
				"--dry-run",
			]);
		} catch {
			// ignore
		}

		process.exit = originalExit;
		console.log = originalLog;

		expect(exitCalls).toContain(0);
		expect(handlerRan).toBe(false);
		expect(out.some((s) => s.includes("Dry run"))).toBe(true);
	});

	test("throws on duplicate cli commands", async () => {
		const opA = defineOperation({
			name: "test.cliA",
			schema: z.object({ id: z.string() }),
			outputSchema: z.object({ id: z.string() }),
			handler: async (payload: { id: string }) => ({
				ok: true as const,
				value: payload,
			}),
			expose: {
				cli: {
					default: {
						command: "duplicate command",
						description: "duplicate command A",
					},
				},
			},
		});
		const opB = defineOperation({
			name: "test.cliB",
			schema: z.object({ id: z.string() }),
			outputSchema: z.object({ id: z.string() }),
			handler: async (payload: { id: string }) => ({
				ok: true as const,
				value: payload,
			}),
			expose: {
				cli: {
					default: {
						command: "duplicate command",
						description: "duplicate command B",
					},
				},
			},
		});
		const registry = new Map([
			[opA.name, opA],
			[opB.name, opB],
		]) as OperationRegistry<DefaultContext>;

		await expect(runCli(registry, ctx, ["duplicate command"])).rejects.toThrow(
			'Duplicate cli command "duplicate command"',
		);
	});
});
