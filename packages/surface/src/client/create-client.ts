import type { Result } from "../execution/result";
import type { ExecutionError } from "../operation/types";
import type { CreateClientOptions, HttpMap, RegistryContract } from "./types";

/**
 * Creates a type-safe HTTP client for the given registry contract.
 * Each operation is exposed as an async function (input) => Promise<Result<Output, ExecutionError>>.
 * Uses fetch; framework-agnostic. For React, use @atlas/ops/client/react.
 */
export function createClient<R extends RegistryContract>(
	options: CreateClientOptions<R>,
): {
	[K in keyof R]: (
		input: R[K]["input"],
	) => Promise<Result<R[K]["output"], ExecutionError>>;
} {
	const { baseUrl, headers, httpMap } = options;
	const map = httpMap as HttpMap<R>;
	const keys = Object.keys(map) as (keyof R)[];

	const client = {} as {
		[K in keyof R]: (
			input: R[K]["input"],
		) => Promise<Result<R[K]["output"], ExecutionError>>;
	};

	for (const opName of keys) {
		const { method, path } = map[opName as keyof typeof map];
		const url = `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;

		client[opName] = async (input: unknown) => {
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
	}

	return client;
}
