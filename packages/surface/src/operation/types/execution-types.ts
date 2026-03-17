import type { BindingMeta } from "../../bindings";
import type { DefaultContext } from "./default-context";
import type { AnyOperation } from "./operation-types";
import type { BaseSurfaceConfig, Surface } from "./surface-config";

export type Phase =
	| "surface-guard"
	| "validation"
	| "domain-guard"
	| "handler"
	| "timeout"
	| "aborted";

export type ExecutionError =
	| { phase: "surface-guard"; code: string; message?: string }
	| { phase: "validation"; issues: unknown[] }
	| { phase: "domain-guard"; code: string; message?: string }
	| { phase: "handler"; error: string }
	| { phase: "handler"; outputValidation: true; issues: unknown[] }
	| { phase: "timeout"; timeoutMs: number }
	| { phase: "aborted" };

export interface ExecutionMeta {
	binding?: BindingMeta;
	operation: { name: string };
	phase: Phase;
	surface: Surface;
}

export interface LifecycleHooks {
	onPhaseStart?: (meta: ExecutionMeta) => void | Promise<void>;
	onPhaseEnd?: (
		meta: ExecutionMeta & { durationMs: number },
	) => void | Promise<void>;
	onError?: (
		meta: ExecutionMeta & { error: ExecutionError },
	) => void | Promise<void>;
}

/** Accumulated state passed through the pipeline; stages read and return updated state or error. */
export interface ExecutionState<
	TPayload,
	TOutput,
	_TError extends string,
	C extends DefaultContext,
> {
	raw: unknown;
	payload?: TPayload;
	output?: TOutput;
	context: C;
	surface: Surface;
	surfaceConfig: BaseSurfaceConfig<TPayload, C> | undefined;
	binding?: BindingMeta;
	op: AnyOperation<C>;
	dryRun?: boolean;
}

/** A pipeline stage: pure async function from state to updated state or typed failure. */
export type Stage<
	TPayload,
	TOutput,
	TError extends string,
	C extends DefaultContext,
> = (
	state: ExecutionState<TPayload, TOutput, TError, C>,
) => Promise<
	| { ok: true; state: ExecutionState<TPayload, TOutput, TError, C> }
	| { ok: false; error: ExecutionError }
>;
