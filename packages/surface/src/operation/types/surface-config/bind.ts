export type PayloadBindingTargetPath = string;

export type PayloadBindingMapping = Record<string, PayloadBindingTargetPath>;

/**
 * Declarative payload binding for one transport source.
 *
 * - `true`: merge the whole source into the payload root
 * - `"target.path"`: assign the whole source to a nested payload path
 * - `{ "source.path": "target.path" }`: map specific source fields into payload fields
 */
export type PayloadBindingSource =
	| true
	| PayloadBindingTargetPath
	| PayloadBindingMapping;

export interface HttpPayloadBinding {
	body?: PayloadBindingSource;
	path?: PayloadBindingSource;
	query?: PayloadBindingSource;
	headers?: PayloadBindingSource;
}

export interface EventPayloadBinding {
	payload?: PayloadBindingSource;
	raw?: PayloadBindingSource;
	meta?: PayloadBindingSource;
}

export interface WebhookPayloadBinding {
	payload?: PayloadBindingSource;
	body?: PayloadBindingSource;
	headers?: PayloadBindingSource;
	rawBody?: PayloadBindingSource;
	meta?: PayloadBindingSource;
}
