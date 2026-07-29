import { describe, expect, it } from "vitest";

import {
  hashPassword,
  PASSWORD_ITERATIONS,
  validatePasswordPolicy,
  verifyPassword,
} from "~/features/auth/password.server";

describe("password hashing", () => {
  it("uses the Cloudflare Workers PBKDF2 iteration ceiling", () => {
    expect(PASSWORD_ITERATIONS).toBe(100_000);
  });

  it("hashes and verifies a policy-compliant password", async () => {
    const password = "correct horse battery staple";
    const result = await hashPassword(password);

    expect(result.iterations).toBe(100_000);
    await expect(
      verifyPassword(
        password,
        result.hash,
        result.salt,
        result.iterations,
      ),
    ).resolves.toBe(true);
    await expect(
      verifyPassword(
        "incorrect password value",
        result.hash,
        result.salt,
        result.iterations,
      ),
    ).resolves.toBe(false);
  });

  it("keeps the minimum password length policy", () => {
    expect(validatePasswordPolicy("short")).toBe("密码至少需要 12 个字符");
    expect(validatePasswordPolicy("long-enough-password")).toBeNull();
  });
});
