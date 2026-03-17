import type {
	AnyOperation,
	DefaultContext,
	ExposeSurface,
	OperationRegistry,
	OperationRegistryWithHooks,
} from "../operation/types";
import "../surfaces";
import type { BindingValidationIssue } from "./binding-validation-core";

export type {
	BindingValidationIssue,
	BindingValidationIssueCode,
} from "./binding-validation-core";
export {
	assertNoBindingValidationIssues,
	BindingValidationError,
	type BindingValidationSpec,
	collectDuplicateTargetIssues,
	createDuplicateTargetBindingValidationSpec,
	formatBindingValidationIssue,
	formatBindingValidationIssues,
	getBindingValidationSpecs,
	getRegisteredBindingValidationSurfaces,
	registerBindingValidationSpecs,
	validateBindingSpecs,
} from "./binding-validation-core";

import {
	getBindingValidationSpecs,
	getRegisteredBindingValidationSurfaces,
	validateBindingSpecs,
} from "./binding-validation-core";
import { normalizeSurfaceBindings } from "./normalize-surface-bindings";

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
		normalizeSurfaceBindings(registry, surface) as Array<
			import("./normalize-surface-bindings").NormalizedSurfaceBinding<
				ExposeSurface,
				AnyOperation
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
