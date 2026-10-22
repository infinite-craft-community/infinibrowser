import type {
  CustomLineageDataType,
  ElementType,
  ItemDataType,
  LineageDataType,
  RecipesDataType,
  ShareLineageType,
  UsesDataType,
} from "infinibrowser";

interface LoggedRequest {
  readonly method: string;
  readonly path: string;
  readonly url: string;
  readonly headers: Record<string, string>;
  readonly body: string | null;
}

type RouteHandler = (req: Request, url: URL) => Response | Promise<Response>;

const CUSTOM_LINEAGE_ID = "01m5gjh4ydcvnv1fbrvzwyc65z";

const water: ElementType = { id: "Water", emoji: "💧" };
const fire: ElementType = { id: "Fire", emoji: "🔥" };
const steam: ElementType = { id: "Steam", emoji: "🌫️" };
const engine: ElementType = { id: "Engine", emoji: "🚗" };

const fixtures = {
  item: {
    id: 1,
    text: "Water",
    emoji: "💧",
    use_count: 16,
    recipe_count: 21,
    depth: 0,
  } satisfies ItemDataType,
  recipes: {
    total: 1,
    recipes: [[water, fire]],
  } satisfies RecipesDataType,
  uses: {
    total: 1,
    uses: [{ pair: water, result: steam }],
  } satisfies UsesDataType,
  lineage: {
    steps: [{ a: water, b: fire, result: steam }],
    missing: {},
  } satisfies LineageDataType,
  customLineage: {
    steps: [{ a: fire, b: steam, result: engine }],
    missing: { [steam.id]: "no_recipe" },
  } satisfies CustomLineageDataType,
  shareSteps: [[fire, steam, engine]] satisfies ShareLineageType,
  share: { id: CUSTOM_LINEAGE_ID },
};

function jsonRoute(data: unknown, status = 200): RouteHandler {
  return () => Response.json(data, { status });
}

function optimizeRoute(): RouteHandler {
  return (_, url) =>
    Response.json({
      id: url.searchParams.get("id") ?? "",
      before: 40,
      after: 12,
    });
}

function delayedRoute(handler: RouteHandler, ms: number): RouteHandler {
  return async (req, url) => {
    await new Promise<void>((resolve) => setTimeout(resolve, ms));
    return handler(req, url);
  };
}

function delayedJsonRoute(
  data: unknown,
  ms: number,
  status = 200,
): RouteHandler {
  return delayedRoute(jsonRoute(data, status), ms);
}

function invalidJsonRoute(): RouteHandler {
  return () => new Response("not json", { status: 200 });
}

const NOT_FOUND = { code: 404 as const, message: "Unknown element" };

const API_PREFIX = "/api";

const defaultRoutes: Record<string, RouteHandler> = {
  "/item": jsonRoute(fixtures.item),
  "/recipes": jsonRoute(fixtures.recipes),
  "/uses": jsonRoute(fixtures.uses),
  "/recipe": jsonRoute(fixtures.lineage),
  "/recipe/custom": jsonRoute(fixtures.customLineage),
  "/optimize-lineage": optimizeRoute(),
  "/analytics/share": jsonRoute(fixtures.share),
};

const routes: Record<string, RouteHandler> = { ...defaultRoutes };

function setRoute(path: string, handler: RouteHandler): void {
  routes[path] = handler;
}

function resetRoutes(): void {
  for (const path of Object.keys(routes)) {
    delete routes[path];
  }
  Object.assign(routes, defaultRoutes);
}

const log: LoggedRequest[] = [];

function clearLog(): void {
  log.length = 0;
}

function getLog(): readonly LoggedRequest[] {
  return log;
}

function getClosedUrl(): string {
  const temp = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch: () => new Response(),
  });
  const port = temp.port;
  void temp.stop(true);

  return `http://127.0.0.1:${port}/api`;
}

let server: ReturnType<typeof Bun.serve> | null = null;

function startMockServer(): string {
  server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    async fetch(req) {
      const url = new URL(req.url);
      const body = await req.text();

      log.push({
        method: req.method,
        path: url.pathname,
        url: url.href,
        headers: Object.fromEntries(req.headers.entries()),
        body: body || null,
      });

      const handler = routes[url.pathname.slice(API_PREFIX.length)];
      if (!handler) {
        return Response.json(NOT_FOUND, { status: 404 });
      }

      return handler(req, url);
    },
  });

  return `http://127.0.0.1:${server.port}/api`;
}

function stopMockServer(): void {
  void server?.stop(true);
  server = null;
}

export {
  fixtures,
  delayedJsonRoute,
  invalidJsonRoute,
  setRoute,
  resetRoutes,
  clearLog,
  getLog,
  getClosedUrl,
  startMockServer,
  stopMockServer,
};
