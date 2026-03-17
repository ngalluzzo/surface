/**
 * Minimal handle for a WebSocket connection. Consumer wraps their socket (e.g. from `ws`)
 * in this interface. Used for sending responses and for subscription hub to push messages.
 */
export interface WsConnectionLike {
	send(data: unknown): void | Promise<void>;
	/** Optional: stable id for correlation / hub internals. */
	id?: string;
}

/** Incoming RPC message: op name, optional payload, optional correlation id. */
export interface WsMessage {
	op: string;
	payload?: unknown;
	id?: string | number;
}

/** RPC response: correlation id, ok flag, value or error. For stream ops, multiple messages: stream chunks then done. */
export interface WsResponse {
	id?: string | number;
	ok: boolean;
	value?: unknown;
	error?: unknown;
	/** When true, this message is a stream chunk or stream done. */
	stream?: true;
	/** Stream chunk (when stream is true and done is not). */
	chunk?: unknown;
	/** When true with stream, indicates stream end. */
	done?: true;
}

/** Handlers returned by buildWsHandlers. Consumer wires these to their server lifecycle. */
export interface WsHandlers<_C> {
	onConnect(connection: WsConnectionLike): void;
	onMessage(
		connection: WsConnectionLike,
		message: unknown,
	): void | Promise<void>;
	onDisconnect(connection: WsConnectionLike): void;
}
