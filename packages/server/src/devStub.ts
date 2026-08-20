import { createHttpServer } from "./http/server.js";
import { createStubLlmProvider } from "./llm/stubProvider.js";
import { createFileQaRepository } from "./repository/qaRepository.js";
import { createStubSttProvider } from "./stt/stubProvider.js";

const port = Number(process.env.PORT ?? 8787);

const deps = {
  llm: createStubLlmProvider(),
  stt: createStubSttProvider(),
  repository: createFileQaRepository(process.env.DATA_DIR ?? "./data"),
};

createHttpServer(deps).listen(port, () => {
  console.log(`Parluvox DEV-STUB server listening on :${port} — no real LLM/STT calls, canned responses only`);
});
