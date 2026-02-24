# Sistema de Aprendizado Contínuo

## Objetivo
Melhorar a taxa de conversão analisando o que funciona e o que não funciona nas ligações.

---

## 1. Dados a Coletar por Ligação

```json
{
  "id": "uuid",
  "timestamp": "2026-02-01T10:30:00Z",
  "prospect": {
    "nome": "João Silva",
    "empresa": "Empresa X",
    "segmento": "Serviços",
    "cargo": "Dono"
  },
  "ligacao": {
    "duracao_segundos": 180,
    "atendeu": true,
    "fase_maxima": "proposta_reuniao",
    "resultado": "agendou" // atendeu | desligou | nao_interesse | nao_icp | agendou | callback
  },
  "qualificacao": {
    "usa_sistemas": false,
    "dono_na_operacao": true,
    "dor_identificada": "tempo_gasto_em_controles",
    "eh_icp": true
  },
  "objecoes": ["nao_tenho_tempo", "me_manda_email"],
  "transcricao_completa": "...",
  "notas": "Interessado mas viajando essa semana"
}
```

---

## 2. Métricas de Acompanhamento

### Por Período (diário/semanal)
| Métrica | Cálculo |
|---------|---------|
| Taxa de atendimento | Atendeu / Total de ligações |
| Taxa de conversa | Passou da abertura / Atendeu |
| Taxa de ICP | É ICP / Passou da abertura |
| Taxa de agendamento | Agendou / É ICP |
| Duração média | Média de segundos por ligação |

### Por Variável
- **Por segmento:** Qual converte mais?
- **Por horário:** Manhã vs tarde?
- **Por dia da semana:** Qual o melhor?
- **Por abertura usada:** Qual script funciona melhor?
- **Por objeção:** Qual tratamento converte mais?

---

## 3. Análise de Padrões

### O que buscar nas transcrições:

**Ligações que CONVERTERAM:**
- Quais palavras/frases o agente usou?
- Como tratou objeções?
- Qual foi o gatilho que virou a conversa?
- Quanto tempo em cada fase?

**Ligações que NÃO CONVERTERAM:**
- Em qual momento perdeu?
- Qual objeção não conseguiu tratar?
- O prospect era ICP mas não agendou — por quê?
- Houve algum erro de tom/abordagem?

---

## 4. Ciclo de Melhoria

```
┌─────────────────────────────────────────────────────────┐
│  1. COLETAR                                             │
│     Gravar + transcrever todas as ligações              │
└────────────────────────┬────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────┐
│  2. ANALISAR (semanal)                                  │
│     - Revisar métricas                                  │
│     - Identificar padrões em conversões/perdas          │
│     - Comparar variações de script                      │
└────────────────────────┬────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────┐
│  3. HIPÓTESE                                            │
│     "Se mudarmos X, a taxa de Y vai melhorar"           │
└────────────────────────┬────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────┐
│  4. TESTAR (A/B)                                        │
│     - Rodar versão A e versão B em paralelo             │
│     - Mínimo 50 ligações por versão                     │
└────────────────────────┬────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────┐
│  5. IMPLEMENTAR                                         │
│     - Versão vencedora vira o novo padrão               │
│     - Atualizar ROTEIRO.md                              │
└─────────────────────────────────────────────────────────┘
```

---

## 5. Testes A/B Prioritários

### Semana 1-2: Abertura
- **Variante A:** Abertura atual (focada em crescimento)
- **Variante B:** Abertura focada em dor ("empresas que estão perdendo tempo com...")

### Semana 3-4: Tratamento de "não tenho tempo"
- **Variante A:** Abordagem atual
- **Variante B:** Oferecer ligar em outro horário imediatamente

### Semana 5-6: Proposta de reunião
- **Variante A:** "Diagnóstico sem compromisso"
- **Variante B:** "15 minutos pra mostrar um caso do seu segmento"

---

## 6. Feedback Loop com LLM

Após cada batch de 100 ligações, alimentar o modelo com:

```
PROMPT DE ANÁLISE:
"Analise estas [N] transcrições de ligações de prospecção.

Contexto:
- Objetivo: agendar reunião de apresentação
- ICP: empresa média, sem sistemas, dono na operação

Ligações que converteram: [IDs]
Ligações que não converteram: [IDs]

Identifique:
1. Padrões de linguagem que correlacionam com conversão
2. Momentos críticos onde perdemos o prospect
3. Objeções mal tratadas e sugestões de melhoria
4. Ajustes recomendados no roteiro

Formato: lista de ações concretas priorizadas por impacto esperado."
```

---

## 7. Evolução do Prompt do Agente

O agente de voz terá um prompt base + contexto dinâmico:

```
[PROMPT BASE]
Você é um consultor da Labrego IA fazendo uma ligação de prospecção.
Seu objetivo é agendar uma reunião de apresentação.
Siga o roteiro, mas adapte naturalmente à conversa.

[CONTEXTO DO PROSPECT]
Nome: {nome}
Empresa: {empresa}
Segmento: {segmento}
Info prévia: {info_coletada}

[APRENDIZADOS RECENTES]
- Quando prospect menciona "Excel", aprofundar: "Quantas planilhas vocês têm hoje?"
- Objeção "me manda email" funciona melhor com: "Claro, mas me conta uma dor rapidinho..."
- Evitar mencionar "IA" na abertura — deixar pra depois se perguntar

[ROTEIRO]
{roteiro_atual}
```

---

## 8. Dashboard de Acompanhamento

Visualizar em tempo real:
- Ligações hoje / meta
- Taxa de conversão (rolling 7 dias)
- Melhores horários
- Objeções mais frequentes
- Tendência de melhoria
