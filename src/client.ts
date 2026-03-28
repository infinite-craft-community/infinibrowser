import type {
  CustomLineageDataType,
  ItemDataType,
  LineageDataType,
  RecipesDataType,
  UsesDataType,
  ShareLineageType,
} from "./types/data";
import type { InvalidElementId, UknownElement } from "./types/errors";

type Params = Record<string, string | number | boolean | null | undefined>;

const buildUrl = (options: {
  readonly API_URL: string;
  readonly path: string;
  readonly params?: Params;
}): URL => {
  const url = new URL(`${options.API_URL}${options.path}`);

  if (options.params) {
    for (const [key, value] of Object.entries(options.params)) {
      if (value !== null && value !== undefined) {
        url.searchParams.append(key, String(value));
      }
    }
  }

  return url;
};

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

interface InfinibrowserConfig {
  readonly API_URL: string;
  readonly timeout: number;
  readonly request?: Readonly<RequestInit>;
}

type FetchResponseError = Readonly<
  | { ok: false; error_code: "SYNTAX_ERROR"; error: SyntaxError }
  | { ok: false; error_code: "TIMEOUT"; error: DOMException }
  | { ok: false; error_code: "UNKNOWN_ERROR"; error: unknown }
>;

type FetchResponse<T, E = unknown> = Promise<
  | Readonly<
      | { ok: true; data: T; response: Response }
      | { ok: false; error_code: "NOT_OK"; data: E; response: Response }
    >
  | FetchResponseError
>;

const API_URL = "https://infinibrowser.wiki/api";

const DEFAULT_OPTIONS = { API_URL, timeout: 1000 };

class Infinibrowser {
  public readonly $config: InfinibrowserConfig;

  constructor(config?: Partial<InfinibrowserConfig>) {
    this.$config = { ...DEFAULT_OPTIONS, ...config };
  }

  async #fetchWithTimeout<T, E = unknown>(
    url: URL,
    init?: RequestInit,
  ): FetchResponse<T, E> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.$config.timeout);

    try {
      const requestInit = mergeRequests(this.$config.request, init, {
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

  async #get<T, E = unknown>(options: {
    readonly path: string;
    readonly params?: Params;
  }): FetchResponse<T, E> {
    const url = buildUrl({ API_URL: this.$config.API_URL, ...options });
    return this.#fetchWithTimeout<T, E>(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
  }

  async #post<T, E = unknown>(options: {
    readonly path: string;
    readonly params?: Params;
    readonly payload?: Record<string, unknown>;
  }): FetchResponse<T, E> {
    const url = buildUrl({ API_URL: this.$config.API_URL, ...options });
    return this.#fetchWithTimeout<T, E>(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options.payload ?? {}),
    });
  }

  async getItem(id: string): FetchResponse<ItemDataType, UknownElement> {
    return this.#get<ItemDataType, UknownElement>({
      path: "/item",
      params: { id },
    });
  }

  async getRecipes(
    id: string,
    { offset = 0 }: { offset?: number } = {},
  ): FetchResponse<RecipesDataType, UknownElement> {
    return this.#get<RecipesDataType, UknownElement>({
      path: "/recipes",
      params: { id, offset },
    });
  }

  async getUses(
    id: string,
    { offset = 0 }: { offset?: number } = {},
  ): FetchResponse<UsesDataType, UknownElement> {
    return this.#get<UsesDataType, UknownElement>({
      path: "/uses",
      params: { id, offset },
    });
  }

  async getLineage(id: string): FetchResponse<LineageDataType, UknownElement> {
    return this.#get<LineageDataType, UknownElement>({
      path: "/recipe",
      params: { id },
    });
  }

  async getCustomLineage(
    id: string,
  ): FetchResponse<CustomLineageDataType, InvalidElementId> {
    return this.#get<CustomLineageDataType, InvalidElementId>({
      path: "/recipe/custom",
      params: { id },
    });
  }

  async optimizeLineage(id: string): FetchResponse<{
    readonly id: string;
    readonly before: number;
    readonly after: number;
  }> {
    return this.#post<{
      readonly id: string;
      readonly before: number;
      readonly after: number;
    }>({
      path: "/optimize-lineage",
      params: { id },
    });
  }

  async shareLineage(
    steps: ShareLineageType,
  ): FetchResponse<{ readonly id: string }> {
    const path = "/analytics/share";

    const lastStep = steps.at(-1);
    if (!lastStep) throw new Error("Lineage must not be empty");

    const resultElement = lastStep[2];
    const payload = { id: resultElement.id, emoji: resultElement.emoji, steps };

    return this.#post<{ readonly id: string }>({ path, payload });
  }
}

const ib: Infinibrowser = new Infinibrowser(DEFAULT_OPTIONS);

export { ib, API_URL, Infinibrowser };
