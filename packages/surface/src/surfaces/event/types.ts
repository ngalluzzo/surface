/**
 * Definition for a single event consumer. The adapter builds one per event-exposed operation.
 * Handler receives the raw broker message; adapter runs parsePayload → schema.parse → execute.
 * Throw NonRetryableError to signal dead-letter (do not retry); other throws signal retry.
 */
export interface EventConsumerDefinition {
	name: string;
	topic: string;
	source?: string;
	parsePayload: (raw: unknown) => unknown;
	handler: (raw: unknown) => Promise<void>;
}

/**
 * Transport contract for event/message buses (Kafka, SQS, EventBridge, etc.).
 * Implementations register consumers and invoke handler(raw) for each message.
 */
export interface EventTransportLike {
	register(definition: EventConsumerDefinition): void;
}

export { NonRetryableError } from "../job/types";
