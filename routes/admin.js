const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getDB } = require('../db/init');
const { authenticateToken, signToken } = require('../middleware/auth');

// ── Auth ──────────────────────────────────────────────────────────────────────

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  const db = getDB();
  const user = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = signToken({ id: user.id, username: user.username });
  res.json({ token, username: user.username });
});

router.get('/me', authenticateToken, (req, res) => {
  res.json({ username: req.user.username });
});

router.post('/change-password', authenticateToken, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords required' });
  if (newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });

  const db = getDB();
  const user = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE admin_users SET password_hash = ? WHERE id = ?').run(hash, req.user.id);
  res.json({ message: 'Password updated successfully' });
});

// ── Menu Items ────────────────────────────────────────────────────────────────

router.get('/menu', authenticateToken, (req, res) => {
  const db = getDB();
  const items = db.prepare('SELECT * FROM menu_items ORDER BY category, name').all();
  res.json(items);
});

router.post('/menu', authenticateToken, (req, res) => {
  const { category, name, description, ingredients, recipe, price, active } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });

  const db = getDB();
  const result = db
    .prepare(
      'INSERT INTO menu_items (category, name, description, ingredients, recipe, price, active) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .run(
      category || 'Main',
      name.trim(),
      description || '',
      ingredients || '',
      recipe || '',
      price || '',
      active !== false ? 1 : 0
    );

  const item = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(item);
});

router.put('/menu/:id', authenticateToken, (req, res) => {
  const { category, name, description, ingredients, recipe, price, active } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });

  const db = getDB();
  const existing = db.prepare('SELECT id FROM menu_items WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Menu item not found' });

  db.prepare(
    `UPDATE menu_items SET category=?, name=?, description=?, ingredients=?, recipe=?, price=?, active=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`
  ).run(
    category || 'Main',
    name.trim(),
    description || '',
    ingredients || '',
    recipe || '',
    price || '',
    active !== false ? 1 : 0,
    req.params.id
  );

  res.json(db.prepare('SELECT * FROM menu_items WHERE id = ?').get(req.params.id));
});

router.delete('/menu/:id', authenticateToken, (req, res) => {
  const db = getDB();
  const existing = db.prepare('SELECT id FROM menu_items WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Menu item not found' });

  db.prepare('DELETE FROM menu_items WHERE id = ?').run(req.params.id);
  res.json({ message: 'Deleted successfully' });
});

// ── FAQs ──────────────────────────────────────────────────────────────────────

router.get('/faqs', authenticateToken, (req, res) => {
  const db = getDB();
  res.json(db.prepare('SELECT * FROM faqs ORDER BY id').all());
});

router.post('/faqs', authenticateToken, (req, res) => {
  const { question, answer, active } = req.body;
  if (!question?.trim() || !answer?.trim()) return res.status(400).json({ error: 'Question and answer required' });

  const db = getDB();
  const result = db
    .prepare('INSERT INTO faqs (question, answer, active) VALUES (?, ?, ?)')
    .run(question.trim(), answer.trim(), active !== false ? 1 : 0);

  res.status(201).json(db.prepare('SELECT * FROM faqs WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/faqs/:id', authenticateToken, (req, res) => {
  const { question, answer, active } = req.body;
  if (!question?.trim() || !answer?.trim()) return res.status(400).json({ error: 'Question and answer required' });

  const db = getDB();
  const existing = db.prepare('SELECT id FROM faqs WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'FAQ not found' });

  db.prepare(
    'UPDATE faqs SET question=?, answer=?, active=?, updated_at=CURRENT_TIMESTAMP WHERE id=?'
  ).run(question.trim(), answer.trim(), active !== false ? 1 : 0, req.params.id);

  res.json(db.prepare('SELECT * FROM faqs WHERE id = ?').get(req.params.id));
});

router.delete('/faqs/:id', authenticateToken, (req, res) => {
  const db = getDB();
  const existing = db.prepare('SELECT id FROM faqs WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'FAQ not found' });

  db.prepare('DELETE FROM faqs WHERE id = ?').run(req.params.id);
  res.json({ message: 'Deleted successfully' });
});

// ── Settings ──────────────────────────────────────────────────────────────────

router.get('/settings', authenticateToken, (req, res) => {
  const db = getDB();
  const rows = db.prepare('SELECT key, value FROM settings ORDER BY key').all();
  res.json(Object.fromEntries(rows.map(r => [r.key, r.value])));
});

router.put('/settings', authenticateToken, (req, res) => {
  const db = getDB();
  const upsert = db.prepare(
    'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP'
  );

  const allowed = [
    'restaurant_name', 'tagline', 'founded', 'address', 'phone',
    'hours', 'website', 'bot_greeting', 'bot_personality', 'custom_instructions',
  ];

  const updateMany = db.transaction(updates => {
    for (const [key, value] of Object.entries(updates)) {
      if (allowed.includes(key)) upsert.run(key, String(value));
    }
  });

  updateMany(req.body);
  const rows = db.prepare('SELECT key, value FROM settings ORDER BY key').all();
  res.json(Object.fromEntries(rows.map(r => [r.key, r.value])));
});

// ── System Prompt Preview ─────────────────────────────────────────────────────

router.get('/system-prompt', authenticateToken, (req, res) => {
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

  const prompt = `You are the friendly virtual assistant for ${s.restaurant_name}...
[Personality: ${s.bot_personality}]

MENU:
${menuText}

FAQs: ${faqs.length} entries loaded
${s.custom_instructions ? `\nCustom Instructions:\n${s.custom_instructions}` : ''}`;

  res.json({ prompt, stats: { menuItems: menuItems.length, faqs: faqs.length } });
});

// ── Chat History ──────────────────────────────────────────────────────────────

router.get('/chat-history', authenticateToken, (req, res) => {
  const db = getDB();
  const sessions = db
    .prepare(
      `SELECT session_id,
              COUNT(*) as message_count,
              MIN(created_at) as started_at,
              MAX(created_at) as last_at
       FROM chat_messages
       GROUP BY session_id
       ORDER BY last_at DESC
       LIMIT 50`
    )
    .all();
  res.json(sessions);
});

router.get('/chat-history/:sessionId', authenticateToken, (req, res) => {
  const db = getDB();
  const messages = db
    .prepare('SELECT role, content, created_at FROM chat_messages WHERE session_id = ? ORDER BY created_at')
    .all(req.params.sessionId);
  res.json(messages);
});

module.exports = router;
