export interface LogStreamOptions {
  baseUrl?: string;
  filters?: string[];
  follow?: boolean;
  timeout?: number;
}

export interface LogStream {
  stream: ReadableStream<Uint8Array>;
  stop: () => void;
}

export function createLogStream(options: LogStreamOptions = {}): LogStream {
  const baseUrl = options.baseUrl || "http://localhost:20128";
  const filters = options.filters || [];
  const follow = options.follow ?? false;
  const timeout = options.timeout || 30000;

  const controller = new AbortController();
  const { signal } = controller;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let url = `${baseUrl}/api/usage/call-logs?limit=200`;
      if (filters.length > 0) {
        url += `&filter=${encodeURIComponent(filters.join(","))}`;
      }

      const timeoutId = setTimeout(() => {
        if (follow) return; // Don't timeout follow mode
        controller.error(new Error(`Log stream timed out after ${timeout}ms`));
      }, timeout);

      try {
        const response = await fetch(url, { signal });

        if (!response.ok) {
          controller.error(new Error(`HTTP ${response.status}: ${response.statusText}`));
          clearTimeout(timeoutId);
          return;
        }

        const rows = (await response.json()) as unknown;
        const encoder = new TextEncoder();
        const list = Array.isArray(rows) ? rows : [];
        for (const row of list) {
          if (signal.aborted) break;
          controller.enqueue(encoder.encode(`${JSON.stringify(row)}\n`));
        }

        controller.close();
        clearTimeout(timeoutId);
      } catch (err) {
        if (signal.aborted) return; // Expected stop
        controller.error(err instanceof Error ? err : new Error(String(err)));
        clearTimeout(timeoutId);
      }
    },

    cancel() {
      controller.abort();
    },
  });

  return {
    stream,
    stop: () => controller.abort(),
  };
}
