export type Dependency = {
	readonly name: string;
	readonly dependsOn: readonly string[];
};

/**
 * Topologically sort items by their dependencies.
 *
 * Items with no dependencies come first.
 * Items that reference other items come after their dependencies.
 *
 * Cycles are detected and handled gracefully - items in a cycle
 * are returned in their original order (no error thrown).
 */
export const topologicalSort = <T extends Dependency>(
	items: readonly T[],
): readonly T[] => {
	if (items.length === 0) return [];

	const itemMap = new Map<string, T>();
	for (const item of items) {
		itemMap.set(item.name, item);
	}

	const sorted: T[] = [];
	const visited = new Set<string>();
	const visiting = new Set<string>();

	const visit = (itemName: string): void => {
		if (visited.has(itemName)) return;
		if (visiting.has(itemName)) {
			// Circular dependency - skip this branch
			return;
		}

		visiting.add(itemName);

		const item = itemMap.get(itemName);
		if (item) {
			// Visit all dependencies first
			for (const dep of item.dependsOn) {
				visit(dep);
			}
		}

		visiting.delete(itemName);
		visited.add(itemName);

		if (item) {
			sorted.push(item);
		}
	};

	for (const item of items) {
		visit(item.name);
	}

	return sorted;
};
