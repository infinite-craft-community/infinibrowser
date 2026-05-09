import { fetchWithTimeout } from "./api";
import type {
  ApiConfig,
  FetchResponse,
  BuildURLOptions,
  FetchResponseData,
} from "./api";
import type {
  CustomLineageDataType,
  ItemDataType,
  LineageDataType,
  RecipesDataType,
  UsesDataType,
  ShareLineageType,
} from "./types/data";
import type {
  InvalidElementIdError,
  NotSoFastError,
  UknownElementError,
} from "./types/errors";

const API_URL = "https://infinibrowser.wiki/api";

type ItemResponseData = FetchResponseData<ItemDataType, UknownElementError>;
type RecipesResponseData = FetchResponseData<
  RecipesDataType,
  UknownElementError
>;
type UsesResponseData = FetchResponseData<UsesDataType, UknownElementError>;
type LineageResponseData = FetchResponseData<
  LineageDataType,
  UknownElementError | NotSoFastError
>;

const DEFAULT_OPTIONS: ApiConfig = { API_URL, timeout: 1000 } as const;

class Infinibrowser {
  public readonly $config: ApiConfig;

  constructor(config?: Partial<ApiConfig>) {
    this.$config = { ...DEFAULT_OPTIONS, ...config };
  }

  async #get<T, E = unknown>(options: BuildURLOptions) {
    return fetchWithTimeout<T, E>(this.$config, options, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
  }

  async #post<T, E = unknown>(
    options: BuildURLOptions,
    payload?: Record<string, unknown>,
  ): FetchResponse<T, E> {
    return fetchWithTimeout<T, E>(this.$config, options, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload ?? {}),
    });
  }

  async getItem(id: string): Promise<ItemResponseData> {
    return this.#get<ItemDataType, UknownElementError>({
      path: "/item",
      params: { id },
    });
  }

  async getRecipes(
    id: string,
    { offset = 0 }: { offset?: number } = {},
  ): Promise<RecipesResponseData> {
    return this.#get<RecipesDataType, UknownElementError>({
      path: "/recipes",
      params: { id, offset },
    });
  }

  async getUses(
    id: string,
    { offset = 0 }: { offset?: number } = {},
  ): Promise<UsesResponseData> {
    return this.#get<UsesDataType, UknownElementError>({
      path: "/uses",
      params: { id, offset },
    });
  }

  async getLineage(
    id: string,
  ): FetchResponse<LineageDataType, UknownElementError | NotSoFastError> {
    return this.#get<LineageDataType, UknownElementError | NotSoFastError>({
      path: "/recipe",
      params: { id },
    });
  }

  async getCustomLineage(
    id: string,
  ): FetchResponse<CustomLineageDataType, InvalidElementIdError> {
    return this.#get<CustomLineageDataType, InvalidElementIdError>({
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
    const payload = { ...resultElement, steps };

    return this.#post<{ readonly id: string }>({ path }, payload);
  }
}

const ib: Infinibrowser = new Infinibrowser();

export { ib, API_URL, Infinibrowser };
export type {
  RecipesResponseData,
  UsesResponseData,
  ItemResponseData,
  LineageResponseData,
};
