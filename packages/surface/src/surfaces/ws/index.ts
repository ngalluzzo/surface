import { execute, getHooks } from "../../execution";
import type { OperationRegistryWithHooks } from "../../operation";
import { forSurface } from "../../operation";
import type {
	DefaultContext,
	ExecutionError,
	OperationRegistry,
} from "../../operation/types";
import type { WsConnectionLike, WsHandlers, WsResponse } from "./types";

export {
	createSubscriptionHub,
	type SubscriptionHubLike,
} from "./subscription-hub";
export type {
	WsConnectionLike,
	WsHandlers,
	WsMessage,
	WsResponse,
} from "./types";

export interface BuildWsHandlersOptions {
	/** Key in the incoming message that holds the operation name; defaults to "op". */
	messageKey?: string;
}

/**
 * Builds WebSocket lifecycle handlers: onConnect, onMessage, onDisconnect.
 * Consumer provides the server and getContext(connection); we handle message parsing,
 * operation dispatch, and execute. Response is always { id?, ok, value? | error? }.
 */
export function buildWsHandlers<C extends DefaultContext = DefaultContext>(
	registry: OperationRegistry<C> | OperationRegistryWithHooks<C>,
	getContext: (connection: WsConnectionLike) => C,
	options?: BuildWsHandlersOptions,
): WsHandlers<C> {
	const wsOps = forSurface(registry, "ws");
	const hooks = getHooks(wsOps);
	const messageKey = options?.messageKey ?? "op";

	async function sendResponse(
		connection: WsConnectionLike,
		response: WsResponse,
	): Promise<void> {
		await connection.send(response);
	}

	return {
		onConnect(_connection: WsConnectionLike) {
			// No-op; consumer can use this to store connection or create ctx.
		},

		async onMessage(connection: WsConnectionLike, message: unknown) {
			const raw =
				message != null && typeof message === "object" && messageKey in message
					? (message as Record<string, unknown>)
					: null;
			const opName =
				raw != null && typeof raw[messageKey] === "string"
					? (raw[messageKey] as string)
					: undefined;
			const payload = raw && "payload" in raw ? raw.payload : undefined;
			const id: string | number | undefined =
				raw &&
				"id" in raw &&
				(typeof raw.id === "string" || typeof raw.id === "number")
					? raw.id
					: undefined;

			if (opName === undefined || opName === "") {
				await sendResponse(connection, {
					...(id !== undefined && { id }),
					ok: false,
					error: {
						phase: "validation",
						issues: [{ message: "Missing or invalid op" }],
					} as ExecutionError,
				});
				return;
			}

			const op = wsOps.get(opName);
			if (!op) {
				await sendResponse(connection, {
					...(id !== undefined && { id }),
					ok: false,
					error: {
						phase: "validation",
						issues: [{ message: `Unknown operation: ${opName}` }],
					} as ExecutionError,
				});
				return;
			}

			const ctx = getContext(connection);
			const result = await execute(
				op,
				payload,
				ctx,
				"ws",
				hooks ? { hooks } : undefined,
			);

			if (!result.ok) {
				await sendResponse(connection, {
					...(id !== undefined && { id }),
					ok: false,
					error: result.error,
				});
				return;
			}

			const isStream =
				op.outputChunkSchema != null &&
				result.value != null &&
				typeof (result.value as AsyncIterable<unknown>)[
					Symbol.asyncIterator
				] === "function";

			if (isStream) {
				const iterable = result.value as AsyncIterable<unknown>;
				const schema = op.outputChunkSchema;
				try {
					for await (const chunk of iterable) {
						const validated =
							schema != null
								? schema.safeParse(chunk)
								: { success: true as const, data: chunk };
						if (!validated.success) {
							await sendResponse(connection, {
								...(id !== undefined && { id }),
								ok: false,
								error: {
									phase: "handler",
									outputValidation: true,
									issues: validated.error.issues,
								} as ExecutionError,
							});
							return;
						}
						await sendResponse(connection, {
							...(id !== undefined && { id }),
							ok: true,
							stream: true,
							chunk: validated.data,
						});
					}
					await sendResponse(connection, {
						...(id !== undefined && { id }),
						ok: true,
						stream: true,
						done: true,
					});
				} catch (err) {
					await sendResponse(connection, {
						...(id !== undefined && { id }),
						ok: false,
						error: {
							phase: "handler",
							error: err instanceof Error ? err.message : String(err),
						} as ExecutionError,
					});
				}
				return;
			}

			await sendResponse(connection, {
				...(id !== undefined && { id }),
				ok: true,
				value: result.value,
			});
		},

		onDisconnect(_connection: WsConnectionLike) {
			// No-op; consumer can use this to unsubscribe connection from hub, etc.
		},
	};
}
