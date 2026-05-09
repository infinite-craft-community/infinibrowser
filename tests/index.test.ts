import { describe, it, expect } from "bun:test";

import { Infinibrowser } from "infinibrowser";

const ib = new Infinibrowser({ timeout: 250 });

describe("Infinibrowser", () => {
  describe(".getItem", () => {
    it("timeouts for getItem", async () => {
      const response = await ib.getItem("Water");
      expect(response).toHaveProperty("error_code", "TIMEOUT");
    });
  });

  describe(".getLineage", () => {
    it("timeouts for getLineage", async () => {
      const response = await ib.getLineage("Engine");
      expect(response).toHaveProperty("error_code", "TIMEOUT");
    });
  });

  describe(".getRecipes", () => {
    it("timeouts for getRecipes", async () => {
      const response = await ib.getRecipes("Engine");
      expect(response).toHaveProperty("error_code", "TIMEOUT");
    });
  });

  describe(".getUses", () => {
    it("timeouts for getUses", async () => {
      const response = await ib.getUses("Engine");
      expect(response).toHaveProperty("error_code", "TIMEOUT");
    });
  });
});
