import type { WsLogger } from "../types/logger.js";

const noopLogger: Required<WsLogger> = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

export function resolveLogger(logger?: WsLogger): Required<WsLogger> {
  return {
    debug: logger?.debug ?? noopLogger.debug,
    info: logger?.info ?? noopLogger.info,
    warn: logger?.warn ?? noopLogger.warn,
    error: logger?.error ?? noopLogger.error,
  };
}
