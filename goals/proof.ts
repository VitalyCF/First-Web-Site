const encoder = new TextEncoder();
export function loginMessage(origin: string, time: number, nonce: string) {
  return encoder.encode(
    ["Курс · вход", origin, String(time), nonce].join("\n"),
  );
}
export async function signLogin(seed: string, origin: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(seed))
    throw Error("Проверь, что скопировал ключ целиком.");
  const bytes = Uint8Array.from(
    atob(seed.replace(/-/g, "+").replace(/_/g, "/") + "="),
    (c) => c.charCodeAt(0),
  );
  // PKCS #8 wrapper for a raw Ed25519 seed, RFC 8410 section 10.3.
  const prefix = [48, 46, 2, 1, 0, 48, 5, 6, 3, 43, 101, 112, 4, 34, 4, 32];
  const key = await crypto.subtle.importKey(
    "pkcs8",
    new Uint8Array([...prefix, ...bytes]),
    "Ed25519",
    false,
    ["sign"],
  );
  const time = Math.floor(Date.now() / 1000),
    nonce = crypto.randomUUID();
  const signature = await crypto.subtle.sign(
    "Ed25519",
    key,
    loginMessage(origin, time, nonce),
  );
  return {
    time,
    nonce,
    signature: btoa(String.fromCharCode(...new Uint8Array(signature))),
  };
}
