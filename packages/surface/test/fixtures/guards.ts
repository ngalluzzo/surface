import type {
	DefaultContext,
	GuardError,
	SurfaceContext,
} from "../../src/index.js";

/** Domain guard that always passes. Use for omit/replace tests. */
export async function assertAlwaysPass(
	_payload: unknown,
	_ctx: DefaultContext,
): Promise<{ ok: true; value: undefined }> {
	return { ok: true, value: undefined };
}

/** Domain guard that always fails with a known code. */
export async function assertAlwaysFail(
	_payload: unknown,
	_ctx: DefaultContext,
): Promise<{ ok: false; error: GuardError }> {
	return { ok: false, error: { code: "test_guard_failed", message: "fail" } };
}

/** Surface guard that always passes. */
export async function surfaceGuardPass(
	_raw: unknown,
	_ctx: SurfaceContext<DefaultContext>,
): Promise<{ ok: true; value: undefined }> {
	return { ok: true, value: undefined };
}

/** Surface guard that always fails. */
export async function surfaceGuardFail(
	_raw: unknown,
	_ctx: SurfaceContext<DefaultContext>,
): Promise<{ ok: false; error: GuardError }> {
	return { ok: false, error: { code: "unauthorized", message: "no auth" } };
}

/** Domain guard that enriches context with session. Used for context-enrichment tests. */
export async function attachSession(
	_payload: unknown,
	_ctx: DefaultContext,
): Promise<{ ok: true; value: { session: string } }> {
	return { ok: true, value: { session: "resolved" } };
}
