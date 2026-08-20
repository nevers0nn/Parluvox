export interface TranscriptChunk {
  text: string;
  isFinal: boolean;
  detectedLang?: string;
}

export interface SttStream {
  sendAudio(chunk: Buffer): void;
  close(): void;
}

export interface SttProvider {
  readonly name: string;
  openStream(onTranscript: (chunk: TranscriptChunk) => void, onError: (error: Error) => void, label?: string): SttStream;
}
