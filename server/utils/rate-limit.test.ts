import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit, resetRateLimitStore } from "./rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => resetRateLimitStore());

  it("allows requests under the limit", () => {
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit("1.2.3.4")).toBe(true);
    }
  });

  it("blocks requests over the limit", () => {
    for (let i = 0; i < 5; i++) checkRateLimit("1.2.3.4");
    expect(checkRateLimit("1.2.3.4")).toBe(false);
  });

  it("tracks different IPs independently", () => {
    for (let i = 0; i < 5; i++) checkRateLimit("1.1.1.1");
    expect(checkRateLimit("1.1.1.1")).toBe(false);
    expect(checkRateLimit("2.2.2.2")).toBe(true);
  });

  it("resets after the window expires", () => {
    for (let i = 0; i < 5; i++) checkRateLimit("1.2.3.4");
    // Manually expire the window by resetting the store
    resetRateLimitStore();
    expect(checkRateLimit("1.2.3.4")).toBe(true);
  });
});
