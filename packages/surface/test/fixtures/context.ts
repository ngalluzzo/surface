import type { DefaultContext } from "../../src/index.js";

/**
 * Mock context for tests. Use when no real db is needed — execute and adapters
 * only pass ctx through to guards and handlers.
 */
export function createMockContext(): DefaultContext {
	return { db: {} };
}
