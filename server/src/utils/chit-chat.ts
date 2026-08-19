/**
 * Cheap, local (no LLM call) detector for messages that don't need
 * document/graph retrieval or query enhancement — greetings, farewells,
 * acknowledgments, and meta questions about the assistant itself.
 *
 * Deliberately conservative: matches only when the ENTIRE message (after
 * trimming punctuation) is one of these patterns, not just contains one of
 * the words — "thanks for explaining, but what about X?" must NOT match,
 * since it's a real follow-up question wearing a pleasantry.
 *
 * If this ever misclassifies a real question as chit-chat, the agent still
 * has searchKnowledgeBase/queryKnowledgeGraph tools available and can call
 * them itself — the cost of a wrong guess is one extra tool round-trip on
 * that turn, not a lost answer. See agent.service.ts's doStreamAgentChat.
 */

const CHIT_CHAT_PATTERNS: RegExp[] = [
  // Greetings
  /^(hi|hello|hey|yo|hiya|howdy|greetings)( there)?$/,
  /^good (morning|afternoon|evening|night)$/,
  /^how are you( doing)?$/,
  /^(what'?s up|sup)$/,

  // Farewells
  /^(bye|goodbye|see you( later| soon)?|take care|later|cya)$/,

  // Acknowledgments / small talk
  /^(thanks|thank you|thx|ty|ok|okay|got it|cool|nice|great|good|sounds good|perfect|awesome|nice one)$/,
  /^(yes|yep|yeah|no|nope|sure)$/,

  // Meta questions about the assistant itself
  /^who are you$/,
  /^what are you$/,
  /^what can you do$/,
  /^what is this( app| tool| thing)?$/,
  /^how (do|does) (you|this) work$/,
  /^(are you|is this) an? (ai|bot|chatbot|assistant)$/,
];

/**
 * Normalizes (lowercase, trim, strip trailing punctuation/whitespace) and
 * tests the whole message against the chit-chat pattern list.
 */
export function isChitChatQuery(rawQuery: string): boolean {
  const normalized = rawQuery
    .trim()
    .toLowerCase()
    .replace(/[.!?,\s]+$/g, '') // trailing punctuation
    .replace(/\s+/g, ' ');

  if (!normalized) return false;

  return CHIT_CHAT_PATTERNS.some((pattern) => pattern.test(normalized));
}
