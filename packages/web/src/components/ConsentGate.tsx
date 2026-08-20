import { useState } from "react";

interface Props {
  onConfirm: (givenBy: string) => void;
}

export function ConsentGate({ onConfirm }: Props) {
  const [checked, setChecked] = useState(false);
  const [hrName, setHrName] = useState("");

  return (
    <div className="consent-gate">
      <h2>Перед началом сессии</h2>
      <p>
        Ассистент обрабатывает голос интервьюера через сторонние сервисы распознавания речи и LLM.
        Начинайте сессию только если кандидат уведомлён об использовании ассистента в интервью
        согласно политике компании.
      </p>
      <label>
        HR, проводящий интервью
        <input value={hrName} onChange={(e) => setHrName(e.target.value)} placeholder="Имя" />
      </label>
      <label className="checkbox">
        <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
        Кандидат уведомлён и не возражает
      </label>
      <button disabled={!checked || !hrName} onClick={() => onConfirm(hrName)}>
        Начать сессию
      </button>
    </div>
  );
}
