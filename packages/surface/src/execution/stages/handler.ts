import type {
	DefaultContext,
	ExecutionError,
	Stage,
} from "../../operation/types";

/**
 * Stage 4: run handler (or skip when dryRun), validate output schema.
 */
export function makeHandlerStage<
	TPayload,
	TOutput,
	TError extends string,
	C extends DefaultContext,
>(): Stage<TPayload, TOutput, TError, C> {
	return async (state) => {
		const { op, payload, context, dryRun } = state;

		if (dryRun) {
			return { ok: true, state };
		}

		if (payload === undefined) {
			return {
				ok: false,
				error: {
					phase: "validation",
					issues: [{ message: "Payload required for handler" }],
				} satisfies ExecutionError,
			};
		}

		const result = await op.handler(payload, context);
		if (!result.ok) {
			return {
				ok: false,
				error: { phase: "handler", error: result.error } as ExecutionError,
			};
		}

		if (op.outputChunkSchema != null) {
			const value = result.value;
			const isStream =
				value != null &&
				typeof (value as Record<symbol, unknown>)[Symbol.asyncIterator] ===
					"function";
			if (!isStream) {
				return {
					ok: false,
					error: {
						phase: "handler",
						error:
							"Stream operation handler must return an AsyncIterable when outputChunkSchema is set",
					} satisfies ExecutionError,
				};
			}
			return {
				ok: true,
				state: { ...state, output: value as TOutput },
			};
		}

		const outputParsed = op.outputSchema.safeParse(result.value);
		if (!outputParsed.success) {
			return {
				ok: false,
				error: {
					phase: "handler",
					outputValidation: true,
					issues: outputParsed.error.issues,
				} satisfies ExecutionError,
			};
		}

		return {
			ok: true,
			state: { ...state, output: outputParsed.data as TOutput },
		};
	};
}
