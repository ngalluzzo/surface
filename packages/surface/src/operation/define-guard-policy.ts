import type { DefaultContext, DomainGuard, GuardPolicy } from "./types";

/**
 * Defines a named group of domain guards for reuse and omit-by-name.
 *
 * @example
 * ```ts
 * export const adminOnly = defineGuardPolicy("adminOnly", [
 *   requireSession,
 *   requireRole("admin"),
 * ]);
 * // In an operation:
 * guards: [adminOnly, assertEventHasCapacity],
 * expose: {
 *   cli: { guards: { omit: ["adminOnly"] } }, // trusted surface skips auth
 * }
 * ```
 */
export function defineGuardPolicy<TPayload, C extends DefaultContext>(
	name: string,
	guards: DomainGuard<TPayload, C>[],
): GuardPolicy<TPayload, C> {
	return { name, guards };
}
