import type { BindingRef } from "../bindings";
import { isBindingRef, parseBindingKey, serializeBindingRef } from "../bindings";
import type { RegistryContract } from "../client/types";
import type {
	EventBindingDefinition,
	EventBindings,
	EventClientPublishWithBinding,
	EventMap,
	EventPublishLike,
} from "./types";

export interface CreateEventClientOptions<R extends RegistryContract> {
	/** Transport that can publish to a topic (e.g. SQS, Kafka client). */
	transport: EventPublishLike;
	/** Preferred binding definitions keyed by serialized binding key. */
	bindings?: EventBindings<R>;
	/** Backward-compatible topic/source map keyed by serialized binding key. */
	eventMap?: EventMap<R>;
}

function toBindings<R extends RegistryContract>(
	options: CreateEventClientOptions<R>,
): EventBindings<R> {
	if (options.bindings) {
		return options.bindings;
	}
	if (!options.eventMap) {
		throw new Error(
			'createEventClient requires either "bindings" or "eventMap"',
		);
	}
	const map = options.eventMap as EventMap<R>;
	return Object.fromEntries(
		Object.entries(map).map(([key, binding]) => [
			key,
			{
				key,
				ref: parseBindingKey(key),
				topic: binding.topic,
				...(binding.source && { source: binding.source }),
			},
		]),
	) as EventBindings<R>;
}

function resolveEventBindingKey(binding: string | EventBindingDefinition): string {
	return typeof binding === "string" ? binding : binding.key;
}

/**
 * Creates a type-safe event publish client. Payload is typed per operation;
 * topic and source come from the event map (from the operation's event config).
 */
export function createEventClient<R extends RegistryContract>(
	options: CreateEventClientOptions<R>,
): {
	bindings: EventBindings<R>;
	publish: EventClientPublishWithBinding<R>;
} {
	const { transport } = options;
	const bindings = toBindings(options);

	return {
		bindings,
		publish: async (binding: string | EventBindingDefinition | BindingRef, payload: unknown) => {
			const key = isBindingRef(binding)
				? serializeBindingRef(binding)
				: resolveEventBindingKey(
						binding as string | EventBindingDefinition,
					);
			const config = bindings[key as keyof typeof bindings];
			if (!config) {
				throw new Error(`Unknown event binding: ${key}`);
			}
			const { topic, source } = config;
			await transport.publish(
				topic,
				payload,
				source !== undefined ? { source } : undefined,
			);
		},
	};
}
