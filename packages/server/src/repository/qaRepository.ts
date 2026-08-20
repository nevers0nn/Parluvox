import { appendFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { QaRecord } from "../core/sessionState.js";

export interface QaRepository {
  append(sessionId: string, record: QaRecord): void;
  listBySession(sessionId: string): QaRecord[];
}

export function createFileQaRepository(dataDir: string): QaRepository {
  mkdirSync(dataDir, { recursive: true });
  const pathFor = (sessionId: string) => join(dataDir, `${sessionId}.jsonl`);

  return {
    append(sessionId, record) {
      appendFileSync(pathFor(sessionId), `${JSON.stringify(record)}\n`, "utf8");
    },

    listBySession(sessionId) {
      const path = pathFor(sessionId);
      if (!existsSync(path)) return [];
      return readFileSync(path, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as QaRecord);
    },
  };
}
