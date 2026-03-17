import type { LifecycleHooks } from "../operation/types";

export { execute } from "./execute";
export { testOperation } from "./test-operation";

/**
 * Returns lifecycle hooks from a registry if it was composed with composeRegistries(..., { hooks }).
 * Adapters use this to pass hooks into execute().
 */
export function getHooks(registry: {
	hooks?: LifecycleHooks;
}): LifecycleHooks | undefined {
	return registry.hooks;
}
