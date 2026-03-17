import type {
	EventConsumerDefinition,
	EventTransportLike,
} from "../../src/index.js";

/**
 * Mock EventTransportLike that records register() calls. Use in adapters-event
 * tests to assert registerEventConsumers called transport.register with the
 * expected definitions, and to simulate delivery by invoking handler(raw).
 */
export function createMockEventTransport(): {
	transport: EventTransportLike;
	registered: EventConsumerDefinition[];
} {
	const registered: EventConsumerDefinition[] = [];
	const transport: EventTransportLike = {
		register(def) {
			registered.push(def);
		},
	};
	return { transport, registered };
}
