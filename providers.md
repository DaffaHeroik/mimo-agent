# Free AI Provider Config (Auto-generated 2026-08-09)

## Blackbox.ai (20 Working Models)
API Base: https://api.blackbox.ai/v1
Format: OpenAI-compatible

### Working Models:
| Model | Provider | Type |
|-------|----------|------|
| blackboxai/openai/gpt-nemotron | OpenAI/Nvidia | Chat |
| blackboxai/anthropic/claude-nemotron | Anthropic/Nvidia | Chat |
| blackboxai/google/gemma-4-31b-it | Google | Chat |
| blackboxai/google/gemma-4-26b-a4b-it | Google | Chat |
| blackboxai/google/gemini-3.5-flash | Google | Chat |
| blackboxai/google/gemini-3.1-flash-lite | Google | Chat |
| blackboxai/deepseek/deepseek-v4-pro | DeepSeek | Chat |
| blackboxai/x-ai/grok-4.3 | xAI | Chat |
| blackboxai/x-ai/grok-4.1-fast-non-reasoning | xAI | Chat |
| blackboxai/x-ai/grok-build-0.1 | xAI | Chat |
| blackboxai/mistral/mistral-medium-3.5 | Mistral | Chat |
| blackboxai/mistral/mistral-small | Mistral | Chat |
| blackboxai/mistral/devstral-2 | Mistral | Code |
| blackboxai/nvidia/nemotron-3-ultra | Nvidia | Chat |
| blackboxai/nvidia/nemotron-3-super-120b-a12b:free | Nvidia | Chat (FREE) |
| blackboxai/nvidia/nemotron-3-nano-30b-a3b | Nvidia | Chat |
| blackboxai/nvidia/nemotron-nano-12b-v2-vl | Nvidia | Vision |
| blackboxai/morph/morph-v3-fast | Morph | Chat |
| blackboxai/morph/morph-v3-large | Morph | Chat |
| blackboxai/amazon/nova-2-lite | Amazon | Chat |

### API Keys (rotate on rate limit):
1. sk-yOfkp958vNdU61PzVfxwKA
2. sk-HLg6gIhXvjhmJYWwKQl6xA
3. sk-qZTrPU4_V4HHTmtNc0717Q
4. sk-_5IFp74-UlnNG6LGdZXnBg
5. sk-Y6vVBGkcsv8JmmMvbAf3JA

## Ollama Cloud (6 API Keys)
API Base: https://ollama.com/api/chat
Format: Custom (not OpenAI-compatible)

### Working Models:
- gpt-oss:20b
- gpt-oss:120b
- gemma4:31b

### API Keys:
1. lestari1@bozztirex.us → 766953ffda6e402f84f4a7affd9eaa47
2. lestari3@bozztirex.us → 775ee4f9a5aa4751bbe69c095d9d6f97
3. lestari4@bozztirex.us → bbb3ce8f139245c1b6e4510d0e16a704
4. lestari5@bozztirex.us → 9943e039d07c45a5afca7c6f243af5a8
5. lestari7@bozztirex.us → a7d6f92f088549c2804888593f612cbb
6. lestari8@bozztirex.us → 0c0811afa73046d1bc29b1fccbe008e7

## TokenHarbor (21+ Models)
API Base: https://tokenharbor.ai/v1/chat/completions
Format: OpenAI-compatible
Auth: Authorization: Bearer thk_live_***
Invite: TH-653T-4B6A ($5 free credit per account)

### Working Models:
| Model | Provider | Type |
|-------|----------|------|
| deepseek-v4-flash | DeepSeek | Chat |
| deepseek-v4-pro | DeepSeek | Chat |
| claude-sonnet-5 | Anthropic | Chat |
| claude-opus-5 | Anthropic | Chat |
| claude-fable-5 | Anthropic | Chat |
| gpt-5.6-terra | OpenAI | Chat |
| gpt-5.6-sol | OpenAI | Chat |
| gpt-5.6-luna | OpenAI | Chat |
| gemini-3.6-flash | Google | Chat |
| gemini-3.1-pro-preview | Google | Chat |
| grok-4.5 | xAI | Chat |
| kimi-k3 | Moonshot | Chat |
| mimo-v2.5-pro | Xiaomi | Chat |
| mimo-v2.5 | Xiaomi | Chat |
| glm-5.2 | Zhipu | Chat |
| minimax-m3 | MiniMax | Chat |
| qwen3.8-max | Alibaba | Chat |
| deepseek-v4-flash:free | DeepSeek | FREE |
| kimi-k3:free | Moonshot | FREE |
| mimo-v2.5:free | Xiaomi | FREE |
| th-orchestra | TokenHarbor | Router |

### Registration Flow:
1. Create mail.tm account FIRST (api.mail.tm/accounts)
2. Get JWT token (api.mail.tm/token)
3. Register at tokenharbor.ai/login?invite=TH-653T-4B6A
4. Verify email via mail.tm inbox
5. Claim $5 gift, create API key

### Free Models Note:
Free models require consent toggle on dashboard.
API call returns `free_models_disabled` error if not enabled.
Enable via dashboard → "Enable free models" button.

## Usage Example (Blackbox.ai):
```bash
curl https://api.blackbox.ai/v1/chat/completions \
  -H "Authorization: Bearer sk-***" \
  -H "Content-Type: application/json" \
  -d '{"model":"blackboxai/mistral/codestral","messages":[{"role":"user","content":"Hello"}]}'
```

## Usage Example (TokenHarbor):
```bash
curl https://tokenharbor.ai/v1/chat/completions \
  -H "Authorization: Bearer thk_live_***" \
  -H "Content-Type: application/json" \
  -d '{"model":"deepseek-v4-flash","messages":[{"role":"user","content":"Hello"}]}'
```
