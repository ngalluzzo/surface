import type { DefaultContext } from "../default-context";
import type { CliSurfaceConfig } from "./cli";
import type { CronSurfaceConfig } from "./cron";
import type { EventSurfaceConfig } from "./event";
import type { GraphQLSurfaceConfig } from "./graphql";
import type { HttpSurfaceConfig } from "./http";
import type { JobSurfaceConfig } from "./job";
import type { McpSurfaceConfig } from "./mcp";
import type { WebhookSurfaceConfig } from "./webhook";
import type { WsSurfaceConfig } from "./ws";

export type { BaseSurfaceConfig } from "./base";
export type { CliSurfaceConfig } from "./cli";
export type { CronSurfaceConfig } from "./cron";
export type { EventSurfaceConfig } from "./event";
export type { GraphQLSurfaceConfig } from "./graphql";
export type { HttpSurfaceConfig } from "./http";
export type { JobSurfaceConfig } from "./job";
export type { McpSurfaceConfig } from "./mcp";
export type { WebhookSurfaceConfig } from "./webhook";
export type { WsSurfaceConfig } from "./ws";

/**
 * Single source of truth for which surfaces exist and their config types.
 * Adding a surface = add one config interface above + one entry here.
 */
export interface SurfaceConfigMap<TPayload, C extends DefaultContext> {
	http: HttpSurfaceConfig<TPayload, C>;
	cli: CliSurfaceConfig<TPayload, C>;
	job: JobSurfaceConfig<TPayload, C>;
	webhook: WebhookSurfaceConfig<TPayload, C>;
	event: EventSurfaceConfig<TPayload, C>;
	cron: CronSurfaceConfig<TPayload, C>;
	mcp: McpSurfaceConfig<TPayload, C>;
	ws: WsSurfaceConfig<TPayload, C>;
	graphql: GraphQLSurfaceConfig<TPayload, C>;
}

export type ExposeSurface = keyof SurfaceConfigMap<
	unknown,
	Record<string, unknown>
>;

/** Surface types for operations. Includes "test" for testOperation() lifecycle meta. */
export type Surface = ExposeSurface | "test";
