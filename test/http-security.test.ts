import { describe, expect, it } from "vitest";

import { assertSameOrigin } from "~/lib/http.server";

describe("same-origin mutation guard", () => {
  it("accepts same-origin browser mutations", () => {
    const request = new Request("https://example.test/admin/users", {
      method: "POST",
      headers: { Origin: "https://example.test", "Sec-Fetch-Site": "same-origin" },
    });
    expect(() => assertSameOrigin(request)).not.toThrow();
  });

  it("rejects cross-site and malformed origins", () => {
    const crossSite = new Request("https://example.test/admin/users", {
      method: "POST",
      headers: { Origin: "https://attacker.test", "Sec-Fetch-Site": "cross-site" },
    });
    expect(() => assertSameOrigin(crossSite)).toThrow(Response);

    const malformed = new Request("https://example.test/admin/users", {
      method: "POST",
      headers: { Origin: "not-an-origin" },
    });
    expect(() => assertSameOrigin(malformed)).toThrow(Response);
  });
});
