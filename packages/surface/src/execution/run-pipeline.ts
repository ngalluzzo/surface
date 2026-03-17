import type {
	DefaultContext,
	ExecutionError,
	ExecutionState,
	LifecycleHooks,
	Phase,
	Stage,
} from "../operation/types";
import { runHook } from "./hooks";
import type { Result } from "./result";

export interface StageEntry<
	TPayload,
	TOutput,
	TError extends string,
	C extends DefaultContext,
> {
	phase: Phase;
	stage: Stage<TPayload, TOutput, TError, C>;
}

/**
 * Runs the pipeline: for each (phase, stage), invokes hooks and runs the stage.
 * Stops on first failure and returns the error; otherwise returns state.output.
 */
export async function runPipeline<
	TPayload,
	TOutput,
	TError extends string,
	C extends DefaultContext,
>(
	stageEntries: StageEntry<TPayload, TOutput, TError, C>[],
	initialState: ExecutionState<TPayload, TOutput, TError, C>,
	hooks: LifecycleHooks | undefined,
): Promise<Result<TOutput, ExecutionError>> {
	let state = initialState;

	for (const entry of stageEntries) {
		const meta = {
			operation: { name: state.op.name },
			phase: entry.phase,
			surface: state.surface,
		};
		const tStart = performance.now();

		await runHook(() => hooks?.onPhaseStart?.(meta));
		const result = await entry.stage(state);
		await runHook(() =>
			hooks?.onPhaseEnd?.({ ...meta, durationMs: performance.now() - tStart }),
		);

		if (!result.ok) {
			await runHook(() => hooks?.onError?.({ ...meta, error: result.error }));
			return result;
		}

		state = result.state;
	}

	// When dryRun is true, handler stage sets output to undefined; that is valid.
	return { ok: true, value: state.output as TOutput };
}
