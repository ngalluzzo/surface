export const DEFAULT_BINDING_NAME = "default" as const;

export interface BindingRef<
	TOperation extends string = string,
	TBinding extends string = string,
> {
	operation: TOperation;
	binding: TBinding;
}

export interface BindingDefinition<TKey extends string = string> {
	key: TKey;
	ref: BindingRef;
}

export interface BindingMeta<TKey extends string = string>
	extends BindingDefinition<TKey> {}

export function bindingMeta<TKey extends string = string>(
	ref: BindingRef,
	key: TKey = serializeBindingRef(ref) as TKey,
): BindingMeta<TKey> {
	return { key, ref };
}

export function bindingRef<
	TOperation extends string,
	TBinding extends string = typeof DEFAULT_BINDING_NAME,
>(
	operation: TOperation,
	binding?: TBinding,
): BindingRef<TOperation, TBinding> {
	return {
		operation,
		binding: (binding ?? DEFAULT_BINDING_NAME) as TBinding,
	};
}

export function isBindingRef(value: unknown): value is BindingRef {
	return (
		value != null &&
		typeof value === "object" &&
		"operation" in value &&
		typeof (value as { operation?: unknown }).operation === "string" &&
		"binding" in value &&
		typeof (value as { binding?: unknown }).binding === "string"
	);
}

export function serializeBindingRef(ref: BindingRef): string {
	return ref.binding === DEFAULT_BINDING_NAME
		? ref.operation
		: `${ref.operation}:${ref.binding}`;
}

export function parseBindingKey(key: string): BindingRef {
	const lastSeparator = key.lastIndexOf(":");
	if (lastSeparator === -1) {
		return bindingRef(key);
	}

	return bindingRef(
		key.slice(0, lastSeparator),
		key.slice(lastSeparator + 1),
	);
}
