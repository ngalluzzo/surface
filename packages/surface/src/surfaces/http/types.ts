import type { DefaultContext } from "../../operation/types";

export interface HttpRequest {
	method: string;
	path: string;
	body: unknown;
	params?: Record<string, string | undefined>;
	query?: Record<string, string | string[] | undefined>;
	headers: Record<string, string | string[] | undefined>;
	/** Optional AbortSignal (e.g. from request disconnect). When aborted, execution returns phase "aborted". */
	signal?: AbortSignal;
	/** Optional idempotency key (e.g. from Idempotency-Key header). When set with a store, duplicate requests return cached response. */
	idempotencyKey?: string;
}

export interface HttpResponse {
	status: number;
	/** For stream operations, body may be a ReadableStream; otherwise JSON-serializable value. */
	body: unknown | ReadableStream<Uint8Array>;
}

export type HttpHandler<C extends DefaultContext = DefaultContext> = (
	req: HttpRequest,
	ctx: C,
) => Promise<HttpResponse>;
