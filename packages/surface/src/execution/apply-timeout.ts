import type { DefaultContext } from "../operation/types";

export interface SurfaceConfigWithTimeout {
	timeout?: number;
}

/**
 * Resolves context and optional AbortController from timeout and external signal.
 * When surface config has timeout > 0: creates a controller and uses its signal on context;
 * if externalSignal is provided, wires it to abort the controller so the handler sees either.
 * When no timeout but externalSignal: uses externalSignal on context.
 */
export function applyTimeout<C extends DefaultContext>(
	ctx: C,
	surfaceConfig: SurfaceConfigWithTimeout | undefined,
	externalSignal?: AbortSignal | null,
): {
	contextToUse: C;
	controller: AbortController | null;
	timeoutMs: number;
} {
	const timeoutMs =
		typeof surfaceConfig?.timeout === "number" && surfaceConfig.timeout > 0
			? surfaceConfig.timeout
			: 0;

	let contextToUse: C = ctx;
	let controller: AbortController | null = null;

	if (timeoutMs > 0) {
		controller = new AbortController();
		contextToUse = { ...ctx, signal: controller.signal } as C;
		if (externalSignal) {
			externalSignal.addEventListener("abort", () => controller?.abort(), {
				once: true,
			});
		}
	} else if (externalSignal) {
		contextToUse = { ...ctx, signal: externalSignal } as C;
	}

	return { contextToUse, controller, timeoutMs };
}
