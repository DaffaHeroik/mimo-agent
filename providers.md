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

## Usage Example (Blackbox.ai):
```bash
curl https://api.blackbox.ai/v1/chat/completions \
  -H "Authorization: Bearer sk-yOfkp958vNdU61PzVfxwKA" \
  -H "Content-Type: application/json" \
  -d '{"model":"blackboxai/mistral/codestral","messages":[{"role":"user","content":"Hello"}]}'
```
