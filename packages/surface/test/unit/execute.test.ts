import { describe, expect, test } from "bun:test";
import type { ExecutionError, ExecutionMeta } from "../../src/index.js";
import { execute } from "../../src/index.js";
import { createMockContext } from "../fixtures/context.js";
import { surfaceGuardFail } from "../fixtures/guards.js";
import {
	createMinimalOp,
	createOpWithFailingDomainGuard,
	createOpWithSurfaceGuard,
	opWithContextEnrichment,
	opWithFailingHandler,
	opWithOutputValidationFailure,
	opWithPolicyNotOmitted,
	opWithPolicyOmittedOnHttp,
	opWithTwoGuards,
} from "../fixtures/operations.js";

const ctx = createMockContext();

describe("execute", () => {
	describe("happy path", () => {
		test("valid payload runs handler and returns value", async () => {
			const op = createMinimalOp();
			const result = await execute(op, { id: "x" }, ctx, "http");
			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(result.value).toEqual({ id: "x" });
		});
	});

	describe("phase 1 — surface guard", () => {
		test("surface guard failure returns surface-guard error", async () => {
			const op = createOpWithSurfaceGuard(surfaceGuardFail);
			const result = await execute(op, { id: "x" }, ctx, "http");
			expect(result.ok).toBe(false);
			if (result.ok) return;
			expect(result.error.phase).toBe("surface-guard");
			if (result.error.phase === "surface-guard") {
				expect(result.error.code).toBe("unauthorized");
			}
		});
	});

	describe("phase 2 — validation", () => {
		test("invalid payload returns validation error with issues", async () => {
			const op = createMinimalOp();
			const result = await execute(op, { wrong: "shape" }, ctx, "http");
			expect(result.ok).toBe(false);
			if (result.ok) return;
			expect(result.error.phase).toBe("validation");
			if (result.error.phase === "validation") {
				expect(Array.isArray(result.error.issues)).toBe(true);
			}
		});

		test("missing required field returns validation error", async () => {
			const op = createMinimalOp();
			const result = await execute(op, {}, ctx, "http");
			expect(result.ok).toBe(false);
			if (result.ok) return;
			expect(result.error.phase).toBe("validation");
		});
	});

	describe("phase 3 — domain guard", () => {
		test("domain guard failure returns domain-guard error", async () => {
			const op = createOpWithFailingDomainGuard();
			const result = await execute(op, { id: "x" }, ctx, "http");
			expect(result.ok).toBe(false);
			if (result.ok) return;
			expect(result.error.phase).toBe("domain-guard");
			if (result.error.phase === "domain-guard") {
				expect(result.error.code).toBe("test_guard_failed");
			}
		});

		test("omit override skips named domain guard so handler runs", async () => {
			const result = await execute(opWithTwoGuards, { id: "y" }, ctx, "http");
			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(result.value).toEqual({ id: "y" });
		});

		test("omit override skips guard policy by name so handler runs", async () => {
			const result = await execute(
				opWithPolicyOmittedOnHttp,
				{ id: "p" },
				ctx,
				"http",
			);
			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(result.value).toEqual({ id: "p" });
		});

		test("guard policy runs when not omitted and can fail", async () => {
			const result = await execute(
				opWithPolicyNotOmitted,
				{ id: "q" },
				ctx,
				"http",
			);
			expect(result.ok).toBe(false);
			if (result.ok) return;
			expect(result.error.phase).toBe("domain-guard");
			if (result.error.phase === "domain-guard") {
				expect(result.error.code).toBe("test_guard_failed");
			}
		});

		test("context enrichment: guard returns delta, handler receives merged context", async () => {
			const result = await execute(
				opWithContextEnrichment,
				{ id: "e" },
				ctx,
				"http",
			);
			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(result.value).toEqual({ id: "e", session: "resolved" });
		});
	});

	describe("phase 4 — handler", () => {
		test("handler failure returns handler error", async () => {
			const result = await execute(
				opWithFailingHandler,
				{ id: "z" },
				ctx,
				"http",
			);
			expect(result.ok).toBe(false);
			if (result.ok) return;
			expect(result.error.phase).toBe("handler");
			if (result.error.phase === "handler" && "error" in result.error) {
				expect(result.error.error).toBe("handler_error");
			}
		});

		test("output validation failure returns handler error with outputValidation and issues", async () => {
			const result = await execute(
				opWithOutputValidationFailure,
				{ id: "z" },
				ctx,
				"http",
			);
			expect(result.ok).toBe(false);
			if (result.ok) return;
			expect(result.error.phase).toBe("handler");
			expect(
				"outputValidation" in result.error && result.error.outputValidation,
			).toBe(true);
			if (
				result.error.phase === "handler" &&
				"outputValidation" in result.error
			) {
				expect(Array.isArray(result.error.issues)).toBe(true);
			}
		});
	});

	describe("lifecycle hooks", () => {
		test("onPhaseStart and onPhaseEnd called in order for each phase (happy path)", async () => {
			const op = createMinimalOp();
			const order: string[] = [];
			const phases: string[] = [];
			const hooks = {
				onPhaseStart: (meta: {
					operation: { name: string };
					phase: string;
					surface: string;
				}) => {
					order.push(`start:${meta.phase}`);
					phases.push(meta.phase);
				},
				onPhaseEnd: (meta: {
					operation: { name: string };
					phase: string;
					surface: string;
					durationMs: number;
				}) => {
					order.push(`end:${meta.phase}`);
					expect(meta.durationMs).toBeGreaterThanOrEqual(0);
					expect(meta.operation.name).toBe("test.echo");
					expect(meta.surface).toBe("http");
				},
			};
			const result = await execute(op, { id: "x" }, ctx, "http", { hooks });
			expect(result.ok).toBe(true);
			expect(order).toEqual([
				"start:surface-guard",
				"end:surface-guard",
				"start:validation",
				"end:validation",
				"start:domain-guard",
				"end:domain-guard",
				"start:handler",
				"end:handler",
			]);
			expect(phases).toEqual([
				"surface-guard",
				"validation",
				"domain-guard",
				"handler",
			]);
		});

		test("onError called with correct phase and error on validation failure", async () => {
			const op = createMinimalOp();
			let captured: (ExecutionMeta & { error: ExecutionError }) | null = null;
			const hooks = {
				onError: (meta: ExecutionMeta & { error: ExecutionError }) => {
					captured = meta;
				},
			};
			const result = await execute(op, {}, ctx, "http", { hooks });
			expect(result.ok).toBe(false);
			if (result.ok) return;
			expect(result.error.phase).toBe("validation");
			expect(captured).not.toBeNull();
			if (!captured) return;
			const err = (captured as ExecutionMeta & { error: ExecutionError }).error;
			expect(err.phase).toBe("validation");
			if (err.phase === "validation" && "issues" in err) {
				expect(Array.isArray(err.issues)).toBe(true);
			}
		});

		test("onError called on domain-guard failure", async () => {
			const op = createOpWithFailingDomainGuard();
			let capturedPhase: string | null = null;
			const hooks = {
				onError: (meta: ExecutionMeta & { error: ExecutionError }) => {
					capturedPhase = meta.phase;
					if (meta.error.phase === "domain-guard") {
						expect(meta.error.code).toBe("test_guard_failed");
					}
				},
			};
			const result = await execute(op, { id: "x" }, ctx, "http", { hooks });
			expect(result.ok).toBe(false);
			expect(capturedPhase === "domain-guard").toBe(true);
		});

		test("onError called on handler failure", async () => {
			let capturedError: string | null = null;
			const hooks = {
				onError: (meta: ExecutionMeta & { error: ExecutionError }) => {
					expect(meta.phase).toBe("handler");
					if (meta.error.phase === "handler" && "error" in meta.error) {
						capturedError = meta.error.error;
					}
				},
			};
			const result = await execute(
				opWithFailingHandler,
				{ id: "z" },
				ctx,
				"http",
				{ hooks },
			);
			expect(result.ok).toBe(false);
			expect(capturedError === "handler_error").toBe(true);
		});

		test("throwing hook does not change execution result", async () => {
			const op = createMinimalOp();
			const hooks = {
				onPhaseStart: () => {
					throw new Error("hook failed");
				},
			};
			const result = await execute(op, { id: "x" }, ctx, "http", { hooks });
			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(result.value).toEqual({ id: "x" });
		});
	});

	describe("timeout", () => {
		test("when surface timeout is set and handler exceeds it, returns timeout error", async () => {
			const op = {
				...createMinimalOp(),
				expose: {
					...createMinimalOp().expose,
					http: {
						method: "POST" as const,
						path: "/test/slow",
						timeout: 50,
					},
				},
				handler: async (payload: { id: string }) => {
					await new Promise((r) => setTimeout(r, 200));
					return { ok: true as const, value: payload };
				},
			};
			const result = await execute(op, { id: "x" }, ctx, "http");
			expect(result.ok).toBe(false);
			if (result.ok) return;
			expect(result.error.phase).toBe("timeout");
			if (result.error.phase === "timeout") {
				expect(result.error.timeoutMs).toBe(50);
			}
		});

		test("when surface timeout is set and handler completes in time, returns success", async () => {
			const op = {
				...createMinimalOp(),
				expose: {
					...createMinimalOp().expose,
					http: {
						method: "POST" as const,
						path: "/test/fast",
						timeout: 500,
					},
				},
			};
			const result = await execute(op, { id: "x" }, ctx, "http");
			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(result.value).toEqual({ id: "x" });
		});

		test("when no timeout is set, execution runs without time limit", async () => {
			const result = await execute(createMinimalOp(), { id: "x" }, ctx, "http");
			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(result.value).toEqual({ id: "x" });
		});
	});

	describe("external signal (aborted)", () => {
		test("when options.signal is already aborted, returns aborted error", async () => {
			const controller = new AbortController();
			controller.abort();
			const result = await execute(
				createMinimalOp(),
				{ id: "x" },
				ctx,
				"http",
				{ signal: controller.signal },
			);
			expect(result.ok).toBe(false);
			if (result.ok) return;
			expect(result.error.phase).toBe("aborted");
		});

		test("when options.signal aborts during run, returns aborted error", async () => {
			const controller = new AbortController();
			const op = {
				...createMinimalOp(),
				handler: async (payload: { id: string }) => {
					await new Promise((r) => setTimeout(r, 100));
					return { ok: true as const, value: payload };
				},
			};
			const resultPromise = execute(op, { id: "x" }, ctx, "http", {
				signal: controller.signal,
			});
			setTimeout(() => controller.abort(), 10);
			const result = await resultPromise;
			expect(result.ok).toBe(false);
			if (result.ok) return;
			expect(result.error.phase).toBe("aborted");
		});

		test("when no signal is passed, execution runs without external abort", async () => {
			const result = await execute(createMinimalOp(), { id: "x" }, ctx, "http");
			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(result.value).toEqual({ id: "x" });
		});
	});

	describe("dry-run", () => {
		test("when dryRun is true, handler is skipped and value is undefined", async () => {
			let handlerRan = false;
			const op = {
				...createMinimalOp(),
				handler: async (payload: { id: string }) => {
					handlerRan = true;
					return { ok: true as const, value: payload };
				},
			};
			const result = await execute(op, { id: "x" }, ctx, "http", {
				dryRun: true,
			});
			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(result.value).toBeUndefined();
			expect(handlerRan).toBe(false);
		});
	});
});
