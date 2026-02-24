# Configuração Final do Agente de Voz

## Stack Validado ✅

| Componente | Escolha | Config |
|------------|---------|--------|
| Telefonia | Twilio | +55 11 5028-6439 |
| Orquestração | Vapi | - |
| STT | Deepgram Nova-2 | language: pt-BR |
| LLM | GPT-4o | - |
| TTS | ElevenLabs | voiceId: 6dHxv8ke5peKaO9xM46v |
| Voz | Multilingual v2 | language: pt, speed: 1.15 |

## IDs Importantes

- **Phone Number ID:** 75e41e30-fd74-4aa4-8195-9dfdf33a41b2
- **Assistant Prospecção ID:** 39846316-c264-48dd-9170-b59b8f4d8d36

## Aprendizados

1. **Não usar transcriber "multi"** - usar "pt-BR" específico
2. **GPT-4o > Claude** para voz (menos repetição)
3. **Prompt curto e numerado** funciona melhor que prompt longo
4. **Regra de "não repetir" no início do prompt** é essencial
5. **Speed 1.15** é bom para voz brasileira natural
