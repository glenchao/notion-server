import { AsyncLocalStorage } from "node:async_hooks";
import type { ISession } from "../types/ISession.ts";

const asyncLocalStorage = new AsyncLocalStorage<ISession>();

/**
 * Wrap your request handler with this to set the correlation ID for all logs in that request.
 * Usage: return withSession(() => handleRequest(req))
 */
export function withSession<T>(fn: (req: Request) => T): (req: Request) => T {
  return (req: Request) => {
    // get headers
    const railwayRequestId = req.headers.get("x-railway-request-id");
    const userAgent = req.headers.get("user-agent");
    const session: ISession = {
      sessionId: crypto.randomUUID(),
      railwayRequestId: railwayRequestId || "unknown",
      userAgent: userAgent || "unknown",
    };
    return asyncLocalStorage.run(session, () => fn(req));
  };
}

/**
 * Get the current correlation ID. Returns undefined if called outside a request context.
 */
export function getSessionData(): ISession | undefined {
  return asyncLocalStorage.getStore();
}

type LogLevel = "debug" | "info" | "warn" | "error";

export class ScopedLogger {
  private _sessionData: ISession | undefined;
  private _scope: string;
  private _ended: boolean = false;

  constructor(scope: string) {
    this._scope = scope;
    this._sessionData = getSessionData();
    this.log("info", "Start");
  }

  public log(level: LogLevel, message: string, data?: Record<string, unknown>) {
    if (this._ended) {
      return;
    }
    console.log(
      JSON.stringify({
        level,
        scope: this._scope,
        message,
        sessionId: this._sessionData?.sessionId || "unknown",
        data,
      }),
    );
  }

  public end(): void {
    if (this._ended) {
      return;
    }
    this._ended = true;
    this.log("info", "End");
  }
}
