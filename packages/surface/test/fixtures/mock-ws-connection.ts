import type { WsConnectionLike } from "../../src/index.js";

/**
 * Mock WsConnectionLike that records all sent messages. Use in adapters-ws tests.
 */
export function createMockWsConnection(): WsConnectionLike & {
	sent: unknown[];
} {
	const sent: unknown[] = [];
	return {
		id: `conn-${Math.random().toString(36).slice(2, 9)}`,
		send(data: unknown) {
			sent.push(data);
		},
		get sent() {
			return sent;
		},
	};
}
