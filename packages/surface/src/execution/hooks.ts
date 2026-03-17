/** Invokes a lifecycle hook; errors are caught so they do not affect execution result. */
export async function runHook(
	fn: (() => void | Promise<void>) | undefined,
): Promise<void> {
	if (!fn) return;
	try {
		await fn();
	} catch {
		// Hook errors are not propagated so instrumentation does not break callers.
	}
}
