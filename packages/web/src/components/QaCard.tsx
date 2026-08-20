import type { QaRecord } from "../api/types.js";

const SOURCE_LABEL: Record<QaRecord["source"], string> = {
  self: "🎙 Я спросил(а)",
  other: "🎧 Мне задали",
};

export function QaCard({ record }: { record: QaRecord }) {
  return (
    <article className="qa-card">
      <div className="qa-card-header">
        <span className="source-badge">{SOURCE_LABEL[record.source]}</span>
        <time>{new Date(record.createdAt).toLocaleTimeString()}</time>
      </div>

      <section>
        <h3>Вопрос ({record.questionLang})</h3>
        <p>{record.questionOriginal}</p>
        {record.questionLang !== "ru" && <p className="translation">{record.questionRu}</p>}
      </section>

      <section>
        <h3>Эталонный ответ</h3>
        <p>{record.referenceAnswerOriginal}</p>
        {record.questionLang !== "ru" && <p className="translation">{record.referenceAnswerRu}</p>}
      </section>
    </article>
  );
}
