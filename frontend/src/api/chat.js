const SYSTEM_PROMPT = `You are CryptosDen AI, an expert cryptocurrency assistant.
You have access to real-time web search. Help users with crypto markets, prices,
trends, coins, DeFi, NFTs and trading strategies. Be concise and factual.
Always remind users that nothing you say is financial advice.`;

export const sendChat = async (messages) => {
  if (!window.puter?.ai) throw new Error('Puter.js not loaded. Please refresh.');

  const formatted = messages
    .filter(m => m?.parts?.[0]?.text?.trim())
    .map(m => ({
      role:    m.role === 'model' ? 'assistant' : 'user',
      content: m.parts[0].text,
    }));

  const response = await window.puter.ai.chat(
    [{ role: 'system', content: SYSTEM_PROMPT }, ...formatted],
    {
      model: 'openai/gpt-5.3-chat',            // ← model name only
      tools: [{ type: 'web_search' }],  // ← separate option
    }
  );

  const reply =
    response?.message?.content ||
    response?.content           ||
    (typeof response === 'string' ? response : 'No response.');

  return { data: { reply } };
};
