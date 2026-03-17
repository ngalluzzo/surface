/**
 * Shared "raw → parsed" step for surfaces that receive envelope-shaped input
 * (webhook body, event bus message). When parsePayload is provided, use it to
 * extract the value that will be passed to execute(); otherwise pass raw through.
 * execute() then runs schema validation (phase 2) on that value.
 *
 * Used by: webhook adapter, event adapter.
 */
export function parseRaw(
	raw: unknown,
	parsePayload?: (raw: unknown) => unknown,
): unknown {
	return parsePayload ? parsePayload(raw) : raw;
}
