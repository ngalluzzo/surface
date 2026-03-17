import type { DefaultContext } from "./default-context";
import type { Surface } from "./surface-config";

/**
 * Surface-specific context extension — available to surface guards only.
 */
export interface SurfaceContext<C extends DefaultContext, TRaw = unknown> {
	context: C;
	raw: TRaw;
	surface: Surface;
}
