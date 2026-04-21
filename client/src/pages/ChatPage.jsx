import { useState, useEffect, useRef } from 'react';

const STORAGE_KEY = 'flanigans_session_id';

function BotAvatar() {
  return (
    <div style={{
      width: 36, height: 36, borderRadius: '50%',
      background: 'white',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
      overflow: 'hidden', padding: 3,
    }}>
      <img
        src="/flanigans-logo.png"
        alt="Flanigan's"
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        onError={e => {
          e.target.style.display = 'none';
          e.target.parentElement.style.background = 'linear-gradient(135deg, #2E7D32, #43A047)';
          e.target.parentElement.innerHTML = '<span style="color:white;font-family:Luckiest Guy,cursive;font-size:15px;font-weight:400">F</span>';
        }}
      />
    </div>
  );
}

function Message({ msg }) {
  const isBot = msg.role === 'assistant';
  const isTyping = msg.typing;

  return (
    <div style={{
      display: 'flex',
      flexDirection: isBot ? 'row' : 'row-reverse',
      alignItems: 'flex-end',
      gap: 10,
      marginBottom: 16,
      padding: '0 4px',
    }}>
      {isBot && <BotAvatar />}

      <div style={{ maxWidth: '75%', display: 'flex', flexDirection: 'column', alignItems: isBot ? 'flex-start' : 'flex-end' }}>
        <div style={{
          padding: isTyping ? '12px 16px' : '12px 16px',
          borderRadius: isBot ? '18px 18px 18px 4px' : '18px 18px 4px 18px',
          background: isBot ? 'white' : 'linear-gradient(135deg, #2E7D32, #388E3C)',
          color: isBot ? '#1C1C1C' : 'white',
          fontSize: 14.5,
          lineHeight: 1.55,
          boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
          border: isBot ? '1px solid #E8F5E9' : 'none',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          {isTyping ? (
            <div className="typing-dots">
              <div className="typing-dot" />
              <div className="typing-dot" />
              <div className="typing-dot" />
            </div>
          ) : msg.content}
        </div>
        {msg.time && (
          <span style={{ fontSize: 11, color: '#9E9E9E', marginTop: 4, padding: '0 4px' }}>
            {msg.time}
          </span>
        )}
      </div>
    </div>
  );
}

export default function ChatPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(() => localStorage.getItem(STORAGE_KEY) || null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    fetch('/api/chat/greeting')
      .then(r => r.json())
      .then(data => {
        setMessages([{
          id: 1,
          role: 'assistant',
          content: data.greeting,
          time: formatTime(new Date()),
        }]);
      })
      .catch(() => {
        setMessages([{
          id: 1,
          role: 'assistant',
          content: "Hey there, welcome to Flanigan's! How can I help ya today?",
          time: formatTime(new Date()),
        }]);
      });
  }, []);

  function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  async function sendMessage(e) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    setInput('');
    const now = new Date();

    setMessages(prev => [...prev, {
      id: Date.now(),
      role: 'user',
      content: text,
      time: formatTime(now),
    }]);

    setLoading(true);
    const typingId = Date.now() + 1;
    setMessages(prev => [...prev, { id: typingId, role: 'assistant', typing: true }]);

    try {
      const res = await fetch('/api/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId }),
      });
      const data = await res.json();

      if (data.sessionId && data.sessionId !== sessionId) {
        setSessionId(data.sessionId);
        localStorage.setItem(STORAGE_KEY, data.sessionId);
      }

      setMessages(prev => prev.map(m =>
        m.id === typingId
          ? { ...m, typing: false, content: data.reply || data.error, time: formatTime(new Date()) }
          : m
      ));
    } catch {
      setMessages(prev => prev.map(m =>
        m.id === typingId
          ? { ...m, typing: false, content: "Oops! Something went wrong on my end. Give me a sec and try again!", time: formatTime(new Date()) }
          : m
      ));
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const suggestions = [
    "Do the ribs contain sesame?",
    "What are the deals?",
    "Are the fries cooked in seed oils?",
  ];

  return (
    <div style={{
      height: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      background: '#1B5E20',
      fontFamily: 'var(--font-body)',
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1B5E20 0%, #2E7D32 60%, #388E3C 100%)',
        padding: '0 20px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
        flexShrink: 0,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* decorative wave */}
        <div style={{
          position: 'absolute', bottom: -1, left: 0, right: 0, height: 8,
          background: 'rgba(255,255,255,0.08)',
          clipPath: 'ellipse(55% 100% at 50% 100%)',
        }} />

        <div style={{
          maxWidth: 720, margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <img
              src="/flanigans-logo.png"
              alt="Flanigan's"
              style={{
                height: 72,
                display: 'block',
                objectFit: 'contain',
                filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.4)) brightness(1.08) contrast(1.1)',
              }}
              onError={e => {
                e.target.style.display = 'none';
                e.target.insertAdjacentHTML('afterend', '<span style="font-family:Luckiest Guy,cursive;font-size:30px;color:white;letter-spacing:1px;text-shadow:0 2px 6px rgba(0,0,0,0.4)">FLANIGAN\'S</span>');
              }}
            />
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', letterSpacing: '1px', textTransform: 'uppercase', lineHeight: 1.6 }}>
              Seafood Bar &amp; Grill<br />Since 1959
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%', background: '#A5D6A7',
              boxShadow: '0 0 6px #A5D6A7',
            }} />
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>Online</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '20px 16px',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{ maxWidth: 720, width: '100%', margin: '0 auto', flex: 1 }}>
          {messages.map(msg => (
            <Message key={msg.id} msg={msg} />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Quick suggestions — only show if just the greeting */}
      {messages.length === 1 && (
        <div style={{
          padding: '0 16px 12px',
          display: 'flex', flexWrap: 'wrap', gap: 8,
          justifyContent: 'center',
          maxWidth: 720, margin: '0 auto', width: '100%',
        }}>
          {suggestions.map(s => (
            <button
              key={s}
              onClick={() => { setInput(s); inputRef.current?.focus(); }}
              style={{
                padding: '7px 14px',
                borderRadius: 'var(--radius-full)',
                background: 'white',
                border: '1.5px solid #C8E6C9',
                color: '#2E7D32',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s',
                fontFamily: 'var(--font-body)',
              }}
              onMouseOver={e => { e.target.style.background = '#E8F5E9'; e.target.style.borderColor = '#2E7D32'; }}
              onMouseOut={e => { e.target.style.background = 'white'; e.target.style.borderColor = '#C8E6C9'; }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{
        background: 'white',
        borderTop: '1px solid #E8F5E9',
        padding: '14px 16px',
        boxShadow: '0 -2px 10px rgba(0,0,0,0.06)',
        flexShrink: 0,
      }}>
        <form
          onSubmit={sendMessage}
          style={{
            maxWidth: 720, margin: '0 auto',
            display: 'flex', gap: 10, alignItems: 'flex-end',
          }}
        >
          <div style={{ flex: 1, position: 'relative' }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me anything about Flanigan's..."
              rows={1}
              style={{
                width: '100%',
                padding: '11px 16px',
                border: '1.5px solid #C8E6C9',
                borderRadius: 24,
                fontSize: 14.5,
                background: '#FAFFFE',
                resize: 'none',
                lineHeight: 1.5,
                maxHeight: 120,
                overflowY: 'auto',
                fontFamily: 'var(--font-body)',
                transition: 'border-color 0.2s',
                display: 'block',
              }}
              onFocus={e => { e.target.style.borderColor = '#43A047'; e.target.style.boxShadow = '0 0 0 3px rgba(67,160,71,0.12)'; }}
              onBlur={e => { e.target.style.borderColor = '#C8E6C9'; e.target.style.boxShadow = 'none'; }}
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || loading}
            style={{
              width: 46, height: 46, borderRadius: '50%',
              background: input.trim() && !loading
                ? 'linear-gradient(135deg, #2E7D32, #43A047)'
                : '#C8E6C9',
              color: 'white',
              fontSize: 20,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
              flexShrink: 0,
              boxShadow: input.trim() && !loading ? '0 3px 8px rgba(46,125,50,0.4)' : 'none',
            }}
          >
            ➤
          </button>
        </form>
        <p style={{
          textAlign: 'center', fontSize: 11, color: '#BDBDBD',
          marginTop: 8, fontFamily: 'var(--font-body)',
        }}>
          Powered by AI · <a href="/admin" style={{ color: '#9E9E9E', textDecoration: 'none' }}>Staff Login</a>
        </p>
      </div>
    </div>
  );
}
