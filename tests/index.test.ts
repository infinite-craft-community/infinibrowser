import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";

import { Infinibrowser } from "infinibrowser";

import {
  clearLog,
  delayedJsonRoute,
  fixtures,
  getClosedUrl,
  getLog,
  invalidJsonRoute,
  resetRoutes,
  setRoute,
  startMockServer,
  stopMockServer,
} from "./mock-server";

let API_URL = "";
let ib: Infinibrowser;

beforeAll(() => {
  API_URL = startMockServer();
  ib = new Infinibrowser({ API_URL, timeout: 5000 });
});

afterAll(() => {
  stopMockServer();
});

afterEach(() => {
  resetRoutes();
  clearLog();
});

describe("Infinibrowser", () => {
  describe(".getItem", () => {
    it("returns the item data", async () => {
      const response = await ib.getItem("Water");

      expect(response.ok).toBe(true);
      expect(response).toHaveProperty("data", fixtures.item);
    });

    it("requests the item with its id", async () => {
      await ib.getItem("Water");

      const [request] = getLog();
      expect(request?.method).toBe("GET");
      expect(request?.path).toBe("/api/item");
      expect(new URL(request?.url ?? "").searchParams.get("id")).toBe("Water");
    });

    it("returns NOT_OK with the error data on unknown element", async () => {
      const notFound = { code: 404 as const, message: "Unknown element" };
      setRoute("/item", () => Response.json(notFound, { status: 404 }));

      const response = await ib.getItem("Water");

      expect(response).toHaveProperty("ok", false);
      expect(response).toHaveProperty("error_code", "NOT_OK");
      expect(response).toHaveProperty("data", notFound);
    });
  });

  describe(".getRecipes", () => {
    it("returns the recipes data", async () => {
      const response = await ib.getRecipes("Engine");

      expect(response.ok).toBe(true);
      expect(response).toHaveProperty("data", fixtures.recipes);
    });

    it("requests the recipes with id and offset", async () => {
      await ib.getRecipes("Engine", { offset: 10 });

      const url = new URL(getLog()[0]?.url ?? "");
      expect(url.pathname).toBe("/api/recipes");
      expect(url.searchParams.get("id")).toBe("Engine");
      expect(url.searchParams.get("offset")).toBe("10");
    });
  });

  describe(".getUses", () => {
    it("returns the uses data", async () => {
      const response = await ib.getUses("Engine");

      expect(response.ok).toBe(true);
      expect(response).toHaveProperty("data", fixtures.uses);
    });
  });

  describe(".getLineage", () => {
    it("returns the lineage data", async () => {
      const response = await ib.getLineage("Engine");

      expect(response.ok).toBe(true);
      expect(response).toHaveProperty("data", fixtures.lineage);
    });

    it("returns NOT_OK with the error data when ratelimited", async () => {
      const notSoFast = { code: 429 as const, message: "Not so fast!" };
      setRoute("/recipe", () => Response.json(notSoFast, { status: 429 }));

      const response = await ib.getLineage("Engine");

      expect(response).toHaveProperty("ok", false);
      expect(response).toHaveProperty("error_code", "NOT_OK");
      expect(response).toHaveProperty("data", notSoFast);
    });

    it("returns NOT_OK with the error data on upstream error", async () => {
      const internalError = {
        code: 500 as const,
        message: "Internal Server Error",
      };
      setRoute("/recipe", () => Response.json(internalError, { status: 500 }));

      const response = await ib.getLineage("Engine");

      expect(response).toHaveProperty("ok", false);
      expect(response).toHaveProperty("error_code", "NOT_OK");
      expect(response).toHaveProperty("data", internalError);
    });
  });

  describe(".getCustomLineage", () => {
    it("returns the custom lineage data for a shared lineage id", async () => {
      const response = await ib.getCustomLineage(fixtures.share.id);

      expect(response.ok).toBe(true);
      expect(response).toHaveProperty("data", fixtures.customLineage);
    });

    it("requests a shared lineage by its id", async () => {
      const shareResponse = await ib.shareLineage(fixtures.shareSteps);
      expect(shareResponse.ok).toBe(true);
      if (!shareResponse.ok) return;

      const response = await ib.getCustomLineage(shareResponse.data.id);

      const [shareRequest, request] = getLog();
      expect(shareRequest?.method).toBe("POST");
      expect(shareRequest?.path).toBe("/api/analytics/share");
      expect(request?.method).toBe("GET");
      expect(request?.path).toBe("/api/recipe/custom");
      expect(new URL(request?.url ?? "").searchParams.get("id")).toBe(
        shareResponse.data.id,
      );

      expect(response.ok).toBe(true);
      expect(response).toHaveProperty("data", fixtures.customLineage);
    });

    it("returns NOT_OK with the error data on an invalid element id", async () => {
      const invalidId = { code: 400 as const, message: "Invalid element ID" };
      setRoute("/recipe/custom", () =>
        Response.json(invalidId, { status: 400 }),
      );

      const response = await ib.getCustomLineage(fixtures.share.id);

      expect(response).toHaveProperty("ok", false);
      expect(response).toHaveProperty("error_code", "NOT_OK");
      expect(response).toHaveProperty("data", invalidId);
    });

    it("returns the custom lineage data with no missing recipes", async () => {
      setRoute("/recipe/custom", () =>
        Response.json({ ...fixtures.customLineage, missing: {} }),
      );

      const response = await ib.getCustomLineage(fixtures.share.id);

      expect(response.ok).toBe(true);
      expect(response).toHaveProperty("data.missing", {});
    });
  });

  describe(".optimizeLineage", () => {
    it("optimizes a lineage shared via shareLineage", async () => {
      const shareResponse = await ib.shareLineage(fixtures.shareSteps);
      expect(shareResponse.ok).toBe(true);
      if (!shareResponse.ok) return;

      const lineageId = shareResponse.data.id;
      expect(lineageId).toMatch(/^[0-9a-z]{26}$/);

      const response = await ib.optimizeLineage(lineageId);

      const [shareRequest, optimizeRequest] = getLog();
      expect(shareRequest?.path).toBe("/api/analytics/share");
      expect(optimizeRequest?.method).toBe("POST");
      expect(optimizeRequest?.path).toBe("/api/optimize-lineage");
      expect(new URL(optimizeRequest?.url ?? "").searchParams.get("id")).toBe(
        lineageId,
      );
      expect(optimizeRequest?.headers["content-type"]).toBe("application/json");

      expect(response.ok).toBe(true);
      if (!response.ok) return;
      expect(response.data).toEqual({ id: lineageId, before: 40, after: 12 });
    });
  });

  describe(".shareLineage", () => {
    it("throws when the lineage is empty", async () => {
      const error = await ib
        .shareLineage([])
        .catch((thrown: unknown) => thrown);

      expect(error).toBeInstanceOf(Error);
      expect(error).toHaveProperty("message", "Lineage must not be empty");
    });

    it("posts the lineage steps and returns the share id", async () => {
      const response = await ib.shareLineage(fixtures.shareSteps);

      const [request] = getLog();
      expect(request?.method).toBe("POST");
      expect(request?.path).toBe("/api/analytics/share");

      const result = fixtures.shareSteps[0]?.[2];
      const body = JSON.parse(request?.body ?? "null");
      expect(body).toEqual({ ...result, steps: fixtures.shareSteps });
      expect(body).not.toHaveProperty("missing");

      expect(response.ok).toBe(true);
      expect(response).toHaveProperty("data", fixtures.share);
    });

    it("posts the missing recipes map with the lineage steps", async () => {
      await ib.shareLineage(
        fixtures.shareSteps,
        fixtures.customLineage.missing,
      );

      const [request] = getLog();
      expect(request?.method).toBe("POST");
      expect(request?.path).toBe("/api/analytics/share");

      const result = fixtures.shareSteps[0]?.[2];
      const body = JSON.parse(request?.body ?? "null");
      expect(body).toEqual({
        ...result,
        steps: fixtures.shareSteps,
        missing: fixtures.customLineage.missing,
      });
    });
  });

  describe("timeouts", () => {
    it("returns TIMEOUT when the server is too slow", async () => {
      const slowIb = new Infinibrowser({ API_URL, timeout: 100 });
      setRoute("/item", delayedJsonRoute(fixtures.item, 1000));

      const response = await slowIb.getItem("Water");

      expect(response).toHaveProperty("ok", false);
      expect(response).toHaveProperty("error_code", "TIMEOUT");
    });
  });

  describe("invalid responses", () => {
    it("returns SYNTAX_ERROR when the response is not JSON", async () => {
      setRoute("/item", invalidJsonRoute());

      const response = await ib.getItem("Water");

      expect(response).toHaveProperty("ok", false);
      expect(response).toHaveProperty("error_code", "SYNTAX_ERROR");
    });

    it("returns UNKNOWN_ERROR when the request cannot be sent", async () => {
      const closedIb = new Infinibrowser({
        API_URL: getClosedUrl(),
        timeout: 5000,
      });

      const response = await closedIb.getItem("Water");

      expect(response).toHaveProperty("ok", false);
      expect(response).toHaveProperty("error_code", "UNKNOWN_ERROR");
    });
  });

  it("uses the configured API_URL for every endpoint", async () => {
    await ib.getUses("Engine");

    const [request] = getLog();
    expect(request?.url.startsWith(API_URL)).toBe(true);
  });
});
