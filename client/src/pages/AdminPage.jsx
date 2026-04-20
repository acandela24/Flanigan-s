import { useState, useEffect, useCallback } from 'react';

// ─── API helpers ──────────────────────────────────────────────────────────────

function authHeaders(token) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

async function apiCall(url, options) {
  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);
  return <div className={`toast ${type}`}>{message}</div>;
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────

function ConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <h2 style={{ marginBottom: 12 }}>Confirm Delete</h2>
        <p style={{ color: 'var(--gray-dark)', marginBottom: 24, fontSize: 14 }}>{message}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn btn-danger" onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  );
}

// ─── Menu Manager ─────────────────────────────────────────────────────────────

const CATEGORIES = ['Appetizers', 'Burgers & Sandwiches', 'Seafood', 'Entrees', 'Sides', 'Salads', 'Desserts', 'Drinks', 'Main'];

function MenuItemModal({ item, onSave, onClose }) {
  const [form, setForm] = useState({
    category: item?.category || 'Main',
    name: item?.name || '',
    description: item?.description || '',
    ingredients: item?.ingredients || '',
    recipe: item?.recipe || '',
    price: item?.price || '',
    active: item?.active !== 0,
  });
  const [saving, setSaving] = useState(false);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const setCheck = k => e => setForm(f => ({ ...f, [k]: e.target.checked }));

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>{item ? 'Edit Menu Item' : 'Add Menu Item'}</h2>
        <form onSubmit={submit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Item Name *</label>
              <input value={form.name} onChange={set('name')} placeholder="e.g. Classic Cheeseburger" required />
            </div>
            <div className="form-group">
              <label>Category</label>
              <select value={form.category} onChange={set('category')}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Price (optional)</label>
              <input value={form.price} onChange={set('price')} placeholder="e.g. 14.99" />
            </div>
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea value={form.description} onChange={set('description')} rows={2} placeholder="What makes this dish great..." />
          </div>
          <div className="form-group">
            <label>Ingredients</label>
            <textarea value={form.ingredients} onChange={set('ingredients')} rows={2} placeholder="List the main ingredients..." />
          </div>
          <div className="form-group">
            <label>Recipe / Prep Notes</label>
            <textarea value={form.recipe} onChange={set('recipe')} rows={3} placeholder="How it's prepared..." />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <input type="checkbox" id="active" checked={form.active} onChange={setCheck('active')} style={{ width: 16, height: 16, accentColor: 'var(--green-primary)' }} />
            <label htmlFor="active" style={{ fontSize: 14, color: 'var(--gray-dark)', cursor: 'pointer', margin: 0 }}>
              Active (visible to chatbot)
            </label>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : (item ? 'Save Changes' : 'Add Item')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MenuTab({ token, showToast }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    apiCall('/api/admin/menu', { headers: authHeaders(token) })
      .then(setItems)
      .catch(e => showToast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, [token, showToast]);

  useEffect(() => { load(); }, [load]);

  async function saveItem(form) {
    if (modal?.item) {
      await apiCall(`/api/admin/menu/${modal.item.id}`, {
        method: 'PUT', headers: authHeaders(token), body: JSON.stringify(form),
      });
      showToast('Menu item updated!', 'success');
    } else {
      await apiCall('/api/admin/menu', {
        method: 'POST', headers: authHeaders(token), body: JSON.stringify(form),
      });
      showToast('Menu item added!', 'success');
    }
    load();
  }

  async function deleteItem(id) {
    try {
      await apiCall(`/api/admin/menu/${id}`, { method: 'DELETE', headers: authHeaders(token) });
      showToast('Deleted successfully', 'success');
      load();
    } catch (e) {
      showToast(e.message, 'error');
    }
    setConfirm(null);
  }

  const grouped = items.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 22, color: 'var(--green-dark)', fontWeight: 700 }}>Menu Items</h2>
          <p style={{ fontSize: 13, color: 'var(--gray-medium)', marginTop: 2 }}>The chatbot uses this data to answer menu questions</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal({ item: null })}>+ Add Item</button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--gray-medium)' }}>Loading…</div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--gray-medium)' }}>No menu items yet. Add your first one!</div>
      ) : (
        Object.entries(grouped).map(([category, categoryItems]) => (
          <div key={category} style={{ marginBottom: 28 }}>
            <h3 style={{
              fontSize: 13, fontWeight: 700, color: 'var(--green-medium)',
              textTransform: 'uppercase', letterSpacing: '1px',
              marginBottom: 10, paddingBottom: 8, borderBottom: '2px solid var(--green-light)',
            }}>{category}</h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Description</th>
                    <th>Price</th>
                    <th>Status</th>
                    <th style={{ width: 100 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryItems.map(item => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 600 }}>{item.name}</td>
                      <td style={{ maxWidth: 280, color: 'var(--gray-dark)', fontSize: 13 }}>
                        {item.description ? item.description.substring(0, 80) + (item.description.length > 80 ? '…' : '') : '—'}
                      </td>
                      <td>{item.price ? `$${item.price}` : '—'}</td>
                      <td><span className={`badge badge-${item.active ? 'active' : 'inactive'}`}>{item.active ? 'Active' : 'Hidden'}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => setModal({ item })}>Edit</button>
                          <button className="btn btn-danger" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => setConfirm(item.id)}>Del</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}

      {modal && <MenuItemModal item={modal.item} onSave={saveItem} onClose={() => setModal(null)} />}
      {confirm && (
        <ConfirmModal
          message="Are you sure you want to delete this menu item? This cannot be undone."
          onConfirm={() => deleteItem(confirm)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

// ─── FAQ Manager ──────────────────────────────────────────────────────────────

function FAQModal({ faq, onSave, onClose }) {
  const [form, setForm] = useState({ question: faq?.question || '', answer: faq?.answer || '', active: faq?.active !== 0 });
  const [saving, setSaving] = useState(false);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try { await onSave(form); onClose(); } finally { setSaving(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>{faq ? 'Edit FAQ' : 'Add FAQ'}</h2>
        <form onSubmit={submit}>
          <div className="form-group">
            <label>Question *</label>
            <input value={form.question} onChange={set('question')} placeholder="e.g. Do you have happy hour?" required />
          </div>
          <div className="form-group">
            <label>Answer *</label>
            <textarea value={form.answer} onChange={set('answer')} rows={4} placeholder="Write a friendly, helpful answer..." required />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <input type="checkbox" id="faqActive" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} style={{ width: 16, height: 16, accentColor: 'var(--green-primary)' }} />
            <label htmlFor="faqActive" style={{ fontSize: 14, color: 'var(--gray-dark)', cursor: 'pointer', margin: 0 }}>Active</label>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : (faq ? 'Save Changes' : 'Add FAQ')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FAQTab({ token, showToast }) {
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    apiCall('/api/admin/faqs', { headers: authHeaders(token) })
      .then(setFaqs)
      .catch(e => showToast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, [token, showToast]);

  useEffect(() => { load(); }, [load]);

  async function saveFAQ(form) {
    if (modal?.faq) {
      await apiCall(`/api/admin/faqs/${modal.faq.id}`, { method: 'PUT', headers: authHeaders(token), body: JSON.stringify(form) });
      showToast('FAQ updated!', 'success');
    } else {
      await apiCall('/api/admin/faqs', { method: 'POST', headers: authHeaders(token), body: JSON.stringify(form) });
      showToast('FAQ added!', 'success');
    }
    load();
  }

  async function deleteFAQ(id) {
    try {
      await apiCall(`/api/admin/faqs/${id}`, { method: 'DELETE', headers: authHeaders(token) });
      showToast('Deleted', 'success');
      load();
    } catch (e) { showToast(e.message, 'error'); }
    setConfirm(null);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 22, color: 'var(--green-dark)', fontWeight: 700 }}>FAQs</h2>
          <p style={{ fontSize: 13, color: 'var(--gray-medium)', marginTop: 2 }}>Pre-written answers the chatbot references for common questions</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal({ faq: null })}>+ Add FAQ</button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--gray-medium)' }}>Loading…</div>
      ) : faqs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--gray-medium)' }}>No FAQs yet.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '35%' }}>Question</th>
                <th>Answer</th>
                <th style={{ width: 80 }}>Status</th>
                <th style={{ width: 100 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {faqs.map(faq => (
                <tr key={faq.id}>
                  <td style={{ fontWeight: 600, fontSize: 13 }}>{faq.question}</td>
                  <td style={{ fontSize: 13, color: 'var(--gray-dark)' }}>
                    {faq.answer.substring(0, 100)}{faq.answer.length > 100 ? '…' : ''}
                  </td>
                  <td><span className={`badge badge-${faq.active ? 'active' : 'inactive'}`}>{faq.active ? 'On' : 'Off'}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => setModal({ faq })}>Edit</button>
                      <button className="btn btn-danger" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => setConfirm(faq.id)}>Del</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && <FAQModal faq={modal.faq} onSave={saveFAQ} onClose={() => setModal(null)} />}
      {confirm && (
        <ConfirmModal
          message="Delete this FAQ? The chatbot won't be able to reference it anymore."
          onConfirm={() => deleteFAQ(confirm)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

function SettingsTab({ token, showToast }) {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiCall('/api/admin/settings', { headers: authHeaders(token) })
      .then(setSettings)
      .catch(e => showToast(e.message, 'error'));
  }, [token, showToast]);

  async function saveSettings(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await apiCall('/api/admin/settings', {
        method: 'PUT', headers: authHeaders(token), body: JSON.stringify(settings),
      });
      setSettings(updated);
      showToast('Settings saved!', 'success');
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  if (!settings) return <div style={{ textAlign: 'center', padding: 40, color: 'var(--gray-medium)' }}>Loading…</div>;

  const set = k => e => setSettings(s => ({ ...s, [k]: e.target.value }));

  return (
    <div>
      <h2 style={{ fontSize: 22, color: 'var(--green-dark)', fontWeight: 700, marginBottom: 4 }}>Settings</h2>
      <p style={{ fontSize: 13, color: 'var(--gray-medium)', marginBottom: 24 }}>Configure restaurant info and chatbot behavior</p>

      <form onSubmit={saveSettings}>
        <div style={{ display: 'grid', gap: 24 }}>
          {/* Restaurant Info */}
          <div style={{ background: 'white', borderRadius: 'var(--radius-md)', padding: 24, border: '1px solid var(--green-light)', boxShadow: 'var(--shadow-sm)' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--green-dark)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              🏪 Restaurant Information
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Restaurant Name</label>
                <input value={settings.restaurant_name || ''} onChange={set('restaurant_name')} />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Tagline</label>
                <input value={settings.tagline || ''} onChange={set('tagline')} />
              </div>
              <div className="form-group">
                <label>Founded Year</label>
                <input value={settings.founded || ''} onChange={set('founded')} />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input value={settings.phone || ''} onChange={set('phone')} />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Address / Locations</label>
                <textarea value={settings.address || ''} onChange={set('address')} rows={2} />
              </div>
              <div className="form-group">
                <label>Hours</label>
                <textarea value={settings.hours || ''} onChange={set('hours')} rows={3} />
              </div>
              <div className="form-group">
                <label>Website</label>
                <input value={settings.website || ''} onChange={set('website')} />
              </div>
            </div>
          </div>

          {/* Chatbot Behavior */}
          <div style={{ background: 'white', borderRadius: 'var(--radius-md)', padding: 24, border: '1px solid var(--green-light)', boxShadow: 'var(--shadow-sm)' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--green-dark)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              🤖 Chatbot Behavior
            </h3>
            <div className="form-group">
              <label>Greeting Message</label>
              <textarea value={settings.bot_greeting || ''} onChange={set('bot_greeting')} rows={3} placeholder="What the chatbot says first to every visitor" />
            </div>
            <div className="form-group">
              <label>Personality / Tone</label>
              <textarea value={settings.bot_personality || ''} onChange={set('bot_personality')} rows={4} placeholder="Describe how the chatbot should speak and act..." />
            </div>
            <div className="form-group">
              <label>Custom Instructions</label>
              <textarea value={settings.custom_instructions || ''} onChange={set('custom_instructions')} rows={4} placeholder="Any additional rules or info for the chatbot... (e.g. 'Always mention we have a happy hour', 'Never discuss competitors')" />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
          <button type="submit" className="btn btn-primary" disabled={saving} style={{ padding: '11px 28px', fontSize: 15 }}>
            {saving ? 'Saving…' : '💾 Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── System Prompt Preview ────────────────────────────────────────────────────

function PreviewTab({ token, showToast }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    apiCall('/api/admin/system-prompt', { headers: authHeaders(token) })
      .then(setData)
      .catch(e => showToast(e.message, 'error'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 22, color: 'var(--green-dark)', fontWeight: 700 }}>System Prompt Preview</h2>
          <p style={{ fontSize: 13, color: 'var(--gray-medium)', marginTop: 2 }}>This is what the AI "knows" based on your current settings</p>
        </div>
        <button className="btn btn-secondary" onClick={load}>↻ Refresh</button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--gray-medium)' }}>Loading…</div>
      ) : data && (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div style={{ background: 'var(--green-light)', borderRadius: 'var(--radius-sm)', padding: '8px 16px', display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 18 }}>🍽️</span>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--green-dark)' }}>{data.stats.menuItems}</div>
                <div style={{ fontSize: 11, color: 'var(--green-medium)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Menu Items</div>
              </div>
            </div>
            <div style={{ background: 'var(--green-light)', borderRadius: 'var(--radius-sm)', padding: '8px 16px', display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 18 }}>❓</span>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--green-dark)' }}>{data.stats.faqs}</div>
                <div style={{ fontSize: 11, color: 'var(--green-medium)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>FAQs</div>
              </div>
            </div>
          </div>
          <pre style={{
            background: '#1C1C1C',
            color: '#A5D6A7',
            padding: 20,
            borderRadius: 'var(--radius-md)',
            fontSize: 13,
            lineHeight: 1.7,
            overflowX: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            border: '1px solid #333',
          }}>
            {data.prompt}
          </pre>
        </>
      )}
    </div>
  );
}

// ─── Change Password ──────────────────────────────────────────────────────────

function ChangePasswordModal({ token, onClose, showToast }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    if (form.newPassword !== form.confirm) { showToast('New passwords do not match', 'error'); return; }
    setSaving(true);
    try {
      await apiCall('/api/admin/change-password', {
        method: 'POST', headers: authHeaders(token),
        body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }),
      });
      showToast('Password changed successfully!', 'success');
      onClose();
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <h2>Change Password</h2>
        <form onSubmit={submit}>
          <div className="form-group">
            <label>Current Password</label>
            <input type="password" value={form.currentPassword} onChange={set('currentPassword')} required />
          </div>
          <div className="form-group">
            <label>New Password</label>
            <input type="password" value={form.newPassword} onChange={set('newPassword')} required minLength={8} />
          </div>
          <div className="form-group">
            <label>Confirm New Password</label>
            <input type="password" value={form.confirm} onChange={set('confirm')} required />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Change Password'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Login Page ───────────────────────────────────────────────────────────────

function LoginPage({ onLogin }) {
  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await apiCall('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      onLogin(data.token, data.username);
    } catch (e) {
      setError(e.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #1B5E20 0%, #2E7D32 50%, #1B5E20 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      fontFamily: 'var(--font-body)',
    }}>
      {/* decorative circles */}
      <div style={{ position: 'fixed', top: -80, right: -80, width: 300, height: 300, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: -60, left: -60, width: 240, height: 240, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />

      <div style={{
        background: 'white',
        borderRadius: 20,
        padding: '40px 36px',
        width: '100%',
        maxWidth: 400,
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'linear-gradient(135deg, #1B5E20, #43A047)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 36, margin: '0 auto 16px',
            boxShadow: '0 4px 16px rgba(46,125,50,0.4)',
          }}>🐟</div>
          <div style={{ fontFamily: 'var(--font-brand)', fontSize: 32, color: 'var(--green-dark)', lineHeight: 1 }}>Flanigan's</div>
          <div style={{ fontSize: 13, color: 'var(--gray-medium)', marginTop: 4, letterSpacing: '1px', textTransform: 'uppercase' }}>Admin Dashboard</div>
        </div>

        {error && (
          <div style={{
            background: 'var(--red-light)', color: 'var(--red-accent)',
            padding: '10px 14px', borderRadius: 'var(--radius-sm)',
            fontSize: 13, marginBottom: 16, border: '1px solid #FFCDD2',
          }}>
            {error}
          </div>
        )}

        <form onSubmit={submit}>
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              placeholder="admin"
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder="••••••••"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              background: loading ? '#C8E6C9' : 'linear-gradient(135deg, #2E7D32, #43A047)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontSize: 15,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: 8,
              fontFamily: 'var(--font-body)',
              boxShadow: loading ? 'none' : '0 3px 10px rgba(46,125,50,0.35)',
              transition: 'all 0.2s',
            }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: 'var(--gray-medium)' }}>
          <a href="/" style={{ color: 'var(--green-medium)', textDecoration: 'none' }}>← Back to Chat</a>
        </p>
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'menu', label: '🍽️ Menu', title: 'Menu' },
  { id: 'faqs', label: '❓ FAQs', title: 'FAQs' },
  { id: 'settings', label: '⚙️ Settings', title: 'Settings' },
  { id: 'preview', label: '🔍 AI Preview', title: 'AI Preview' },
];

function Dashboard({ token, username, onLogout }) {
  const [tab, setTab] = useState('menu');
  const [toast, setToast] = useState(null);
  const [showChangePw, setShowChangePw] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type, key: Date.now() });
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', fontFamily: 'var(--font-body)' }}>
      {/* Top navbar */}
      <div style={{
        background: 'linear-gradient(135deg, #1B5E20, #2E7D32)',
        padding: '0 24px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{
          maxWidth: 1100, margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          height: 60,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 22 }}>🐟</span>
            <div>
              <span style={{ fontFamily: 'var(--font-brand)', fontSize: 20, color: 'white' }}>Flanigan's</span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginLeft: 8 }}>Admin</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 14px',
                background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: 'var(--radius-full)',
                color: 'white', fontSize: 13, fontWeight: 500,
                cursor: 'pointer', fontFamily: 'var(--font-body)',
              }}
            >
              👤 {username} ▾
            </button>
            {menuOpen && (
              <div style={{
                position: 'absolute', top: '110%', right: 0,
                background: 'white', borderRadius: 'var(--radius-sm)',
                boxShadow: 'var(--shadow-lg)', minWidth: 180,
                border: '1px solid var(--gray-light)', overflow: 'hidden',
              }}>
                <a href="/" target="_blank" style={{ display: 'block', padding: '11px 16px', color: 'var(--dark)', textDecoration: 'none', fontSize: 13, borderBottom: '1px solid var(--gray-light)' }}
                  onMouseOver={e => e.target.style.background = 'var(--green-pale)'}
                  onMouseOut={e => e.target.style.background = 'white'}
                >
                  🐟 View Chat →
                </a>
                <button onClick={() => { setShowChangePw(true); setMenuOpen(false); }}
                  style={{ display: 'block', width: '100%', padding: '11px 16px', color: 'var(--dark)', background: 'none', border: 'none', textAlign: 'left', fontSize: 13, cursor: 'pointer', borderBottom: '1px solid var(--gray-light)', fontFamily: 'var(--font-body)' }}
                  onMouseOver={e => e.target.style.background = 'var(--green-pale)'}
                  onMouseOut={e => e.target.style.background = 'none'}
                >
                  🔑 Change Password
                </button>
                <button onClick={onLogout}
                  style={{ display: 'block', width: '100%', padding: '11px 16px', color: 'var(--red-accent)', background: 'none', border: 'none', textAlign: 'left', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)' }}
                  onMouseOver={e => e.target.style.background = 'var(--red-light)'}
                  onMouseOut={e => e.target.style.background = 'none'}
                >
                  🚪 Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{
        background: 'white',
        borderBottom: '1px solid var(--gray-light)',
        padding: '0 24px',
        boxShadow: 'var(--shadow-sm)',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', gap: 4 }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '14px 18px',
                background: 'none',
                border: 'none',
                borderBottom: tab === t.id ? '3px solid var(--green-primary)' : '3px solid transparent',
                color: tab === t.id ? 'var(--green-primary)' : 'var(--gray-medium)',
                fontWeight: tab === t.id ? 700 : 500,
                fontSize: 14,
                cursor: 'pointer',
                transition: 'all 0.15s',
                fontFamily: 'var(--font-body)',
                whiteSpace: 'nowrap',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px' }}>
        {tab === 'menu' && <MenuTab token={token} showToast={showToast} />}
        {tab === 'faqs' && <FAQTab token={token} showToast={showToast} />}
        {tab === 'settings' && <SettingsTab token={token} showToast={showToast} />}
        {tab === 'preview' && <PreviewTab token={token} showToast={showToast} />}
      </div>

      {toast && <Toast key={toast.key} message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {showChangePw && <ChangePasswordModal token={token} onClose={() => setShowChangePw(false)} showToast={showToast} />}
      {menuOpen && <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setMenuOpen(false)} />}
    </div>
  );
}

// ─── Admin Page Root ──────────────────────────────────────────────────────────

const TOKEN_KEY = 'flanigans_admin_token';
const USER_KEY  = 'flanigans_admin_user';

export default function AdminPage() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [username, setUsername] = useState(() => localStorage.getItem(USER_KEY) || '');

  function handleLogin(t, u) {
    localStorage.setItem(TOKEN_KEY, t);
    localStorage.setItem(USER_KEY, u);
    setToken(t);
    setUsername(u);
  }

  function handleLogout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUsername('');
  }

  if (!token) return <LoginPage onLogin={handleLogin} />;
  return <Dashboard token={token} username={username} onLogout={handleLogout} />;
}
