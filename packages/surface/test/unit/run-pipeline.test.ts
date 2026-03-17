import { describe, expect, test } from "bun:test";
import { runPipeline } from "../../src/execution/run-pipeline.js";
import type {
	DefaultContext,
	ExecutionError,
	ExecutionState,
} from "../../src/index.js";
import { createMockContext } from "../fixtures/context.js";
import {
	createMinimalOp,
	createOpWithFailingDomainGuard,
} from "../fixtures/operations.js";

const ctx = createMockContext();

describe("runPipeline", () => {
	test("runs stages in order and returns final output", async () => {
		const op = createMinimalOp();
		const {
			makeSurfaceGuardStage,
			makeValidationStage,
			makeDomainGuardStage,
			makeHandlerStage,
		} = await import("../../src/execution/stages/index.js");
		type Payload = { id: string };
		const stageEntries = [
			{
				phase: "surface-guard" as const,
				stage: makeSurfaceGuardStage<
					Payload,
					Payload,
					string,
					DefaultContext
				>(),
			},
			{
				phase: "validation" as const,
				stage: makeValidationStage<Payload, Payload, string, DefaultContext>(),
			},
			{
				phase: "domain-guard" as const,
				stage: makeDomainGuardStage<Payload, Payload, string, DefaultContext>(),
			},
			{
				phase: "handler" as const,
				stage: makeHandlerStage<Payload, Payload, string, DefaultContext>(),
			},
		];
		const initialState: ExecutionState<
			Payload,
			Payload,
			string,
			DefaultContext
		> = {
			raw: { id: "p" },
			context: ctx,
			surface: "http",
			op,
		};
		const result = await runPipeline<Payload, Payload, string, DefaultContext>(
			stageEntries,
			initialState,
			undefined,
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value).toEqual({ id: "p" });
	});

	test("calls onPhaseStart and onPhaseEnd in order; onError on failure", async () => {
		const op = createOpWithFailingDomainGuard();
		const { makeValidationStage, makeDomainGuardStage, makeHandlerStage } =
			await import("../../src/execution/stages/index.js");
		const phases: string[] = [];
		const hooks = {
			onPhaseStart: (meta: { phase: string }) => {
				phases.push(`start:${meta.phase}`);
			},
			onPhaseEnd: (meta: { phase: string }) => {
				phases.push(`end:${meta.phase}`);
			},
			onError: (meta: { phase: string; error: ExecutionError }) => {
				phases.push(`error:${meta.phase}`);
			},
		};
		type Payload = { id: string };
		const stageEntries = [
			{
				phase: "validation" as const,
				stage: makeValidationStage<Payload, Payload, string, DefaultContext>(),
			},
			{
				phase: "domain-guard" as const,
				stage: makeDomainGuardStage<Payload, Payload, string, DefaultContext>(),
			},
			{
				phase: "handler" as const,
				stage: makeHandlerStage<Payload, Payload, string, DefaultContext>(),
			},
		];
		const initialState: ExecutionState<
			Payload,
			Payload,
			string,
			DefaultContext
		> = {
			raw: { id: "x" },
			context: ctx,
			surface: "test",
			op,
		};
		const result = await runPipeline<Payload, Payload, string, DefaultContext>(
			stageEntries,
			initialState,
			hooks,
		);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.phase).toBe("domain-guard");
		expect(phases).toEqual([
			"start:validation",
			"end:validation",
			"start:domain-guard",
			"end:domain-guard",
			"error:domain-guard",
		]);
	});
});
