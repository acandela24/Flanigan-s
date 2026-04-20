const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const { randomUUID } = require('crypto');
const { getDB } = require('../db/init');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildSystemPrompt() {
  const db = getDB();
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const s = Object.fromEntries(rows.map(r => [r.key, r.value]));

  const menuItems = db.prepare('SELECT * FROM menu_items WHERE active = 1 ORDER BY category, name').all();
  const faqs = db.prepare('SELECT question, answer FROM faqs WHERE active = 1').all();

  const menuByCategory = {};
  for (const item of menuItems) {
    if (!menuByCategory[item.category]) menuByCategory[item.category] = [];
    menuByCategory[item.category].push(item);
  }

  let menuText = '';
  for (const [category, items] of Object.entries(menuByCategory)) {
    menuText += `\n${category}:\n`;
    for (const item of items) {
      menuText += `  • ${item.name}`;
      if (item.price) menuText += ` — $${item.price}`;
      menuText += '\n';
      if (item.description) menuText += `    ${item.description}\n`;
      if (item.ingredients) menuText += `    Ingredients: ${item.ingredients}\n`;
    }
  }

  const faqText = faqs.map(f => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n');

  return `You are the friendly virtual assistant for ${s.restaurant_name || "Flanigan's Seafood Bar and Grill"}, a beloved South Florida institution since ${s.founded || '1959'}.

PERSONALITY:
${s.bot_personality || "Warm, laid-back, and friendly — like a South Florida bartender at Flanigan's. Casual, enthusiastic about the food and great value."}

RESTAURANT INFORMATION:
- Name: ${s.restaurant_name}
- Tagline: ${s.tagline}
- Founded: ${s.founded}
- Locations: ${s.address}
- Phone/Contact: ${s.phone}
- Hours: ${s.hours}
- Website: ${s.website}

MENU:
${menuText || 'Menu info coming soon — ask your server!'}

FREQUENTLY ASKED QUESTIONS:
${faqText || 'More info coming soon.'}
${s.custom_instructions ? `\nADDITIONAL INSTRUCTIONS:\n${s.custom_instructions}` : ''}

GUIDELINES:
- Keep responses concise, warm, and conversational
- Never invent specific prices or hours not listed above — direct guests to the website or a phone call
- Be enthusiastic about the food: emphasize freshness, big portions, great value
- You represent a beloved local institution — be proud and welcoming
- If asked something you can't answer, say so kindly and direct them to ${s.website}`;
}

router.post('/message', async (req, res) => {
  const { message, sessionId } = req.body;

  if (!message?.trim()) {
    return res.status(400).json({ error: 'Message is required' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({
      error: "The chatbot isn't configured yet — please ask the restaurant to set up the API key.",
    });
  }

  const db = getDB();
  const sid = sessionId || randomUUID();

  db.prepare('INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)').run(sid, 'user', message.trim());

  try {
    const history = db
      .prepare(
        `SELECT role, content FROM chat_messages
         WHERE session_id = ?
         ORDER BY created_at DESC LIMIT 20`
      )
      .all(sid)
      .reverse();

    const response = await anthropic.messages.create({
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: buildSystemPrompt(),
      messages: history.map(m => ({ role: m.role, content: m.content })),
    });

    const reply = response.content[0].text;
    db.prepare('INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)').run(sid, 'assistant', reply);

    res.json({ reply, sessionId: sid });
  } catch (err) {
    console.error('Claude API error:', err.message);
    res.status(500).json({
      error: "Oops! I'm having a little trouble right now. Give me a moment and try again, or call your nearest Flanigan's directly!",
    });
  }
});

router.get('/greeting', (req, res) => {
  const db = getDB();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('bot_greeting');
  res.json({
    greeting: row?.value || "Hey there! Welcome to Flanigan's! 🐟 How can I help ya today?",
  });
});

module.exports = router;
