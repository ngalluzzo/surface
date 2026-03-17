import type { WsConnectionLike } from "./types";

/**
 * Hub contract for subscribe/publish. When publish(topic, data) is called,
 * the hub sends a message (e.g. { type: "push", topic, data }) to every
 * connection currently subscribed to that topic.
 */
export interface SubscriptionHubLike {
	subscribe(connection: WsConnectionLike, topic: string): void;
	unsubscribe(connection: WsConnectionLike, topic?: string): void;
	publish(topic: string, data: unknown): void | Promise<void>;
}

const PUSH_MESSAGE_TYPE = "push";

/**
 * In-memory subscription hub. Single-instance only; for multi-instance
 * broadcast the consumer must plug in a Redis-backed or other hub.
 */
export function createSubscriptionHub(): SubscriptionHubLike {
	const topicToConnections = new Map<string, Set<WsConnectionLike>>();
	const connectionToTopics = new Map<WsConnectionLike, Set<string>>();

	function getOrCreateTopicSet(topic: string): Set<WsConnectionLike> {
		let set = topicToConnections.get(topic);
		if (!set) {
			set = new Set();
			topicToConnections.set(topic, set);
		}
		return set;
	}

	function getOrCreateConnectionTopics(
		connection: WsConnectionLike,
	): Set<string> {
		let set = connectionToTopics.get(connection);
		if (!set) {
			set = new Set();
			connectionToTopics.set(connection, set);
		}
		return set;
	}

	return {
		subscribe(connection: WsConnectionLike, topic: string) {
			getOrCreateTopicSet(topic).add(connection);
			getOrCreateConnectionTopics(connection).add(topic);
		},

		unsubscribe(connection: WsConnectionLike, topic?: string) {
			if (topic !== undefined) {
				const set = topicToConnections.get(topic);
				if (set) {
					set.delete(connection);
					if (set.size === 0) topicToConnections.delete(topic);
				}
				const connTopics = connectionToTopics.get(connection);
				if (connTopics) {
					connTopics.delete(topic);
					if (connTopics.size === 0) connectionToTopics.delete(connection);
				}
			} else {
				const topics = connectionToTopics.get(connection);
				if (topics) {
					for (const t of topics) {
						const set = topicToConnections.get(t);
						if (set) {
							set.delete(connection);
							if (set.size === 0) topicToConnections.delete(t);
						}
					}
					connectionToTopics.delete(connection);
				}
			}
		},

		async publish(topic: string, data: unknown) {
			const connections = topicToConnections.get(topic);
			if (!connections) return;
			const message = { type: PUSH_MESSAGE_TYPE, topic, data };
			for (const conn of connections) {
				await conn.send(message);
			}
		},
	};
}
