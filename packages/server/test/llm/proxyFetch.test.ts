import { describe, expect, it } from "vitest";
import { createHttpFetch } from "../../src/llm/proxyFetch.js";

describe("createHttpFetch", () => {
  it("returns the global fetch unchanged when no proxy is configured", () => {
    expect(createHttpFetch(undefined)).toBe(fetch);
  });

  it("returns a distinct callable when a proxy URL is configured", () => {
    const proxied = createHttpFetch("http://127.0.0.1:12334");
    expect(proxied).not.toBe(fetch);
    expect(typeof proxied).toBe("function");
  });
});
