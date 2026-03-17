import type { DefaultContext } from "../../operation/types";

export interface WebhookRequest {
	provider: string;
	eventType: string;
	body: unknown;
	headers: Record<string, string | string[] | undefined>;
	rawBody: Buffer;
}

export interface WebhookResponse {
	status: 200;
	body: { received: true; operation?: string; ignored?: boolean };
}

export type WebhookHandler<C extends DefaultContext = DefaultContext> = (
	req: WebhookRequest,
	ctx: C,
) => Promise<WebhookResponse>;
