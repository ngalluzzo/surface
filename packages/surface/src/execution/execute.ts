import type { ZodType } from "zod";
import { bindingMeta, isBindingRef } from "../bindings";
import type {
	BaseSurfaceConfig,
	DefaultContext,
	ExecutionError,
	ExecutionState,
	ExposeSurface,
	LifecycleHooks,
	Operation,
} from "../operation/types";
import { applyTimeout } from "./apply-timeout";
import type { Result } from "./result";
import { runPipeline } from "./run-pipeline";
import {
	makeDomainGuardStage,
	makeHandlerStage,
	makeSurfaceGuardStage,
	makeValidationStage,
} from "./stages";
import { withAbortRace } from "./with-abort-race";

/**
 * Executes an operation through all four phases:
 * surface guards → validation → domain guards → handler.
 *
 * Surface adapters (HTTP, CLI, job) call this — they never execute
 * guards or handlers directly.
 *
 * @see {@link Operation} for the operation shape
 * @see {@link ExecutionError} for typed phase failures
 */
export async function execute<
	TPayload,
	TOutput,
	TError extends string,
	C extends DefaultContext = DefaultContext,
>(
	op: Operation<ZodType, TPayload, TOutput, TError, C>,
	raw: unknown,
	ctx: C,
	surface: ExposeSurface,
	surfaceConfig: BaseSurfaceConfig<TPayload, C> | undefined,
	options?: {
		hooks?: LifecycleHooks;
		signal?: AbortSignal;
		dryRun?: boolean;
		/** When set, adapters can use it for response caching or dedup; execute() does not perform store lookups. */
		idempotencyKey?: string;
		binding?: Parameters<typeof bindingMeta>[0] | ReturnType<typeof bindingMeta>;
	},
): Promise<Result<TOutput, ExecutionError>> {
	const { contextToUse, controller, timeoutMs } = applyTimeout(
		ctx,
		surfaceConfig,
		options?.signal,
	);

	const stageEntries = [
		{
			phase: "surface-guard" as const,
			stage: makeSurfaceGuardStage<TPayload, TOutput, TError, C>(),
		},
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
		context: contextToUse,
		surface,
		surfaceConfig,
		...(options?.binding !== undefined && {
			binding: isBindingRef(options.binding)
				? bindingMeta(options.binding)
				: options.binding,
		}),
		op,
		dryRun: options?.dryRun ?? false,
	};

	const runPromise = runPipeline(stageEntries, initialState, options?.hooks);
	return withAbortRace(runPromise, controller, options?.signal, timeoutMs);
}
