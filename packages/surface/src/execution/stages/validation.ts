import type {
	DefaultContext,
	ExecutionError,
	Stage,
} from "../../operation/types";

/**
 * Stage 2: parse raw input with operation schema; set payload on state or return validation error.
 */
export function makeValidationStage<
	TPayload,
	TOutput,
	TError extends string,
	C extends DefaultContext,
>(): Stage<TPayload, TOutput, TError, C> {
	return async (state) => {
		const parsed = state.op.schema.safeParse(state.raw);
		if (!parsed.success) {
			return {
				ok: false,
				error: {
					phase: "validation",
					issues: parsed.error.issues,
				} satisfies ExecutionError,
			};
		}
		return {
			ok: true,
			state: { ...state, payload: parsed.data as TPayload },
		};
	};
}
