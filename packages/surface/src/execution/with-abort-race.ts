import type { ExecutionError } from "../operation/types";
import type { Result } from "./result";

/**
 * Races runPromise against optional timeout and external abort.
 * On timeout or abort: clears timeout, aborts controller, swallows run rejection, returns typed error.
 */
export async function withAbortRace<TOutput>(
	runPromise: Promise<Result<TOutput, ExecutionError>>,
	controller: AbortController | null,
	externalSignal: AbortSignal | undefined | null,
	timeoutMs: number,
): Promise<Result<TOutput, ExecutionError>> {
	const hasTimeout = timeoutMs > 0 && controller;
	const hasExternalSignal =
		externalSignal !== undefined && externalSignal !== null;

	if (!hasTimeout && !hasExternalSignal) {
		return runPromise;
	}

	let timeoutId: ReturnType<typeof setTimeout> | undefined;
	const promises: Promise<Result<TOutput, ExecutionError>>[] = [runPromise];

	if (hasTimeout && controller) {
		promises.push(
			new Promise<Result<TOutput, ExecutionError>>((resolve) => {
				timeoutId = setTimeout(
					() =>
						resolve({
							ok: false,
							error: { phase: "timeout", timeoutMs },
						}),
					timeoutMs,
				);
			}),
		);
	}

	if (hasExternalSignal && externalSignal) {
		promises.push(
			new Promise<Result<TOutput, ExecutionError>>((resolve) => {
				if (externalSignal.aborted) {
					resolve({ ok: false, error: { phase: "aborted" } });
					return;
				}
				externalSignal.addEventListener(
					"abort",
					() => resolve({ ok: false, error: { phase: "aborted" } }),
					{ once: true },
				);
			}),
		);
	}

	const result = await Promise.race(promises);
	if (timeoutId !== undefined) clearTimeout(timeoutId);
	if (
		!result.ok &&
		(result.error.phase === "timeout" || result.error.phase === "aborted")
	) {
		controller?.abort();
		runPromise.catch(() => {});
	}
	return result;
}
