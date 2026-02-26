/**
 * Fortune API — proxied through /fortune (Cloudflare Pages Function)
 *
 * The Anthropic API key lives server-side only.
 */

function buildPrompt(dateStr, timeStr, bazi) {
  const { year, month, day, hour } = bazi;
  const fmt = (p) =>
    p ? `${p.stem}${p.branch} (${p.element} ${p.animal})` : 'Not provided';

  return `You are a master Ba Zi (八字) fortune teller in the tradition of Chinese metaphysics.

The user was born on ${dateStr}${timeStr ? ` at ${timeStr}` : ''} (time ${timeStr ? 'provided' : 'unknown'}).

Their Four Pillars (Ba Zi chart) are:
- Year Pillar:  ${fmt(year)}
- Month Pillar: ${fmt(month)}
- Day Pillar:   ${fmt(day)}
- Hour Pillar:  ${fmt(hour)}

Today is Chinese New Year 2026, the Year of the Fire Horse (丙午).

Provide a Ba Zi reading with the following sections. Use poetic, evocative language.
Mix in occasional Chinese characters for key terms. Be specific to their chart —
avoid generic horoscope language.

Format your response as JSON with EXACTLY these keys (no markdown, no code fences, raw JSON only):
{
  "zodiac_animal": "...",
  "zodiac_element": "...",
  "personality": "2-3 sentences",
  "five_elements": {
    "dominant": "element name",
    "reading": "1-2 sentences about their elemental balance and what it means in 2026"
  },
  "wealth": "2-3 sentences",
  "relationships": "2-3 sentences",
  "compatibility": {
    "reading": "2-3 sentences about who they harmonize with and clash with in 2026 and why",
    "harmonious": ["Animal1", "Animal2"],
    "challenging": ["Animal1", "Animal2"]
  },
  "overall": "One powerful summary sentence — their fortune motto for 2026",
  "lucky_numbers": [3, 7],
  "lucky_colors": ["Crimson", "Gold"],
  "lucky_directions": ["South", "Southeast"]
}`;
}

/**
 * Call the /fortune proxy and stream back the JSON fortune reading.
 * onChunk(text) called with each streaming token.
 * Returns the full parsed fortune object.
 */
export async function getFortune(dateStr, timeStr, bazi, onChunk) {
  const prompt = buildPrompt(dateStr, timeStr, bazi);

  let response;
  try {
    response = await fetch('/fortune', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
  } catch (err) {
    throw new Error('Could not reach the oracle. Check your connection.');
  }

  if (!response.ok) {
    const status = response.status;
    if (status === 401) throw new Error('API key missing — set ANTHROPIC_API_KEY in Cloudflare Pages.');
    if (status === 429) throw new Error('Rate limited — wait a moment and try again.');
    throw new Error(`Oracle unreachable (${status}). Try again.`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop(); // hold incomplete last line

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const event = JSON.parse(data);
        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
          fullText += event.delta.text;
          onChunk?.(event.delta.text);
        }
      } catch { /* ignore malformed SSE lines */ }
    }
  }

  const cleaned = fullText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.error('Failed to parse fortune JSON:', cleaned);
    throw new Error('The oracle spoke in riddles. Please try again.');
  }
}
