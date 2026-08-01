import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes as nodeRandomBytes,
} from "node:crypto";

const VERSION = "v1";
const AAD = Buffer.from("YezYY/admin-password-setup/v1", "utf8");
const RAW_TOKEN = /^[A-Za-z0-9_-]{43}$/;
const BASE64URL = /^[A-Za-z0-9_-]+$/;

function keyFromSecret(secret: string | undefined): Buffer {
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("PASSWORD_SETUP_TOKEN_SECRET must be at least 32 bytes");
  }
  return createHash("sha256")
    .update("YezYY/admin-password-setup/key/v1\0", "utf8")
    .update(secret, "utf8")
    .digest();
}

export function sealPasswordSetupToken(
  rawToken: string,
  secret: string | undefined,
  randomBytes: (size: number) => Buffer = nodeRandomBytes,
): string {
  if (!RAW_TOKEN.test(rawToken)) {
    throw new Error("Password setup token has an invalid format");
  }
  const iv = randomBytes(12);
  if (iv.length !== 12) {
    throw new Error("Password setup seal IV must be 12 bytes");
  }
  const cipher = createCipheriv("aes-256-gcm", keyFromSecret(secret), iv);
  cipher.setAAD(AAD);
  const ciphertext = Buffer.concat([
    cipher.update(rawToken, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64url"),
    ciphertext.toString("base64url"),
    tag.toString("base64url"),
  ].join(".");
}

export function unsealPasswordSetupToken(
  sealedToken: string,
  secret: string | undefined,
): string {
  const [version, ivPart, ciphertextPart, tagPart, extra] =
    sealedToken.split(".");
  if (
    version !== VERSION ||
    !ivPart ||
    !ciphertextPart ||
    !tagPart ||
    extra !== undefined ||
    !BASE64URL.test(ivPart) ||
    !BASE64URL.test(ciphertextPart) ||
    !BASE64URL.test(tagPart)
  ) {
    throw new Error("Password setup seal has an invalid format");
  }
  const iv = Buffer.from(ivPart, "base64url");
  const ciphertext = Buffer.from(ciphertextPart, "base64url");
  const tag = Buffer.from(tagPart, "base64url");
  if (iv.length !== 12 || tag.length !== 16 || ciphertext.length !== 43) {
    throw new Error("Password setup seal has an invalid format");
  }
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      keyFromSecret(secret),
      iv,
    );
    decipher.setAAD(AAD);
    decipher.setAuthTag(tag);
    const rawToken = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
    if (!RAW_TOKEN.test(rawToken)) {
      throw new Error("invalid token");
    }
    return rawToken;
  } catch {
    throw new Error("Password setup seal could not be opened");
  }
}
