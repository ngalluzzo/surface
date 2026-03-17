import type { RegistryContract } from "../client/types";

/**
 * Topic (and optional source) for each operation. Matches the operation's event config.
 * Can be built from the server registry or provided manually.
 */
export type EventMap<R extends RegistryContract> = {
	[K in keyof R]: { topic: string; source?: string };
};

/**
 * Transport that can publish to a topic. The app's event bus (SQS, Kafka, EventBridge, etc.) provides this.
 */
export interface EventPublishLike {
	publish(
		topic: string,
		payload: unknown,
		options?: { source?: string },
	): Promise<void>;
}

/**
 * Typed publish: (opName, payload) => Promise<void>. Topic comes from the event map.
 */
export type EventClientPublish<R extends RegistryContract> = <
	K extends keyof R,
>(
	opName: K,
	payload: R[K]["input"],
) => Promise<void>;
