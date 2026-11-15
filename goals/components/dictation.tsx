import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";

type RecordingSession = {
  cancelled: boolean;
  recorder?: MediaRecorder;
  stream?: MediaStream;
  timer?: ReturnType<typeof setTimeout>;
  controller: AbortController;
};

export function Dictation({
  append,
  disabled,
}: {
  append: (text: string) => void;
  disabled: boolean;
}) {
  const [phase, setPhase] = useState("idle");
  const [message, setMessage] = useState("");
  const session = useRef<RecordingSession | null>(null);
  function cancel() {
    const current = session.current;
    if (!current) return;
    current.cancelled = true;
    current.controller.abort();
    clearTimeout(current.timer);
    if (current.recorder?.state === "recording") current.recorder.stop();
    current.stream?.getTracks().forEach((track) => track.stop());
    session.current = null;
  }
  useEffect(() => cancel, []);
  async function start() {
    if (session.current) return;
    setMessage("");
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setMessage("Use your keyboard’s microphone to dictate here.");
      return;
    }
    const current: RecordingSession = {
      cancelled: false,
      controller: new AbortController(),
    };
    session.current = current;
    const active = () => session.current === current;
    setPhase("opening");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!active()) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      current.stream = stream;
      const mime = [
        "audio/webm;codecs=opus",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ].find((t) => MediaRecorder.isTypeSupported(t));
      const recorder = new MediaRecorder(
        stream,
        mime ? { mimeType: mime } : undefined,
      );
      current.recorder = recorder;
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      recorder.onstop = async () => {
        clearTimeout(current.timer);
        stream.getTracks().forEach((track) => track.stop());
        if (!active()) return;
        setPhase("transcribing");
        try {
          const response = await fetch("/api/kurs/dictate", {
            method: "POST",
            body: new Blob(chunks, { type: recorder.mimeType }),
            signal: current.controller.signal,
          });
          if (!response.ok) throw Error();
          const data = (await response.json()) as { text: string };
          if (active() && data.text) append(data.text);
          else if (active()) setMessage("No speech detected. Try again.");
        } catch {
          if (active())
            setMessage("Could not transcribe this recording. Try again.");
        } finally {
          if (active()) {
            session.current = null;
            setPhase("idle");
          }
        }
      };
      recorder.start();
      setPhase("recording");
      current.timer = setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, 120000);
    } catch (e) {
      if (active()) {
        cancel();
        setPhase("idle");
        setMessage(
          (e as Error).name === "NotAllowedError"
            ? "Allow microphone access in your browser settings, then try again."
            : "Could not start the microphone. Try your keyboard’s dictation.",
        );
      }
    }
  }
  return (
    <div className="voice-control">
      <button
        type="button"
        className="minimum"
        disabled={disabled || phase === "opening" || phase === "transcribing"}
        onClick={() =>
          phase === "recording"
            ? session.current?.recorder?.stop()
            : void start()
        }
      >
        {phase === "recording" ? <Square size={14} /> : <Mic size={15} />}{" "}
        {phase === "recording"
          ? "Stop recording"
          : phase === "transcribing"
            ? "Transcribing…"
            : phase === "opening"
              ? "Opening mic…"
              : "Dictate"}
      </button>
      {phase !== "idle" && (
        <button
          type="button"
          className="underlink"
          onClick={() => {
            cancel();
            setPhase("idle");
          }}
        >
          Cancel
        </button>
      )}
      <small role="status">{message}</small>
    </div>
  );
}
