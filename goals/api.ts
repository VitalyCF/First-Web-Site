export const errorMessages: Record<string, string> = {
  stale_review:
    "Your journal changed since this review was drafted. Ask Katya for an updated review.",
  conflict:
    "Your journal changed in another tab. Reloaded the latest version. Please try again.",
  chat_busy: "Katya is already responding in this conversation. Please wait.",
  context_changed: "Open a new conversation for this year or goal.",
  gateway_access:
    "The OpenAI key in AI Gateway could not be used. Check the provider connection.",
  gateway_missing: "AI Gateway is not configured.",
  model_unavailable:
    "This model is not available in your OpenAI project. Try the other response mode.",
  quota: "Your OpenAI project has reached its credit or spending limit.",
  rate_limit: "OpenAI is temporarily limiting requests. Try again shortly.",
  incomplete:
    "The answer was interrupted. Your draft is still here. Please retry.",
  invalid_response:
    "The model could not finish a valid draft. Please try again.",
  invalid_plan:
    "The plan needs a correction before it can be saved. Ask Katya to revise it.",
  invalid_review:
    "The review included an unsupported reference. Please ask Katya to revise it.",
  ai_unavailable:
    "Could not reach OpenAI through AI Gateway. Please try again.",
  goal_removed:
    "This goal is no longer in the journal. Start a new conversation.",
  conversation_full:
    "This conversation is full. Start a new conversation to continue.",
};
export class RequestError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(
      status === 401
        ? "Your session expired. Sign in again."
        : errorMessages[code] ||
            "Could not complete this action. Please try again.",
    );
  }
}
export async function api<T = any>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const r = await fetch("/api/kurs/" + path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  const data = (await r.json()) as any;
  if (!r.ok) throw new RequestError(r.status, data.error);
  return data;
}
