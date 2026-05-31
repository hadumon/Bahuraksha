type Transport = (level: string, message: string, context?: Record<string, unknown>) => void;

const transports: Transport[] = [];

export function addTransport(t: Transport) {
  transports.push(t);
}

function emit(level: string, message: string, context?: Record<string, unknown>) {
  for (const t of transports) t(level, message, context);
}

function formatError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return {
      message: err.message,
      name: err.name,
      stack: err.stack,
    };
  }
  return { message: String(err) };
}

export const logger = {
  error(message: string, context?: Record<string, unknown>) {
    console.error(`[Bahuraksha] ${message}`, context ?? "");
    emit("error", message, context);
  },

  warn(message: string, context?: Record<string, unknown>) {
    console.warn(`[Bahuraksha] ${message}`, context ?? "");
    emit("warn", message, context);
  },

  info(message: string, context?: Record<string, unknown>) {
    console.info(`[Bahuraksha] ${message}`, context ?? "");
  },

  captureException(err: unknown, context?: Record<string, unknown>) {
    const formatted = formatError(err);
    this.error("Unhandled exception", { ...context, error: formatted });
  },

  capturePromiseRejection(err: unknown, context?: Record<string, unknown>) {
    const formatted = formatError(err);
    this.error("Unhandled promise rejection", { ...context, error: formatted });
  },
};

export function installGlobalHandlers() {
  if (typeof window === "undefined") return;

  window.onerror = (_event, _source, _lineno, _colno, error) => {
    logger.captureException(error ?? new Error("Unknown window.onerror"));
    return false;
  };

  window.onunhandledrejection = (event) => {
    logger.capturePromiseRejection(event.reason);
  };
}
