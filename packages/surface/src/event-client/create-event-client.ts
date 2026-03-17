import type { RegistryContract } from "../client/types";
import type { EventClientPublish, EventMap, EventPublishLike } from "./types";

export interface CreateEventClientOptions<R extends RegistryContract> {
	/** Transport that can publish to a topic (e.g. SQS, Kafka client). */
	transport: EventPublishLike;
	/** Topic (and optional source) per binding key. Must match the Registry keys. */
	eventMap: EventMap<R>;
}

/**
 * Creates a type-safe event publish client. Payload is typed per operation;
 * topic and source come from the event map (from the operation's event config).
 */
export function createEventClient<R extends RegistryContract>(
	options: CreateEventClientOptions<R>,
): { publish: EventClientPublish<R> } {
	const { transport, eventMap } = options;
	const map = eventMap as EventMap<R>;

	return {
		publish: async (opName, payload) => {
			const { topic, source } = map[opName as keyof typeof map];
			await transport.publish(
				topic,
				payload,
				source !== undefined ? { source } : undefined,
			);
		},
	};
}
