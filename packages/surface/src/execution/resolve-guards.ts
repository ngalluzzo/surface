import type {
	DefaultContext,
	DomainGuard,
	GuardOrPolicy,
	GuardOverride,
	SurfaceGuard,
} from "../operation/types";

/**
 * Resolves which surface guards run in phase 1 based on the override config.
 * Surface guards are {@link SurfaceGuard} functions that receive raw input.
 * Top-level op.guards are domain guards/policies; only override supplies surface guards.
 */
export function resolveSurfaceGuards<TPayload, C extends DefaultContext>(
	_topLevel: GuardOrPolicy<TPayload, C>[],
	override: GuardOverride<TPayload, C> | undefined,
): SurfaceGuard<C>[] {
	if (!override) return [];
	if ("prepend" in override) return override.prepend as SurfaceGuard<C>[];
	if ("replace" in override) return override.replace as SurfaceGuard<C>[];
	if ("append" in override) return override.append as SurfaceGuard<C>[];
	return [];
}

function expandGuardEntries<TPayload, C extends DefaultContext>(
	topLevel: GuardOrPolicy<TPayload, C>[],
): Array<{ name: string; guards: DomainGuard<TPayload, C>[] }> {
	return topLevel.map((item) =>
		typeof item === "function"
			? { name: item.name, guards: [item] }
			: { name: item.name, guards: item.guards },
	);
}

/**
 * Resolves which domain guards run in phase 3 based on the override config.
 * Expands policies to entries and applies omit by name (guard or policy name).
 */
export function resolveDomainGuards<TPayload, C extends DefaultContext>(
	topLevel: GuardOrPolicy<TPayload, C>[],
	override: GuardOverride<TPayload, C> | undefined,
): Array<{ name: string; guards: DomainGuard<TPayload, C>[] }> {
	const entries = expandGuardEntries(topLevel);
	if (!override) return entries;
	if ("replace" in override) return [];
	if ("omit" in override) {
		const omitNames = new Set(
			override.omit.map((x) => (typeof x === "string" ? x : x.name)),
		);
		return entries.filter((e) => !omitNames.has(e.name));
	}
	if ("prepend" in override || "append" in override) return entries;
	return entries;
}
