export const SESSION_COOKIE = "chat-platform-dashboard";
export const SESSION_MAX_AGE = 60 * 60 * 12;

const encoder = new TextEncoder();

const secret = () => (process.env.DASHBOARD_AUTH_SECRET ?? "").trim();
const password = () => (process.env.DASHBOARD_PASSWORD ?? "").trim();

export function dashboardAuthConfigured() {
  return Boolean(secret() && password());
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function sign(payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return base64Url(new Uint8Array(digest));
}

export async function createDashboardSession() {
  if (!dashboardAuthConfigured()) return null;
  const expires = Date.now() + SESSION_MAX_AGE * 1000;
  const payload = `v1.${expires}`;
  return { value: `${payload}.${await sign(payload)}`, maxAge: SESSION_MAX_AGE };
}

export async function verifyDashboardSession(value: string | undefined) {
  if (!value || !dashboardAuthConfigured()) return false;
  const [version, expires, proof] = value.split(".");
  if (version !== "v1" || !expires || !proof) return false;
  const expiry = Number(expires);
  if (!Number.isFinite(expiry) || expiry <= Date.now()) return false;
  return timingSafeEqual(proof, await sign(`${version}.${expires}`));
}

export function passwordMatches(input: string) {
  const expected = password();
  return Boolean(expected) && timingSafeEqual(input, expected);
}
