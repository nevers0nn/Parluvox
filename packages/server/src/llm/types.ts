export interface TranslateInput {
  text: string;
  sourceLang?: string;
  targetLang: string;
}

export interface ReferenceAnswerInput {
  question: string;
  questionLang: string;
  jobContext?: string;
}

export interface LlmProvider {
  readonly name: string;
  translate(input: TranslateInput): Promise<string>;
  generateReferenceAnswer(input: ReferenceAnswerInput): Promise<string>;
}
