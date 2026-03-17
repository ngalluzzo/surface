import type { Result } from "../../execution/result";
import type { SurfaceContext } from "./context";
import type { DefaultContext } from "./default-context";

export type GuardSuccess<C extends DefaultContext> = undefined | Partial<C>;

export interface GuardError {
	code: string;
	message?: string;
}

export type SurfaceGuard<C extends DefaultContext, TRaw = unknown> = (
	raw: TRaw,
	ctx: SurfaceContext<C, TRaw>,
) => Promise<Result<GuardSuccess<C>, GuardError>>;

export type DomainGuard<TPayload, C extends DefaultContext> = (
	payload: TPayload,
	ctx: C,
) => Promise<Result<GuardSuccess<C>, GuardError>>;

export interface GuardPolicy<TPayload, C extends DefaultContext> {
	name: string;
	guards: DomainGuard<TPayload, C>[];
}

export type GuardOrPolicy<TPayload, C extends DefaultContext> =
	| DomainGuard<TPayload, C>
	| GuardPolicy<TPayload, C>;

export type GuardOverride<TPayload, C extends DefaultContext> =
	| { prepend: SurfaceGuard<C, unknown>[] }
	| { append: SurfaceGuard<C, unknown>[] }
	| { replace: SurfaceGuard<C, unknown>[] }
	| {
			omit: Array<string | DomainGuard<TPayload, C> | GuardPolicy<TPayload, C>>;
	  };
