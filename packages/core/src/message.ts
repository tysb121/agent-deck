export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: MessageRole;
  /** Accumulated text (streaming adapters append deltas). */
  content: string;
  createdAt: string;
  streaming?: boolean;
}
