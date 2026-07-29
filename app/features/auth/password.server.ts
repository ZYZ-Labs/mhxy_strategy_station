import {
  base64ToBytes,
  bytesToBase64,
  constantTimeEqual,
} from "~/lib/crypto";

const textEncoder = new TextEncoder();
export const PASSWORD_ITERATIONS = 600_000;

async function derivePassword(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: salt.buffer.slice(
        salt.byteOffset,
        salt.byteOffset + salt.byteLength,
      ) as ArrayBuffer,
      iterations,
    },
    key,
    256,
  );
  return new Uint8Array(bits);
}

export function validatePasswordPolicy(password: string): string | null {
  if (password.length < 12) {
    return "密码至少需要 12 个字符";
  }
  if (password.length > 128) {
    return "密码不能超过 128 个字符";
  }
  return null;
}

export async function hashPassword(password: string): Promise<{
  hash: string;
  salt: string;
  iterations: number;
}> {
  const policyError = validatePasswordPolicy(password);
  if (policyError) {
    throw new Error(policyError);
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePassword(password, salt, PASSWORD_ITERATIONS);
  return {
    hash: bytesToBase64(hash),
    salt: bytesToBase64(salt),
    iterations: PASSWORD_ITERATIONS,
  };
}

export async function verifyPassword(
  password: string,
  expectedHash: string,
  salt: string,
  iterations: number,
): Promise<boolean> {
  if (password.length > 128 || iterations < PASSWORD_ITERATIONS) {
    return false;
  }
  const actual = await derivePassword(password, base64ToBytes(salt), iterations);
  return constantTimeEqual(actual, base64ToBytes(expectedHash));
}
