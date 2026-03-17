import type {
	AnyOperation,
	DefaultContext,
	ExecutionError,
	ExecutionState,
	InputOf,
	LifecycleHooks,
	OutputOf,
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
	TOperation extends AnyOperation<C>,
	C extends DefaultContext = DefaultContext,
>(
	op: TOperation,
	raw: unknown,
	ctx: C,
	options?: { hooks?: LifecycleHooks; dryRun?: boolean },
): Promise<Result<OutputOf<TOperation>, ExecutionError>> {
	const stageEntries = [
		{
			phase: "validation" as const,
			stage: makeValidationStage<
				InputOf<TOperation>,
				OutputOf<TOperation>,
				string,
				C
			>(),
		},
		{
			phase: "domain-guard" as const,
			stage: makeDomainGuardStage<
				InputOf<TOperation>,
				OutputOf<TOperation>,
				string,
				C
			>(),
		},
		{
			phase: "handler" as const,
			stage: makeHandlerStage<
				InputOf<TOperation>,
				OutputOf<TOperation>,
				string,
				C
			>(),
		},
	];

	const initialState: ExecutionState<
		InputOf<TOperation>,
		OutputOf<TOperation>,
		string,
		C
	> = {
		raw,
		context: ctx,
		surface: "test",
		surfaceConfig: undefined,
		op,
		dryRun: options?.dryRun ?? false,
	};

	return runPipeline(stageEntries, initialState, options?.hooks);
}
