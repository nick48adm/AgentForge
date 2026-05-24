import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET — Returns the embeddable widget JS snippet
export async function GET(req: NextRequest, { params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params

  const agent = await db.agent.findUnique({
    where: { id: agentId },
    select: { name: true, description: true, status: true, avatar: true },
  })

  if (!agent || agent.status !== 'published') {
    return new NextResponse('// Agent not found or not published', {
      status: 404,
      headers: { 'Content-Type': 'application/javascript' },
    })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const agentName = agent.name.replace(/'/g, "\\'")

  // Upsert widget channel record
  await db.channel.upsert({
    where: { agentId_type: { agentId, type: 'widget' } },
    create: { agentId, type: 'widget', config: JSON.stringify({ agentName }), isActive: true },
    update: { isActive: true },
  }).catch(() => {})

  // Self-contained embeddable widget (no framework dependencies)
  const js = `
(function() {
  if (window.__agentforge_${agentId.replace(/-/g,'_')}) return;
  window.__agentforge_${agentId.replace(/-/g,'_')} = true;

  const APP_URL = '${appUrl}';
  const AGENT_ID = '${agentId}';
  const AGENT_NAME = '${agentName}';

  const style = document.createElement('style');
  style.textContent = \`
    #af-widget-btn {
      position:fixed; bottom:24px; right:24px; z-index:9998;
      width:56px; height:56px; border-radius:50%; background:#10b981;
      border:none; cursor:pointer; box-shadow:0 4px 16px rgba(0,0,0,0.2);
      display:flex; align-items:center; justify-content:center; transition:transform .2s;
    }
    #af-widget-btn:hover { transform:scale(1.1); }
    #af-widget-btn svg { width:26px; height:26px; fill:white; }
    #af-widget-box {
      position:fixed; bottom:92px; right:24px; z-index:9999;
      width:360px; height:520px; border-radius:16px; overflow:hidden;
      box-shadow:0 8px 32px rgba(0,0,0,0.18); display:none; flex-direction:column;
      background:#fff; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    }
    #af-widget-box.open { display:flex; }
    #af-widget-header {
      background:#10b981; color:#fff; padding:14px 16px;
      font-weight:600; font-size:15px; display:flex; align-items:center; gap:10px;
    }
    #af-widget-header span { flex:1; }
    #af-widget-header button { background:none; border:none; color:#fff; cursor:pointer; font-size:20px; line-height:1; }
    #af-widget-msgs {
      flex:1; overflow-y:auto; padding:14px; display:flex; flex-direction:column; gap:10px;
      background:#f8fafc;
    }
    .af-msg { max-width:80%; padding:10px 14px; border-radius:12px; font-size:14px; line-height:1.5; }
    .af-msg.user { align-self:flex-end; background:#10b981; color:#fff; border-bottom-right-radius:4px; }
    .af-msg.bot { align-self:flex-start; background:#fff; color:#111; border:1px solid #e5e7eb; border-bottom-left-radius:4px; }
    .af-msg.bot.typing { color:#9ca3af; font-style:italic; }
    #af-widget-input-row {
      display:flex; padding:10px; gap:8px; border-top:1px solid #e5e7eb; background:#fff;
    }
    #af-widget-input {
      flex:1; border:1px solid #e5e7eb; border-radius:8px; padding:8px 12px;
      font-size:14px; outline:none; resize:none;
    }
    #af-widget-input:focus { border-color:#10b981; }
    #af-widget-send {
      background:#10b981; color:#fff; border:none; border-radius:8px;
      padding:8px 14px; cursor:pointer; font-size:14px; font-weight:600;
    }
    #af-widget-send:disabled { opacity:0.5; cursor:not-allowed; }
    @media (max-width:480px) {
      #af-widget-box { width:calc(100vw - 16px); right:8px; bottom:80px; height:70vh; }
    }
  \`;
  document.head.appendChild(style);

  // Build UI
  const btn = document.createElement('button');
  btn.id = 'af-widget-btn';
  btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>';

  const box = document.createElement('div');
  box.id = 'af-widget-box';
  box.innerHTML = \`
    <div id="af-widget-header">
      <svg width="20" height="20" fill="white" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
      <span>\${AGENT_NAME}</span>
      <button id="af-close-btn">&times;</button>
    </div>
    <div id="af-widget-msgs"></div>
    <div id="af-widget-input-row">
      <textarea id="af-widget-input" rows="1" placeholder="Type a message…"></textarea>
      <button id="af-widget-send">Send</button>
    </div>
  \`;

  document.body.appendChild(btn);
  document.body.appendChild(box);

  const msgs = document.getElementById('af-widget-msgs');
  const input = document.getElementById('af-widget-input');
  const sendBtn = document.getElementById('af-widget-send');
  let conversationId = null;
  let widgetUserId = 'widget-' + Math.random().toString(36).slice(2);

  function addMsg(role, text) {
    const el = document.createElement('div');
    el.className = 'af-msg ' + role;
    el.textContent = text;
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
    return el;
  }

  async function sendMessage() {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    sendBtn.disabled = true;
    addMsg('user', text);
    const typing = addMsg('bot typing', '…');

    try {
      const res = await fetch(APP_URL + '/api/channels/widget/' + AGENT_ID + '/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, conversationId, userId: widgetUserId }),
      });
      const data = await res.json();
      if (data.conversationId) conversationId = data.conversationId;
      typing.remove();
      addMsg('bot', data.content || data.error || 'No response');
    } catch(e) {
      typing.remove();
      addMsg('bot', 'Connection error. Please try again.');
    } finally {
      sendBtn.disabled = false;
      input.focus();
    }
  }

  btn.onclick = () => box.classList.toggle('open');
  document.getElementById('af-close-btn').onclick = () => box.classList.remove('open');
  sendBtn.onclick = sendMessage;
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });

  // Greeting
  setTimeout(() => addMsg('bot', 'Hi! I\\'m ' + AGENT_NAME + '. How can I help you?'), 500);
})();
`.trim()

  return new NextResponse(js, {
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
