import type { DefaultContext, ExposeSurface, OperationRegistry } from "../operation/types";
import "../surfaces";
import type { OperationRegistryWithHooks } from "./define-registry";
import type { BindingValidationIssue } from "./binding-validation-core";
export type { BindingValidationIssue, BindingValidationIssueCode } from "./binding-validation-core";
export {
	assertNoBindingValidationIssues,
	BindingValidationError,
	collectDuplicateTargetIssues,
	createDuplicateTargetBindingValidationSpec,
	formatBindingValidationIssue,
	formatBindingValidationIssues,
	getBindingValidationSpecs,
	getRegisteredBindingValidationSurfaces,
	registerBindingValidationSpecs,
	type BindingValidationSpec,
	validateBindingSpecs,
} from "./binding-validation-core";
import { normalizeSurfaceBindings } from "./normalize-surface-bindings";
import {
	getBindingValidationSpecs,
	getRegisteredBindingValidationSurfaces,
	validateBindingSpecs,
} from "./binding-validation-core";

export function validateSurfaceBindings<
	C extends DefaultContext = DefaultContext,
>(
	registry: OperationRegistry<C> | OperationRegistryWithHooks<C>,
	surface: ExposeSurface,
): BindingValidationIssue[] {
	const specs = getBindingValidationSpecs(surface);
	if (specs.length === 0) {
		return [];
	}
	return validateBindingSpecs(
		normalizeSurfaceBindings(
			registry,
			surface,
		) as Array<
			import("./normalize-surface-bindings").NormalizedSurfaceBinding<
				ExposeSurface,
				any
			>
		>,
		[...specs],
	);
}

export function validateBindings<C extends DefaultContext = DefaultContext>(
	registry: OperationRegistry<C> | OperationRegistryWithHooks<C>,
): BindingValidationIssue[] {
	return getRegisteredBindingValidationSurfaces().flatMap((surface) =>
		validateSurfaceBindings(registry, surface),
	);
}
