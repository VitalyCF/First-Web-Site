import { signLogin } from "../proof";
import { useState } from "react";
import { ArrowRight, KeyRound } from "lucide-react";

export function Login({
  mode,
  enter,
  retry,
}: {
  mode: "loading" | "login" | "error";
  enter: () => Promise<void>;
  retry: () => void;
}) {
  const [key, setKey] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !key.trim()) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/kurs/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(await signLogin(key.trim(), location.origin)),
      });
      if (!r.ok)
        throw Error(
          r.status === 401
            ? "Ключ не подошёл. Проверь, что скопировал его целиком."
            : "Не удалось войти. Попробуй ещё раз.",
        );
      setKey("");
      await enter();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="entry-page">
      <div className="entry-photo">
        <img
          src="/goals-media/alpine-ridge-1600.webp"
          alt="Горный хребет в Альпах"
        />
        <div className="entry-brand">
          <span className="kursmark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          Курс.
        </div>
      </div>
      <section className="entry-panel">
        <span className="section-kicker">Личный журнал целей</span>
        <h1>
          {mode === "loading"
            ? "Открываю журнал…"
            : mode === "error"
              ? "Связь прервалась"
              : "С возвращением."}
        </h1>
        {mode === "login" ? (
          <form className="form" onSubmit={signIn}>
            <label>
              <span>
                <KeyRound size={14} /> Ключ от журнала
              </span>
              <input
                required
                value={key}
                onChange={(e) => setKey(e.target.value)}
                type="password"
                autoComplete="current-password"
              />
            </label>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <button className="action-ink" disabled={busy}>
              {busy ? "Открываю…" : "Открыть журнал"}
              <ArrowRight size={16} />
            </button>
          </form>
        ) : mode === "error" ? (
          <button className="action-ink" onClick={retry}>
            Повторить
          </button>
        ) : null}
      </section>
    </main>
  );
}
