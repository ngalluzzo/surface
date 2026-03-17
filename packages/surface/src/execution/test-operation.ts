import type { ZodType } from "zod";
import type {
	DefaultContext,
	ExecutionError,
	ExecutionState,
	LifecycleHooks,
	Operation,
} from "../operation/types";
import type { Result } from "./result";
import { runPipeline } from "./run-pipeline";
import {
	makeDomainGuardStage,
	makeHandlerStage,
	makeValidationStage,
} from "./stages";

/**
 * Runs an operation in a test environment: skips surface guards, runs schema
 * validation and domain guards + handler with injectable context.
 *
 * Use this to test operations without mocking HTTP/CLI surface or surface
 * guards. Context is whatever you pass; domain guards and handler run as in
 * production. Errors can be validation, domain-guard, or handler (never
 * surface-guard).
 *
 * @see {@link execute} for the full four-phase pipeline
 */
export async function testOperation<
	TPayload,
	TOutput,
	TError extends string,
	C extends DefaultContext = DefaultContext,
>(
	op: Operation<ZodType, TPayload, TOutput, TError, C>,
	raw: unknown,
	ctx: C,
	options?: { hooks?: LifecycleHooks; dryRun?: boolean },
): Promise<Result<TOutput, ExecutionError>> {
	const stageEntries = [
		{
			phase: "validation" as const,
			stage: makeValidationStage<TPayload, TOutput, TError, C>(),
		},
		{
			phase: "domain-guard" as const,
			stage: makeDomainGuardStage<TPayload, TOutput, TError, C>(),
		},
		{
			phase: "handler" as const,
			stage: makeHandlerStage<TPayload, TOutput, TError, C>(),
		},
	];

	const initialState: ExecutionState<TPayload, TOutput, TError, C> = {
		raw,
		context: ctx,
		surface: "test",
		op,
		dryRun: options?.dryRun ?? false,
	};

	return runPipeline(stageEntries, initialState, options?.hooks);
}
