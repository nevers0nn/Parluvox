import type { PendingQuestion, SessionState } from "../api/types.js";

interface Props {
  listening: boolean;
  liveTranscripts: SessionState["liveTranscripts"];
  pending: PendingQuestion[];
  onStart: () => void;
  onStop: () => void;
}

export function QuestionCapture({ listening, liveTranscripts, pending, onStart, onStop }: Props) {
  return (
    <div className="question-capture">
      <button className={listening ? "recording" : ""} onClick={listening ? onStop : onStart}>
        {listening ? "⏹ Завершить собеседование" : "▶ Начать собеседование"}
      </button>

      {listening && (
        <div className="live-channels">
          <p className="live-transcript">
            <span className="channel-label">🎙 Ты:</span> {liveTranscripts.self || "…"}
          </p>
          <p className="live-transcript">
            <span className="channel-label">🎧 Собеседник:</span> {liveTranscripts.other || "…"}
          </p>
        </div>
      )}

      {pending.map((item) => (
        <p key={item.id} className="hint">
          {item.source === "self" ? "🎙" : "🎧"} Генерируем ответ на: «{item.questionOriginal}»…
        </p>
      ))}
    </div>
  );
}
