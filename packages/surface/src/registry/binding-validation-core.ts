import { bindingMeta, type BindingDefinition, type BindingMeta } from "../bindings";
import type { ExposeSurface } from "../operation/types";
import type { NormalizedSurfaceBinding } from "./normalize-surface-bindings";

export type BindingValidationIssueCode = "duplicate_target" | "invalid_target";

export interface BindingValidationIssue {
	code: BindingValidationIssueCode;
	surface: ExposeSurface;
	targetKind: string;
	target: string;
	bindings: BindingMeta[];
	message: string;
}

export class BindingValidationError extends Error {
	issues: BindingValidationIssue[];

	constructor(issues: BindingValidationIssue[]) {
		super(formatBindingValidationIssues(issues));
		this.name = "BindingValidationError";
		this.issues = issues;
	}
}

export function formatBindingValidationIssue(
	issue: BindingValidationIssue,
): string {
	return issue.message;
}

export function formatBindingValidationIssues(
	issues: BindingValidationIssue[],
): string {
	if (issues.length === 0) {
		return "No binding validation issues";
	}
	if (issues.length === 1) {
		const [firstIssue] = issues;
		if (!firstIssue) {
			return "No binding validation issues";
		}
		return formatBindingValidationIssue(firstIssue);
	}
	return issues.map((issue) => formatBindingValidationIssue(issue)).join("\n");
}

export function collectDuplicateTargetIssues<
	TBinding extends BindingDefinition,
>(
	bindings: TBinding[],
	options: {
		surface: ExposeSurface;
		targetKind: string;
		select: (binding: TBinding) => string;
	},
): BindingValidationIssue[] {
	const seen = new Map<string, TBinding>();
	const issues: BindingValidationIssue[] = [];

	for (const binding of bindings) {
		const selected = options.select(binding);
		const first = seen.get(selected);
		if (first) {
			issues.push({
				code: "duplicate_target",
				surface: options.surface,
				targetKind: options.targetKind,
				target: selected,
				bindings: [
					bindingMeta(first.ref, first.key),
					bindingMeta(binding.ref, binding.key),
				],
				message: `Duplicate ${options.surface} ${options.targetKind} "${selected}" for bindings "${first.key}" and "${binding.key}"`,
			});
			continue;
		}
		seen.set(selected, binding);
	}

	return issues;
}

export interface BindingValidationSpec {
	surface: ExposeSurface;
	validate: (
		bindings: Array<NormalizedSurfaceBinding<ExposeSurface, any>>,
	) => BindingValidationIssue[];
}

const bindingValidationSpecRegistry = new Map<
	ExposeSurface,
	BindingValidationSpec[]
>();

export function registerBindingValidationSpecs(
	specs: ReadonlyArray<BindingValidationSpec>,
): void {
	for (const spec of specs) {
		const existing = bindingValidationSpecRegistry.get(spec.surface) ?? [];
		if (!existing.includes(spec)) {
			existing.push(spec);
			bindingValidationSpecRegistry.set(spec.surface, existing);
		}
	}
}

export function getBindingValidationSpecs(
	surface: ExposeSurface,
): ReadonlyArray<BindingValidationSpec> {
	return bindingValidationSpecRegistry.get(surface) ?? [];
}

export function getRegisteredBindingValidationSurfaces(): ExposeSurface[] {
	return [...bindingValidationSpecRegistry.keys()];
}

export function createDuplicateTargetBindingValidationSpec<
	S extends ExposeSurface,
>(options: {
	surface: S;
	targetKind: string;
	select: (binding: NormalizedSurfaceBinding<S, any>) => string;
	filter?: (binding: NormalizedSurfaceBinding<S, any>) => boolean;
}): BindingValidationSpec {
	return {
		surface: options.surface,
		validate: (
			bindings: Array<NormalizedSurfaceBinding<ExposeSurface, any>>,
		) =>
			collectDuplicateTargetIssues(
				options.filter
					? (bindings as Array<NormalizedSurfaceBinding<S, any>>).filter(
							options.filter,
						)
					: (bindings as Array<NormalizedSurfaceBinding<S, any>>),
				{
					surface: options.surface,
					targetKind: options.targetKind,
					select: options.select,
				},
			),
	};
}

export function validateBindingSpecs(
	bindings: Array<NormalizedSurfaceBinding<ExposeSurface, any>>,
	specs: ReadonlyArray<BindingValidationSpec>,
): BindingValidationIssue[] {
	return specs.flatMap((spec) => spec.validate(bindings));
}

export function assertNoBindingValidationIssues(
	issues: BindingValidationIssue[],
): void {
	if (issues.length > 0) {
		throw new BindingValidationError(issues);
	}
}
