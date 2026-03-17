import type { PayloadBindingSource } from "../../operation/types";

type PayloadBindingSources<TSource extends string> = Partial<
	Record<TSource, PayloadBindingSource>
>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return value != null && typeof value === "object" && !Array.isArray(value);
}

function getValueAtPath(source: unknown, path: string): unknown {
	if (path === "") return source;
	let current = source;
	for (const segment of path.split(".")) {
		if (current == null || typeof current !== "object") return undefined;
		current = (current as Record<string, unknown>)[segment];
	}
	return current;
}

function setValueAtPath(
	target: Record<string, unknown>,
	path: string,
	value: unknown,
): void {
	const segments = path.split(".");
	let current: Record<string, unknown> = target;
	for (const segment of segments.slice(0, -1)) {
		const next = current[segment];
		if (!isPlainObject(next)) {
			current[segment] = {};
		}
		current = current[segment] as Record<string, unknown>;
	}
	const lastSegment = segments.at(-1);
	if (!lastSegment) return;
	current[lastSegment] = value;
}

function mergeIntoPayload(
	currentPayload: unknown,
	source: unknown,
	sourceName: string,
): unknown {
	if (source === undefined) return currentPayload;
	if (currentPayload === undefined) return source;
	if (!isPlainObject(source)) {
		throw new Error(
			`Cannot merge non-object ${sourceName} source into an existing payload`,
		);
	}
	if (!isPlainObject(currentPayload)) {
		throw new Error(
			`Cannot merge ${sourceName} source into a non-object payload`,
		);
	}

	const nextPayload = { ...currentPayload };
	for (const [key, value] of Object.entries(source)) {
		const existing = nextPayload[key];
		nextPayload[key] =
			isPlainObject(existing) && isPlainObject(value)
				? mergeIntoPayload(existing, value, sourceName)
				: value;
	}
	return nextPayload;
}

function assignWholeSource(
	currentPayload: unknown,
	targetPath: string,
	source: unknown,
	sourceName: string,
): unknown {
	if (source === undefined) return currentPayload;
	if (targetPath === "")
		return mergeIntoPayload(currentPayload, source, sourceName);
	if (currentPayload !== undefined && !isPlainObject(currentPayload)) {
		throw new Error(
			`Cannot assign ${sourceName} source into a non-object payload`,
		);
	}
	const nextPayload = isPlainObject(currentPayload)
		? { ...currentPayload }
		: {};
	setValueAtPath(nextPayload, targetPath, source);
	return nextPayload;
}

function applyBindingSource(
	currentPayload: unknown,
	sourceName: string,
	source: unknown,
	binding: PayloadBindingSource,
): unknown {
	if (binding === true) {
		return mergeIntoPayload(currentPayload, source, sourceName);
	}
	if (typeof binding === "string") {
		return assignWholeSource(currentPayload, binding, source, sourceName);
	}

	let nextPayload = currentPayload;
	for (const [sourcePath, targetPath] of Object.entries(binding)) {
		const value = getValueAtPath(source, sourcePath);
		if (value === undefined) continue;
		nextPayload = assignWholeSource(nextPayload, targetPath, value, sourceName);
	}
	return nextPayload;
}

export interface ResolveBoundPayloadOptions<TSource extends string> {
	bind?: PayloadBindingSources<TSource>;
	sources: Record<TSource, unknown>;
	sourceOrder: readonly TSource[];
	primarySources?: readonly TSource[];
	initialPayload: unknown;
}

export function resolveBoundPayload<TSource extends string>(
	options: ResolveBoundPayloadOptions<TSource>,
): unknown {
	const { bind, sources, sourceOrder, primarySources, initialPayload } =
		options;
	if (!bind) return initialPayload;

	const hasExplicitPrimary =
		primarySources?.some((sourceName) => bind[sourceName] !== undefined) ??
		false;
	let payload = hasExplicitPrimary ? undefined : initialPayload;

	for (const sourceName of sourceOrder) {
		const binding = bind[sourceName];
		if (binding === undefined) continue;
		payload = applyBindingSource(
			payload,
			sourceName,
			sources[sourceName],
			binding,
		);
	}

	return payload;
}
