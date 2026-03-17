import type { BindingRef } from "../bindings";
import {
	isBindingRef,
	parseBindingKey,
	serializeBindingRef,
} from "../bindings";
import type { RegistryContract } from "../client/types";
import type {
	EventBindingDefinition,
	EventBindingsFromContract,
	EventBindingsRecord,
	EventClientPublish,
	EventClientPublishUnknown,
	EventMap,
	EventPublishLike,
} from "./types";

export interface CreateEventClientOptions<
	TBindings extends EventBindingsRecord,
> {
	transport: EventPublishLike;
	bindings: TBindings;
}

export interface CreateEventClientOptionsFromContract<
	R extends RegistryContract,
> {
	transport: EventPublishLike;
	eventMap: EventMap<R>;
}

function resolveEventBindingKey(binding: string | { key: string }): string {
	return typeof binding === "string" ? binding : binding.key;
}

function resolveEventClientBindingKey(
	binding: string | { key: string } | BindingRef,
): string {
	if (isBindingRef(binding)) {
		if (binding.surface !== "event") {
			throw new Error(
				`Event client received ${binding.surface} binding ref; expected event`,
			);
		}
		return serializeBindingRef(binding);
	}

	return resolveEventBindingKey(binding as string | { key: string });
}

export function createEventClient<const TBindings extends EventBindingsRecord>(
	options: CreateEventClientOptions<TBindings>,
): {
	bindings: TBindings;
	publish: EventClientPublish<TBindings>;
	publishUnknown: EventClientPublishUnknown;
} {
	const { transport, bindings } = options;

	const publishByKey = async (key: string, payload: unknown): Promise<void> => {
		const config = bindings[key as keyof TBindings];
		if (!config) {
			throw new Error(`Unknown event binding: ${key}`);
		}
		const { topic, source } = config;
		await transport.publish(
			topic,
			payload,
			source !== undefined ? { source } : undefined,
		);
	};

	return {
		bindings,
		publish: (async (binding: unknown, payload: unknown) => {
			const key = resolveEventClientBindingKey(
				binding as string | EventBindingDefinition | BindingRef,
			);
			await publishByKey(key, payload);
		}) as EventClientPublish<TBindings>,
		publishUnknown: async (
			binding: string | EventBindingDefinition | BindingRef,
			payload: unknown,
		) => {
			const key = resolveEventClientBindingKey(binding);
			await publishByKey(key, payload);
		},
	};
}

export function createEventClientFromMap<R extends RegistryContract>(
	options: CreateEventClientOptionsFromContract<R>,
): {
	bindings: EventBindingsFromContract<R>;
	publish: EventClientPublish<EventBindingsFromContract<R>>;
	publishUnknown: EventClientPublishUnknown;
} {
	const bindings = Object.fromEntries(
		Object.entries(options.eventMap).map(([key, binding]) => [
			key,
			{
				key,
				ref: parseBindingKey("event", key),
				topic: binding.topic,
				...(binding.source && { source: binding.source }),
			},
		]),
	) as EventBindingsFromContract<R>;

	return createEventClient({
		transport: options.transport,
		bindings,
	});
}
