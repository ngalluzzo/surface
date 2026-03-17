import type {
	DefaultContext,
	ExecutionError,
	Stage,
} from "../../operation/types";
import { resolveSurfaceGuards } from "../resolve-guards";

/**
 * Stage 1: run surface guards (auth, signature, etc.), merge context deltas.
 */
export function makeSurfaceGuardStage<
	TPayload,
	TOutput,
	TError extends string,
	C extends DefaultContext,
>(): Stage<TPayload, TOutput, TError, C> {
	return async (state) => {
		const { op, raw, context, surface, surfaceConfig } = state;
		const guards = resolveSurfaceGuards(op.guards ?? [], surfaceConfig?.guards);

		let ctx = context;
		const surfaceCtx = { context: ctx, raw, surface };

		for (const guard of guards) {
			const result = await guard(raw, surfaceCtx);
			if (!result.ok) {
				return {
					ok: false,
					error: { phase: "surface-guard", ...result.error } as ExecutionError,
				};
			}
			if (result.value !== undefined && result.value !== null) {
				ctx = { ...ctx, ...result.value } as C;
				surfaceCtx.context = ctx;
			}
		}

		return { ok: true, state: { ...state, context: ctx } };
	};
}
