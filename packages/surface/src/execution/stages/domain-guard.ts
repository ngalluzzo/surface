import type {
	DefaultContext,
	ExecutionError,
	ExposeSurface,
	Stage,
} from "../../operation/types";
import { resolveDomainGuards } from "../resolve-guards";

/**
 * Stage 3: run domain guards (business rules), merge context deltas.
 */
export function makeDomainGuardStage<
	TPayload,
	TOutput,
	TError extends string,
	C extends DefaultContext,
>(): Stage<TPayload, TOutput, TError, C> {
	return async (state) => {
		const { op, payload, context, surface } = state;
		if (payload === undefined) {
			return {
				ok: false,
				error: {
					phase: "validation",
					issues: [{ message: "Payload required for domain guards" }],
				} satisfies ExecutionError,
			};
		}
		const surfaceConfig = op.expose[surface as ExposeSurface];
		const entries = resolveDomainGuards(op.guards ?? [], surfaceConfig?.guards);
		let ctx: C = context;

		for (const entry of entries) {
			for (const guard of entry.guards) {
				const result = await guard(payload, ctx);
				if (!result.ok) {
					return {
						ok: false,
						error: {
							phase: "domain-guard",
							...result.error,
						} as ExecutionError,
					};
				}
				if (result.value !== undefined && result.value !== null) {
					ctx = { ...ctx, ...result.value } as C;
				}
			}
		}

		return { ok: true, state: { ...state, context: ctx } };
	};
}
