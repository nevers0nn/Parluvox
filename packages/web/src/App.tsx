import { useEffect, useRef, useState } from "react";
import { SessionClient } from "./api/socket.js";
import type { SessionState } from "./api/types.js";
import { ConsentGate } from "./components/ConsentGate.js";
import { QaCard } from "./components/QaCard.js";
import { QuestionCapture } from "./components/QuestionCapture.js";

const initialState: SessionState = {
  consentGivenAt: null,
  listening: false,
  liveTranscripts: { self: "", other: "" },
  pending: [],
  history: [],
};

export function App() {
  const clientRef = useRef<SessionClient | null>(null);
  const [state, setState] = useState<SessionState>(initialState);
  const [jobContext, setJobContext] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const client = new SessionClient((message) => {
      if (message.type === "state") setState(message.state);
      if (message.type === "session_started") {
        setState((prev) => ({ ...prev, history: message.history }));
      }
      if (message.type === "error") setNotice(`Ошибка: ${message.message}`);
      if (message.type === "warning") setNotice(message.message);
    });
    clientRef.current = client;
  }, []);

  const handleStart = () => {
    setNotice(null);
    clientRef.current?.startListening().catch((error: Error) => setNotice(error.message));
  };

  return (
    <main className="app">
      <h1>Parluvox</h1>
      <p className="subtitle">HR interview co-pilot — вопрос и эталонный ответ на двух языках</p>

      {notice && <p className="notice">{notice}</p>}

      {!state.consentGivenAt ? (
        <ConsentGate onConfirm={(hrName) => clientRef.current?.giveConsent(hrName)} />
      ) : (
        <>
          <label className="job-context">
            Контекст вакансии (опционально)
            <textarea
              value={jobContext}
              onChange={(e) => setJobContext(e.target.value)}
              onBlur={() => clientRef.current?.setJobContext(jobContext)}
              placeholder="Стек, грейд, ключевые требования…"
            />
          </label>

          <QuestionCapture
            listening={state.listening}
            liveTranscripts={state.liveTranscripts}
            pending={state.pending}
            onStart={handleStart}
            onStop={() => clientRef.current?.stopListening()}
          />

          <section className="history">
            {state.history.map((record) => (
              <QaCard key={record.id} record={record} />
            ))}
          </section>
        </>
      )}
    </main>
  );
}
