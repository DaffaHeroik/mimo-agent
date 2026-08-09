#!/usr/bin/env node
/**
 * Blackbox.ai API Model Tester
 * Tests all available text/chat models and reports which ones work.
 */

const KEYS = [
  'sk-yOfkp958vNdU61PzVfxwKA',
  'sk-HLg6gIhXvjhmJYWwKQl6xA',
  'sk-qZTrPU4_V4HHTmtNc0717Q',
  'sk-_5IFp74-UlnNG6LGdZXnBg',
  'sk-Y6vVBGkcsv8JmmMvbAf3JA',
];

const BASE = 'https://api.blackbox.ai/v1';
let keyIndex = 0;

function nextKey() {
  const key = KEYS[keyIndex % KEYS.length];
  keyIndex++;
  return key;
}

async function fetchWithTimeout(url, opts, timeoutMs = 20000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    clearTimeout(timer);
    return res;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

async function listModels() {
  const res = await fetchWithTimeout(`${BASE}/models`, {
    headers: { 'Authorization': `Bearer ${nextKey()}` },
  });
  const data = await res.json();
  return (data.data || []).map(m => m.id);
}

async function testModel(modelId) {
  const key = nextKey();
  try {
    const res = await fetchWithTimeout(`${BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: 'Say hello in 5 words or less' }],
        max_tokens: 50,
      }),
    }, 25000);

    const data = await res.json();
    if (data.error) {
      return { ok: false, error: data.error.message || JSON.stringify(data.error) };
    }
    const content = data.choices?.[0]?.message?.content;
    if (content && content.trim().length > 0) {
      return { ok: true, response: content.trim().substring(0, 100) };
    }
    return { ok: false, error: 'Empty response' };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// Focus on text/chat models only
const SKIP_PATTERNS = [
  'flux-', 'stable-diffusion', 'imagen-', 'veo-', 'sora-', 'seedream',
  'dreamshaper', 'playground', 'recraft', 'ideogram', 'bria/', 'sana',
  'photon', 'hidream', 'wan-', 'mochi', 'animatediff', 'svd', 'cogvideo',
  'hunyuan-video', 'ray-', 'nano-banana', 'edit/', 'image-01',
];

const PRIORITY_MODELS = [
  'blackboxai/openai/gpt-5.5',
  'blackboxai/openai/gpt-5.5-pro',
  'blackboxai/openai/gpt-5.4',
  'blackboxai/openai/gpt-5.4-pro',
  'blackboxai/openai/gpt-5.4-nano',
  'blackboxai/openai/gpt-5.3-codex',
  'blackboxai/openai/gpt-oss-120b',
  'blackboxai/openai/gpt-nemotron',
  'blackboxai/anthropic/claude-sonnet-4.6',
  'blackboxai/anthropic/claude-opus-4.6',
  'blackboxai/anthropic/claude-sonnet-4.5',
  'blackboxai/anthropic/claude-opus-4.7',
  'blackboxai/anthropic/claude-nemotron',
  'blackboxai/anthropic/claude-fable-5',
  'blackboxai/google/gemma-4-31b-it',
  'blackboxai/google/gemma-4-26b-a4b-it',
  'blackboxai/google/gemini-3.5-flash',
  'blackboxai/google/gemini-3.1-flash-lite',
  'blackboxai/deepseek/deepseek-v4-pro',
  'blackboxai/deepseek/deepseek-v4-flash',
  'blackboxai/x-ai/grok-4.3',
  'blackboxai/x-ai/grok-4.1-fast-non-reasoning',
  'blackboxai/x-ai/grok-code-fast-1:free',
  'blackboxai/mistral/codestral',
  'blackboxai/mistral/mistral-medium-3.5',
  'blackboxai/mistral/mistral-small',
  'blackboxai/mistral/devstral-2',
  'blackboxai/moonshotai/kimi-k3',
  'blackboxai/moonshotai/kimi-k2.7-code',
  'z-ai/glm-5.2',
  'blackboxai/minimax/minimax-m3',
  'blackboxai/minimax/minimax-m2.5',
  'blackboxai/nvidia/nemotron-3-ultra',
  'blackboxai/nvidia/nemotron-3-super-120b-a12b:free',
  'blackboxai/blackbox-pro',
  'blackboxai/morph/morph-v3-fast',
  'blackboxai/morph/morph-v3-large',
  'blackboxai/arcee-ai/trinity-large-thinking',
];

async function main() {
  console.log('🔍 Fetching model list...');
  let allModels;
  try {
    allModels = await listModels();
  } catch (e) {
    console.log('Failed to list models:', e.message);
    allModels = PRIORITY_MODELS;
  }

  // Filter to text/chat models
  const chatModels = allModels.filter(id => {
    if (SKIP_PATTERNS.some(p => id.toLowerCase().includes(p))) return false;
    if (id.includes('/edit') || id.includes('/edit/')) return false;
    return true;
  });

  // Merge priority models
  const testSet = new Set([...PRIORITY_MODELS, ...chatModels]);
  const testModels = [...testSet].slice(0, 50); // Cap at 50

  console.log(`\n📋 Testing ${testModels.length} models...\n`);

  const working = [];
  const failed = [];

  for (let i = 0; i < testModels.length; i++) {
    const model = testModels[i];
    process.stdout.write(`  [${i + 1}/${testModels.length}] ${model.substring(0, 50).padEnd(50)} `);
    const result = await testModel(model);
    if (result.ok) {
      console.log(`✅ ${result.response}`);
      working.push({ model, response: result.response });
    } else {
      console.log(`❌ ${result.error.substring(0, 60)}`);
      failed.push({ model, error: result.error });
    }
    // Small delay to avoid rate limits
    await new Promise(r => setTimeout(r, 500));
  }

  // Print report
  console.log('\n' + '='.repeat(70));
  console.log('📊 RESULTS');
  console.log('='.repeat(70));

  console.log(`\n✅ Working Models (${working.length}):`);
  const byProvider = {};
  for (const { model } of working) {
    const parts = model.split('/');
    const provider = parts.length > 1 ? parts[1] || parts[0] : parts[0];
    if (!byProvider[provider]) byProvider[provider] = [];
    byProvider[provider].push(model);
  }
  for (const [provider, models] of Object.entries(byProvider).sort()) {
    console.log(`\n  ${provider}:`);
    for (const m of models) console.log(`    - ${m}`);
  }

  console.log(`\n❌ Failed Models (${failed.length}):`);
  for (const { model, error } of failed) {
    console.log(`  - ${model}: ${error.substring(0, 80)}`);
  }

  console.log('\n' + '='.repeat(70));
}

main().catch(console.error);
