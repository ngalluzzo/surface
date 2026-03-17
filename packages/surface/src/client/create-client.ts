import { isBindingRef, parseBindingKey, serializeBindingRef } from "../bindings";
import type { Result } from "../execution/result";
import type { ExecutionError } from "../operation/types";
import type {
	CreateClientOptions,
	HttpBindingDefinition,
	HttpBindings,
	HttpClient,
	HttpMap,
	RegistryContract,
} from "./types";

function toBindings<R extends RegistryContract>(
	options: CreateClientOptions<R>,
): HttpBindings<R> {
	if (options.bindings) {
		return options.bindings;
	}
	if (!options.httpMap) {
		throw new Error(
			'createClient requires either "bindings" or "httpMap"',
		);
	}
	const map = options.httpMap as HttpMap<R>;
	return Object.fromEntries(
		Object.entries(map).map(([key, binding]) => [
			key,
			{
				key,
				ref: parseBindingKey(key),
				method: binding.method,
				path: binding.path,
			},
		]),
	) as HttpBindings<R>;
}

function resolveHttpBindingKey(binding: string | HttpBindingDefinition): string {
	return typeof binding === "string" ? binding : binding.key;
}

/**
 * Creates a type-safe HTTP client for the given registry contract.
 * Each operation is exposed as an async function (input) => Promise<Result<Output, ExecutionError>>.
 * Uses fetch; framework-agnostic. For React, use @atlas/ops/client/react.
 */
export function createClient<R extends RegistryContract>(
	options: CreateClientOptions<R>,
): HttpClient<R> {
	const { baseUrl, headers } = options;
	const bindings = toBindings(options);
	const keys = Object.keys(bindings) as (keyof R)[];

	const client = {} as HttpClient<R>;

	const invokeByKey = async (
		key: string,
		input: unknown,
	): Promise<Result<unknown, ExecutionError>> => {
		const binding = bindings[key as keyof typeof bindings];
		if (!binding) {
			throw new Error(`Unknown HTTP binding: ${key}`);
		}
		const { method, path } = binding;
		const url = `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;

		const h: Record<string, string> = {
			"Content-Type": "application/json",
			...(typeof headers === "function" ? headers() : {}),
		};

		const init: RequestInit = {
			method,
			headers: h,
		};
		if (method !== "GET") {
			init.body = JSON.stringify(input);
		}
		const res = await fetch(url, init);

		const body = await res.json().catch(() => ({}));

		if (!res.ok) {
			const error = (body?.error ?? body) as ExecutionError;
			return { ok: false as const, error };
		}

		if (body?.ok === false && "error" in body) {
			return { ok: false as const, error: body.error as ExecutionError };
		}

		const value = body?.value ?? body;
		return { ok: true as const, value };
	};

	for (const key of keys) {
		client[key] = ((input: unknown) =>
			invokeByKey(key as string, input)) as HttpClient<R>[typeof key];
	}

	client.bindings = bindings;
	client.invoke = (async (binding: unknown, input: unknown) => {
		if (isBindingRef(binding)) {
			return invokeByKey(serializeBindingRef(binding), input);
		}

		return invokeByKey(
			resolveHttpBindingKey(binding as string | HttpBindingDefinition),
			input,
		);
	}) as HttpClient<R>["invoke"];

	return client;
}
