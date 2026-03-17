export const DEFAULT_BINDING_NAME = "default" as const;
export const BINDING_KEY_SEPARATOR = ":" as const;

export type BindingKey<
	TOperation extends string,
	TBinding extends string = typeof DEFAULT_BINDING_NAME,
> = TBinding extends typeof DEFAULT_BINDING_NAME
	? TOperation
	: `${TOperation}:${TBinding}`;

export type OperationNameFromBindingKey<TKey extends string> =
	TKey extends `${infer TOperation}:${string}` ? TOperation : TKey;

export type BindingNameFromBindingKey<TKey extends string> =
	TKey extends `${string}:${infer TBinding}`
		? TBinding
		: typeof DEFAULT_BINDING_NAME;

export interface BindingRef<
	TSurface extends string = string,
	TOperation extends string = string,
	TBinding extends string = string,
> {
	surface: TSurface;
	operation: TOperation;
	binding: TBinding;
}

export interface BindingDefinition<
	TKey extends string = string,
	TRef extends BindingRef = BindingRef,
> {
	key: TKey;
	ref: TRef;
}

export interface BindingMeta<
	TKey extends string = string,
	TRef extends BindingRef = BindingRef,
> extends BindingDefinition<TKey, TRef> {}

export function bindingMeta<
	TKey extends string = string,
	TRef extends BindingRef = BindingRef,
>(
	ref: TRef,
	key: TKey = serializeBindingRef(ref) as TKey,
): BindingMeta<TKey, TRef> {
	return { key, ref };
}

export function bindingRef<
	TSurface extends string,
	TOperation extends string,
	TBinding extends string = typeof DEFAULT_BINDING_NAME,
>(
	surface: TSurface,
	operation: TOperation,
	binding?: TBinding,
): BindingRef<TSurface, TOperation, TBinding> {
	return {
		surface,
		operation,
		binding: (binding ?? DEFAULT_BINDING_NAME) as TBinding,
	};
}

export function httpBindingRef<
	TOperation extends string,
	TBinding extends string = typeof DEFAULT_BINDING_NAME,
>(
	operation: TOperation,
	binding?: TBinding,
): BindingRef<"http", TOperation, TBinding> {
	return bindingRef("http", operation, binding);
}

export function eventBindingRef<
	TOperation extends string,
	TBinding extends string = typeof DEFAULT_BINDING_NAME,
>(
	operation: TOperation,
	binding?: TBinding,
): BindingRef<"event", TOperation, TBinding> {
	return bindingRef("event", operation, binding);
}

export function jobBindingRef<
	TOperation extends string,
	TBinding extends string = typeof DEFAULT_BINDING_NAME,
>(
	operation: TOperation,
	binding?: TBinding,
): BindingRef<"job", TOperation, TBinding> {
	return bindingRef("job", operation, binding);
}

export function graphqlBindingRef<
	TOperation extends string,
	TBinding extends string = typeof DEFAULT_BINDING_NAME,
>(
	operation: TOperation,
	binding?: TBinding,
): BindingRef<"graphql", TOperation, TBinding> {
	return bindingRef("graphql", operation, binding);
}

export function isBindingRef(value: unknown): value is BindingRef {
	return (
		value != null &&
		typeof value === "object" &&
		"surface" in value &&
		typeof (value as { surface?: unknown }).surface === "string" &&
		"operation" in value &&
		typeof (value as { operation?: unknown }).operation === "string" &&
		"binding" in value &&
		typeof (value as { binding?: unknown }).binding === "string"
	);
}

export function serializeBindingRef<
	TSurface extends string,
	TOperation extends string,
	TBinding extends string,
>(
	ref: BindingRef<TSurface, TOperation, TBinding>,
): BindingKey<TOperation, TBinding> {
	return ref.binding === DEFAULT_BINDING_NAME
		? (ref.operation as BindingKey<TOperation, TBinding>)
		: (`${ref.operation}${BINDING_KEY_SEPARATOR}${ref.binding}` as BindingKey<
				TOperation,
				TBinding
			>);
}

export function parseBindingKey<TSurface extends string, TKey extends string>(
	surface: TSurface,
	key: TKey,
): BindingRef<
	TSurface,
	OperationNameFromBindingKey<TKey>,
	BindingNameFromBindingKey<TKey>
> {
	const lastSeparator = key.lastIndexOf(":");
	if (lastSeparator === -1) {
		return bindingRef(surface, key as OperationNameFromBindingKey<TKey>);
	}

	return bindingRef(
		surface,
		key.slice(0, lastSeparator) as OperationNameFromBindingKey<TKey>,
		key.slice(lastSeparator + 1) as BindingNameFromBindingKey<TKey>,
	);
}

export function assertValidOperationName(name: string): void {
	if (name.includes(BINDING_KEY_SEPARATOR)) {
		throw new Error(
			`Operation name "${name}" cannot contain "${BINDING_KEY_SEPARATOR}" because it is reserved for binding keys`,
		);
	}
}

export function assertValidBindingName(name: string): void {
	if (name.includes(BINDING_KEY_SEPARATOR)) {
		throw new Error(
			`Binding name "${name}" cannot contain "${BINDING_KEY_SEPARATOR}" because it is reserved for binding keys`,
		);
	}
}

export function assertValidExposeBindingNames(
	expose: Record<string, unknown>,
): void {
	for (const bindings of Object.values(expose)) {
		if (bindings == null || typeof bindings !== "object") continue;
		for (const bindingName of Object.keys(bindings)) {
			assertValidBindingName(bindingName);
		}
	}
}
