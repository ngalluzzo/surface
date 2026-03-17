import {
	isBindingRef,
	parseBindingKey,
	serializeBindingRef,
} from "../bindings";
import type { Result } from "../execution/result";
import type { ExecutionError } from "../operation/types";
import type {
	CreateClientOptions,
	CreateClientOptionsFromContract,
	HttpBindingsFromContract,
	HttpBindingsRecord,
	HttpClient,
	HttpMap,
	RegistryContract,
} from "./types";

const RESERVED_HTTP_CLIENT_KEYS = new Set([
	"bindings",
	"invoke",
	"invokeUnknown",
]);

function resolveHttpBindingKey(binding: string | { key: string }): string {
	return typeof binding === "string" ? binding : binding.key;
}

function resolveHttpClientBindingKey(
	binding:
		| string
		| { key: string }
		| { surface: string; operation: string; binding: string },
): string {
	if (isBindingRef(binding)) {
		if (binding.surface !== "http") {
			throw new Error(
				`HTTP client received ${binding.surface} binding ref; expected http`,
			);
		}
		return serializeBindingRef(binding);
	}

	return resolveHttpBindingKey(binding as string | { key: string });
}

async function invokeHttpBinding(
	baseUrl: string,
	headers: (() => Record<string, string>) | undefined,
	binding: { method: string; path: string },
	input: unknown,
): Promise<Result<unknown, ExecutionError>> {
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
}

/**
 * Primary HTTP client constructor: infer everything from typed binding definitions.
 */
export function createClient<const TBindings extends HttpBindingsRecord>(
	options: CreateClientOptions<TBindings>,
): HttpClient<TBindings> {
	const { baseUrl, headers, bindings } = options;
	const keys = Object.keys(bindings) as (keyof TBindings)[];

	for (const key of keys) {
		if (RESERVED_HTTP_CLIENT_KEYS.has(key as string)) {
			throw new Error(
				`HTTP binding key "${String(key)}" is reserved by the client API`,
			);
		}
	}

	const client = {} as HttpClient<TBindings>;

	const invokeByKey = async (
		key: string,
		input: unknown,
	): Promise<Result<unknown, ExecutionError>> => {
		const binding = bindings[key as keyof TBindings];
		if (!binding) {
			throw new Error(`Unknown HTTP binding: ${key}`);
		}
		return invokeHttpBinding(baseUrl, headers, binding, input);
	};

	for (const key of keys) {
		client[key] = ((input: unknown) =>
			invokeByKey(key as string, input)) as HttpClient<TBindings>[typeof key];
	}

	client.bindings = bindings;
	client.invoke = (async (binding: unknown, input: unknown) => {
		return invokeByKey(
			resolveHttpClientBindingKey(
				binding as
					| string
					| { key: string }
					| { surface: string; operation: string; binding: string },
			),
			input,
		);
	}) as HttpClient<TBindings>["invoke"];
	client.invokeUnknown = async (binding, input) => {
		return invokeByKey(resolveHttpClientBindingKey(binding), input);
	};

	return client;
}

/**
 * Manual fallback for callers who only have an httpMap contract.
 */
export function createClientFromHttpMap<R extends RegistryContract>(
	options: CreateClientOptionsFromContract<R>,
): HttpClient<HttpBindingsFromContract<R>> {
	const bindings = Object.fromEntries(
		Object.entries(options.httpMap as HttpMap<R>).map(([key, binding]) => [
			key,
			{
				key,
				ref: parseBindingKey("http", key),
				method: binding.method,
				path: binding.path,
			},
		]),
	) as HttpBindingsFromContract<R>;

	return createClient({
		baseUrl: options.baseUrl,
		bindings,
		...(options.headers ? { headers: options.headers } : {}),
	});
}
