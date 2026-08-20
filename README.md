# Parluvox

## Архитектура

```
packages/
  server/   Node.js + TypeScript. WebSocket-сессия, STT (Deepgram), LLM (pluggable), файловое хранилище истории.
  web/      React + Vite. Захват микрофона HR, live-транскрипт, карточки "вопрос/ответ".
  desktop/  Electron-обвязка над web — тихий захват системного звука, скрытие окна от чужого захвата экрана, portable-сборка.
```

Функциональное ядро отделено от side-effect'ов:

- `packages/server/src/core/sessionState.ts` — чистый редьюсер состояния сессии,
  без I/O. Покрыт тестами без единого мока.
- `packages/server/src/core/pipeline.ts` — оркестрация перевода и генерации
  эталонного ответа поверх интерфейса `LlmProvider` (тесты используют фейковую
  реализацию — это заглушка на границе системы, а не мок собственного кода).
- `packages/server/src/llm/`, `src/stt/` — все внешние вызовы (LLM, STT) и
  `src/repository/` (хранилище) изолированы за интерфейсами.

Аудио: `🎙 Ты` — микрофон HR (`getUserMedia`), `🎧 Собеседник` — системный
звук (`getDisplayMedia` с `systemAudio: "include"` в браузере, либо тихо
через `session.setDisplayMediaRequestHandler` в Electron — см. ниже). Оба
канала транскрибируются непрерывно; финальная фраза длиннее 8 символов,
заканчивающаяся на "?" (`isQuestionShaped` в `pipeline.ts`), уходит в
`buildQaRecord` и превращается в карточку с эталонным ответом на двух языках.

В коде **нет дефолтного LLM-провайдера**. `LLM_PROVIDER` (`openai` или
`anthropic`) обязателен, сервер не стартует без него. Обе реализации
(`src/llm/openaiProvider.ts`, `src/llm/anthropicProvider.ts`) — прямые
HTTP-вызовы без SDK за одним интерфейсом `LlmProvider`.

## Запуск (браузер, dev)

```bash
npm install
cp .env.example .env   # заполнить LLM_PROVIDER, соответствующий *_API_KEY, DEEPGRAM_API_KEY

npm run dev:server      # http://localhost:8787, WS-эндпоинт /session
npm run dev:web          # http://localhost:5173, проксирует /session на сервер
npm run test:server      # тесты чистого ядра
```

## Запуск через Electron (dev)

Обычный запуск в Chrome требует диалога "Поделиться экраном" для захвата
звука собеседника — диалог всплывает при каждом запуске и не даёт скрыть
окно от чужого захвата экрана. `packages/desktop` закрывает оба момента без
изменения кода `packages/web`:

- `session.setDisplayMediaRequestHandler` в главном процессе тихо отдаёт
  системный звук (`audio: "loopback"`) без нативного диалога.
- `win.setContentProtection(true)` исключает окно из захвата другими
  приложениями — `SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)` на
  Windows 10 версии 2004+ (на более старых Windows окно вместо этого будет
  видно чёрным прямоугольником), `NSWindowSharingType.none` на macOS.

```bash
npm run dev:server       # сначала поднять сервер и web как обычно
npm run dev:web
npm run dev:desktop      # затем открыть тот же web в Electron-окне
```

`packages/desktop` подключается к уже запущенному `dev:web` по адресу из
`PARLUVOX_WEB_URL` (по умолчанию `http://localhost:5173`) — это не
production-сборка, а окно для одного и того же дев-сервера.

## Portable-сборка (один .exe)

```bash
npm run package:desktop
```

Соберёт `packages/server` и `packages/web`, скопирует их в
`packages/desktop/vendor` вместе с рантайм-зависимостями сервера (`ws`,
`undici`) и упакует всё через `electron-builder` в
`packages/desktop/release/Parluvox-<версия>-portable.exe`. Самодостаточный
файл: сервер (Node/WS/LLM/STT) и собранный `web/dist` запускаются внутри
самого приложения одним процессом (`utilityProcess.fork`, статику отдаёт
сам сервер — `WEB_DIST_DIR` в `http/server.ts`), второй Node.js на чужом
компьютере не нужен.

Готовые сборки публикуются в [GitHub Releases](../../releases). Тот, кто
запускает чужую сборку, настраивает ключи так же, как при dev-запуске —
копирует `.env.example` в `.env`, вписывает свои
`LLM_PROVIDER`/`*_API_KEY`/`DEEPGRAM_API_KEY` — и кладёт этот `.env`
**рядом с `.exe`** (portable-сборка Electron даёт переменную
`PORTABLE_EXECUTABLE_DIR`, указывающую именно туда, а не на временную папку
распаковки — `.env` подхватится оттуда тем же `loadDotEnv`, что и в dev).

Если что-то не запустилось — лог главного процесса лежит в
`%APPDATA%\Parluvox\desktop-debug.log` (путь к серверу, его stdout/stderr,
ошибки ожидания старта).

Не сделано: код-подпись exe (Windows/SmartScreen предупредит про
неизвестного издателя), иконка приложения, автообновления, сборка под
macOS/Linux.

## Что осознанно не сделано (решения за вами / за компанией)

- **Хранилище** — сейчас JSONL-файлы на диск (`data/<sessionId>.jsonl`) за
  интерфейсом `QaRepository`. Для прод-использования — замена на
  Postgres/аналог, это отдельное архитектурное решение (объём данных,
  retention policy, бэкапы).
- **Аутентификация HR** — не реализована. Внутренний инструмент компании
  обычно живёт за SSO/VPN; конкретный механизм — решение ИТ/безопасности.
- **Data retention / 152-ФЗ** — транскрипты и сгенерированные ответы
  сохраняются бессрочно локально. Нужна политика хранения и, вероятно,
  юридическое согласование формы уведомления кандидата (сейчас это просто
  чекбокс в UI, ничего более).
- **Определение языка вопроса** — сейчас грубая эвристика (кириллица → `ru`,
  иначе `en`). Для мультиязычных интервью (не ru/en) стоит заменить на вызов
  LLM/отдельного language-detection сервиса.
- **STT-провайдер** — захардкожен Deepgram, но тоже за интерфейсом
  `SttProvider` — при необходимости меняется так же, как LLM.
