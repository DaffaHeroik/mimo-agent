const http = require('http');
const https = require('https');

const PORT = 7860;
const MANUS_API_KEY = process.env.MANUS_API_KEY || '';
const MANUS_BASE = 'https://api.manus.ai/v2';
const DEFAULT_TASK = 'agent-default-main_task';

function manusRequest(endpoint, body = null, method = 'POST') {
  return new Promise((resolve, reject) => {
    const url = new URL(`${MANUS_BASE}/${endpoint}`);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-manus-api-key': MANUS_API_KEY,
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({ raw: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function sendMessageAndWait(prompt, maxWait = 30000) {
  const beforeTs = Date.now();

  // Send message
  const sendRes = await manusRequest('task.sendMessage', {
    task_id: DEFAULT_TASK,
    message: { content: prompt }
  });
  if (!sendRes.ok) return { error: sendRes.error || 'Send failed' };

  // Poll for response
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    await new Promise(r => setTimeout(r, 2500));
    const listRes = await manusRequest(`task.listMessages?task_id=${DEFAULT_TASK}&order=desc&limit=5`, null, 'GET');
    if (listRes.ok && listRes.messages) {
      for (const msg of listRes.messages) {
        if (msg.type === 'assistant_message' && msg.assistant_message?.content) {
          const msgTs = parseInt(msg.timestamp);
          if (msgTs > beforeTs) {
            return { content: msg.assistant_message.content };
          }
        }
      }
    }
  }
  return { error: 'Timeout' };
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve({}); }
    });
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  if (url.pathname === '/v1/models') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      object: 'list',
      data: [
        { id: 'manus-1.6', object: 'model', owned_by: 'manus' },
        { id: 'manus-1.6-lite', object: 'model', owned_by: 'manus' },
      ]
    }));
    return;
  }

  if (url.pathname === '/v1/chat/completions' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const messages = body.messages || [];
      const lastMsg = messages[messages.length - 1];
      const prompt = lastMsg?.content || '';

      console.log(`[REQ] ${prompt.substring(0, 60)}...`);
      const result = await sendMessageAndWait(prompt);

      if (result.error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: result.error }));
        return;
      }

      console.log(`[RES] ${result.content.substring(0, 60)}...`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: body.model || 'manus-1.6',
        choices: [{ index: 0, message: { role: 'assistant', content: result.content }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`✅ Manus OpenAI Wrapper → http://localhost:${PORT}`);
  console.log(`   POST /v1/chat/completions`);
  console.log(`   GET  /v1/models`);
});
