# Agente de Prospecção Ativa - Labrego IA

## Visão Geral
Agente de voz que faz ligações de prospecção via Twilio, conversa em tempo real com prospects e agenda reuniões de apresentação.

## ICP (Perfil Ideal de Cliente)
- **Porte:** Médio
- **Maturidade digital:** Sem sistemas estruturados (usa Excel, WhatsApp, controles manuais)
- **Momento:** Em crescimento
- **Decisor:** Dono ainda participa ativamente da operação
- **Dor principal:** Precisando contratar mais gente pra dar conta da operação

## Proposta de Valor
> "Escale sua operação sem aumentar o time. Automatize tarefas repetitivas e cresça com os recursos que você já tem."

## Produtos que Resolvem
1. **Automação de Processos** - Elimina tarefas manuais/repetitivas
2. **Sistemas de Gestão Integrados** - Unifica operações em uma plataforma só
3. **Agentes Virtuais com IA** - Atendimento 24/7 sem contratar

## Objetivo da Ligação
**Marcar uma reunião de apresentação** (não vender na ligação)

## Arquitetura Técnica
```
[Twilio Voice] → [Speech-to-Text] → [LLM (roteiro + contexto)] → [TTS] → [Twilio Voice]
                                              ↓
                                    [Logging + Analytics]
                                              ↓
                                    [Aprendizado contínuo]
```

## Métricas de Sucesso
- Taxa de atendimento
- Taxa de conversa completa (não desligou antes)
- Taxa de qualificação (é ICP?)
- Taxa de agendamento (reunião marcada)
- Conversão final (após reunião)
