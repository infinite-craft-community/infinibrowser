type Params = Record<string, string | number | boolean | null | undefined>;

interface BuildURLOptions {
  readonly path: string;
  readonly params?: Params;
}

function buildUrl(
  options: BuildURLOptions & { readonly API_URL: string },
): URL {
  const url = new URL(`${options.API_URL}${options.path}`);

  if (options.params) {
    for (const [key, value] of Object.entries(options.params)) {
      if (value !== null && value !== undefined) {
        url.searchParams.append(key, String(value));
      }
    }
  }

  return url;
}

function mergeRequests(...requests: (RequestInit | undefined)[]): RequestInit {
  let mergedResult: RequestInit = {};
  const mergedHeaders = new Headers();
  for (const request of requests) {
    if (!request) continue;
    mergedResult = { ...mergedResult, ...request };
    new Headers(request.headers).forEach((value, key) => {
      mergedHeaders.set(key, value);
    });
  }
  mergedResult.headers = mergedHeaders;
  return mergedResult;
}

interface ApiConfig {
  readonly API_URL: string;
  readonly timeout: number;
  readonly request?: Readonly<RequestInit>;
}

type FetchResponseError<C extends string, E = unknown> = {
  readonly ok: false;
  readonly error_code: C;
  readonly error: E;
};

type FetchResponseData<T, E> =
  | Readonly<
      | { ok: true; data: T; response: Response }
      | { ok: false; error_code: "NOT_OK"; data: E; response: Response }
    >
  | FetchResponseError<"SYNTAX_ERROR", SyntaxError>
  | FetchResponseError<"TIMEOUT", DOMException>
  | FetchResponseError<"UNKNOWN_ERROR">;

type FetchResponse<T, E = unknown> = Promise<FetchResponseData<T, E>>;

async function fetchWithTimeout<T, E = unknown>(
  config: ApiConfig,
  options: BuildURLOptions,
  init?: RequestInit,
): FetchResponse<T, E> {
  const url = buildUrl({ API_URL: config.API_URL, ...options });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeout);

  try {
    const requestInit = mergeRequests(config.request, init, {
      signal: controller.signal,
      headers: { "Accept-Encoding": "gzip, deflate, identity" },
    });
    const request = new Request(url, requestInit);
    const response = await fetch(request);
    const ok = response.ok;
    if (!ok) {
      const text = await response.clone().text();
      const data: E = JSON.parse(text);
      return { ok, error_code: "NOT_OK", response, data } as const;
    }
    const text = await response.clone().text();
    const data: T = JSON.parse(text);
    return { ok, data, response } as const;
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { ok: false, error_code: "SYNTAX_ERROR", error } as const;
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      return { ok: false, error_code: "TIMEOUT", error } as const;
    }
    return { ok: false, error_code: "UNKNOWN_ERROR", error } as const;
  } finally {
    clearTimeout(timeout);
  }
}

export { fetchWithTimeout };
export type {
  BuildURLOptions,
  ApiConfig,
  FetchResponse,
  FetchResponseData,
  FetchResponseError,
};
