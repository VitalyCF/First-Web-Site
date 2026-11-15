import { type Planner } from "./planner";
export const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};
export const json = (
  data: unknown,
  status = 200,
  extra: Record<string, string> = {},
) => Response.json(data, { status, headers: { ...headers, ...extra } });
export async function body(request: Request, max: number) {
  if (Number(request.headers.get("Content-Length")) > max)
    throw new RangeError();
  const reader = request.body?.getReader();
  if (!reader) return {};
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      throw new RangeError();
    }
    chunks.push(value);
  }
  const buf = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    buf.set(c, offset);
    offset += c.byteLength;
  }
  const parsed = JSON.parse(new TextDecoder().decode(buf));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new SyntaxError();
  return parsed;
}
export async function journal(db: D1Database) {
  const row = await db
    .prepare("SELECT revision,content FROM journal WHERE id=1")
    .first<{ revision: number; content: string }>();
  return row
    ? { revision: row.revision, planner: JSON.parse(row.content) as Planner }
    : { revision: 0, planner: { goals: [] } };
}
