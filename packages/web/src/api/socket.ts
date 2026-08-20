import type { QuestionSource, ServerMessage } from "./types.js";

// systemAudio isn't in lib.dom's DisplayMediaStreamOptions yet — it's a
// Chromium-only extension. "include" is what makes Chrome's "Entire Screen"
// share checkbox capture the Windows audio-driver loopback (whatever plays
// through speakers/headphones), independent of which call app is running.
type ChromeDisplayMediaOptions = DisplayMediaStreamOptions & { systemAudio?: "include" | "exclude" };

const SOURCE_TAG: Record<QuestionSource, number> = { self: 0, other: 1 };

function tagChunk(source: QuestionSource, chunk: ArrayBuffer): Uint8Array {
  const tagged = new Uint8Array(chunk.byteLength + 1);
  tagged[0] = SOURCE_TAG[source];
  tagged.set(new Uint8Array(chunk), 1);
  return tagged;
}

async function openMicStream(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({ audio: true });
}

async function openSystemAudioStream(): Promise<MediaStream> {
  // Always shows a native picker — there is no "remember" for screen share,
  // so this can't be pre-granted the way mic access can.
  const displayStream = await navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: true,
    systemAudio: "include",
  } as ChromeDisplayMediaOptions);

  displayStream.getVideoTracks().forEach((track) => track.stop());

  const audioTracks = displayStream.getAudioTracks();
  if (audioTracks.length === 0) {
    throw new Error(
      'Аудио не передано. В диалоге "Поделиться экраном" выберите "Весь экран" и включите переключатель "Также поделиться системным звуком".'
    );
  }

  return new MediaStream(audioTracks);
}

interface ActiveChannel {
  stream: MediaStream;
  recorder: MediaRecorder;
}

export class SessionClient {
  private socket: WebSocket;
  private channels: Partial<Record<QuestionSource, ActiveChannel>> = {};
  private onMessage: (message: ServerMessage) => void;

  constructor(onMessage: (message: ServerMessage) => void) {
    this.onMessage = onMessage;
    const url = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/session`;
    this.socket = new WebSocket(url);
    this.socket.addEventListener("message", (event) => {
      onMessage(JSON.parse(event.data as string) as ServerMessage);
    });
  }

  giveConsent(givenBy: string): void {
    this.send({ type: "consent", givenBy });
  }

  setJobContext(text: string): void {
    this.send({ type: "job_context", text });
  }

  /**
   * Resolves as soon as the mic (mandatory) is live and the server has been
   * told to start listening — the UI can flip to "listening" right here.
   * System audio (best-effort, always needs a native picker the user must
   * act on) is requested afterwards and added as a second channel once/if it
   * succeeds, so a slow or declined screen-share dialog never blocks mic
   * capture from starting.
   */
  async startListening(): Promise<void> {
    await this.openChannel("self", openMicStream);
    this.send({ type: "listening_start", sources: ["self"] });

    this.openChannel("other", openSystemAudioStream)
      .then(() => this.send({ type: "add_channel", source: "other" }))
      .catch((error: Error) => {
        this.onMessage({
          type: "warning",
          message: `Системный звук не подключен (${error.message}). Слушаю только твой микрофон.`,
        });
      });
  }

  stopListening(): void {
    for (const source of Object.keys(this.channels) as QuestionSource[]) {
      const channel = this.channels[source];
      channel?.recorder.stop();
      channel?.stream.getTracks().forEach((track) => track.stop());
      delete this.channels[source];
    }
    this.send({ type: "listening_stop" });
  }

  private async openChannel(source: QuestionSource, open: () => Promise<MediaStream>): Promise<void> {
    const stream = await open();
    const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
    recorder.ondataavailable = async (event) => {
      if (event.data.size === 0 || this.socket.readyState !== WebSocket.OPEN) return;
      this.socket.send(tagChunk(source, await event.data.arrayBuffer()));
    };
    recorder.start(250);
    this.channels[source] = { stream, recorder };
  }

  private send(payload: unknown): void {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(payload));
    }
  }
}
