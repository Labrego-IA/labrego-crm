const express = require('express');
const { google } = require('googleapis');
const path = require('path');
const cron = require('node-cron');
require('dotenv').config();

const app = express();
app.use(express.json());

// Configuração Google Calendar
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'lucas.santos@labregoia.com.br';
const SCOPES = ['https://www.googleapis.com/auth/calendar'];

// Configuração CRM
const CRM_BASE_URL = process.env.CRM_BASE_URL;
const CRM_WEBHOOK_SECRET = process.env.CRM_WEBHOOK_SECRET;

// Configuração Vapi
const VAPI_API_KEY = process.env.VAPI_API_KEY;
const VAPI_ASSISTANT_ID = '39846316-c264-48dd-9170-b59b8f4d8d36';
const VAPI_PHONE_NUMBER_ID = '75e41e30-fd74-4aa4-8195-9dfdf33a41b2';

// Configuração OpenAI
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Configuração Twilio WhatsApp
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const REPORT_WHATSAPP_NUMBER = process.env.REPORT_WHATSAPP_NUMBER || '+5511991108378';

// ========== TRACKING DE LIGAÇÕES DO DIA ==========
let dailyCallsTracker = {
  date: null,
  batchId: null,
  started: 0,
  callIds: new Set(),
  results: {
    atendeu: 0,
    naoAtendeu: 0,
    etapas: {} // { 'REUNIAO_BRIEFING': 2, 'SEM_INTERESSE': 3, ... }
  },
  prospects: [] // Lista de nomes/resultados
};

// Resetar tracker para novo dia/batch
function resetDailyTracker() {
  const today = new Date().toISOString().split('T')[0];
  dailyCallsTracker = {
    date: today,
    batchId: Date.now(),
    started: 0,
    callIds: new Set(),
    results: {
      atendeu: 0,
      naoAtendeu: 0,
      etapas: {}
    },
    prospects: []
  };
}

// Registrar ligação iniciada
function trackCallStarted(callId, prospectName) {
  dailyCallsTracker.callIds.add(callId);
  dailyCallsTracker.started++;
  dailyCallsTracker.prospects.push({ 
    callId, 
    name: prospectName, 
    status: 'pendente',
    etapa: null 
  });
}

// Registrar resultado da ligação
function trackCallResult(callId, atendeu, etapaFinal, prospectName) {
  if (atendeu) {
    dailyCallsTracker.results.atendeu++;
  } else {
    dailyCallsTracker.results.naoAtendeu++;
  }
  
  if (etapaFinal) {
    dailyCallsTracker.results.etapas[etapaFinal] = 
      (dailyCallsTracker.results.etapas[etapaFinal] || 0) + 1;
  }
  
  // Atualizar prospect na lista
  const prospect = dailyCallsTracker.prospects.find(p => p.callId === callId);
  if (prospect) {
    prospect.status = atendeu ? 'atendeu' : 'não atendeu';
    prospect.etapa = etapaFinal;
  }
  
  // Remover callId do Set de pendentes
  dailyCallsTracker.callIds.delete(callId);
  
  // Verificar se todas as ligações terminaram
  checkAndSendReport();
}

// Verificar se deve enviar relatório
function checkAndSendReport() {
  const pendentes = dailyCallsTracker.callIds.size;
  const total = dailyCallsTracker.started;
  const finalizadas = dailyCallsTracker.results.atendeu + dailyCallsTracker.results.naoAtendeu;
  
  console.log(`📊 Progresso: ${finalizadas}/${total} (${pendentes} pendentes)`);
  
  // Enviar relatório quando todas terminarem
  if (total > 0 && pendentes === 0 && finalizadas === total) {
    setTimeout(() => sendDailyReport(), 5000); // Pequeno delay para garantir
  }
}

// Enviar relatório via WhatsApp
async function sendDailyReport() {
  const { date, results, prospects, started } = dailyCallsTracker;
  
  if (started === 0) {
    console.log('📭 Nenhuma ligação para reportar');
    return;
  }
  
  // Mapear nomes das etapas
  const etapaNomes = {
    'REUNIAO_BRIEFING': '📅 Reunião agendada',
    'ENVIAR_APRESENTACAO': '📧 Enviar apresentação',
    'SEM_INTERESSE': '❌ Sem interesse',
    'TELEFONE_INDISPONIVEL': '📵 Telefone indisponível'
  };
  
  // Montar mensagem
  let msg = `📊 *RESUMO PROSPECÇÃO - ${date}*\n\n`;
  msg += `📞 *Total de ligações:* ${started}\n`;
  msg += `✅ *Atenderam:* ${results.atendeu}\n`;
  msg += `❌ *Não atenderam:* ${results.naoAtendeu}\n\n`;
  
  if (results.atendeu > 0) {
    msg += `*Resultados dos que atenderam:*\n`;
    for (const [etapa, count] of Object.entries(results.etapas)) {
      const nome = etapaNomes[etapa] || etapa;
      msg += `  ${nome}: ${count}\n`;
    }
  }
  
  // Detalhes por prospect
  msg += `\n*Detalhes:*\n`;
  for (const p of prospects.slice(0, 20)) { // Limitar a 20 para não ficar muito longo
    const emoji = p.status === 'atendeu' ? '✅' : '❌';
    const etapa = p.etapa ? ` → ${etapaNomes[p.etapa] || p.etapa}` : '';
    msg += `${emoji} ${p.name}${etapa}\n`;
  }
  
  if (prospects.length > 20) {
    msg += `... e mais ${prospects.length - 20} ligações\n`;
  }
  
  console.log('\n📱 Enviando relatório via WhatsApp...');
  console.log(msg);
  
  try {
    await sendWhatsAppMessage(REPORT_WHATSAPP_NUMBER, msg);
    console.log('✅ Relatório enviado com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao enviar relatório:', error.message);
  }
}

// Enviar mensagem via Twilio WhatsApp
async function sendWhatsAppMessage(to, message) {
  const formattedTo = to.replace(/\D/g, '');
  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  
  const params = new URLSearchParams();
  params.append('From', `whatsapp:${TWILIO_PHONE_NUMBER}`);
  params.append('To', `whatsapp:+${formattedTo}`);
  params.append('Body', message);
  
  const response = await fetch(twilioUrl, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Twilio error: ${response.status} - ${error}`);
  }
  
  return response.json();
}

// Classificar resultado da ligação usando IA
async function classifyCallResult(summary, endedReason) {
  if (!OPENAI_API_KEY) {
    console.log('OPENAI_API_KEY não configurada, usando classificação simples');
    return classifyCallResultSimple(summary, endedReason);
  }
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'system',
          content: `Você é um classificador de resultados de ligações de vendas. Com base no resumo da ligação, classifique em UMA das categorias:

1. TELEFONE_INDISPONIVEL - Não conseguiu falar (caixa postal, não atendeu, linha ocupada, ligação caiu, mensagens como "entrego o seu recado", "deixe sua mensagem após o sinal")
2. REUNIAO_AGENDADA - Cliente aceitou agendar reunião/conversa/demo
3. ENVIAR_EMAIL - Cliente pediu para enviar material/proposta por email
4. SEM_INTERESSE - Cliente disse que não tem interesse, não é prioridade, ou recusou

Responda APENAS com uma dessas palavras: TELEFONE_INDISPONIVEL, REUNIAO_AGENDADA, ENVIAR_EMAIL, SEM_INTERESSE`
        }, {
          role: 'user',
          content: `Motivo do encerramento: ${endedReason}\n\nResumo da ligação:\n${summary}`
        }],
        temperature: 0,
        max_tokens: 50,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI error: ${response.status}`);
    }
    
    const data = await response.json();
    const classification = data.choices[0]?.message?.content?.trim().toUpperCase();
    
    console.log('Classificação IA:', classification);
    return classification;
  } catch (error) {
    console.error('Erro na classificação IA:', error.message);
    return classifyCallResultSimple(summary, endedReason);
  }
}

// Classificação simples (fallback)
function classifyCallResultSimple(summary, endedReason) {
  const summaryLower = (summary || '').toLowerCase();
  
  // Verificar se não conseguiu falar (incluindo caixa postal)
  if (['voicemail', 'no-answer', 'busy', 'failed', 'pipeline-error'].includes(endedReason) ||
      summaryLower.includes('caixa postal') || 
      summaryLower.includes('voicemail') ||
      summaryLower.includes('não atendeu') ||
      summaryLower.includes('ligação caiu') ||
      summaryLower.includes('entrego o seu recado') ||
      summaryLower.includes('deixe sua mensagem') ||
      summaryLower.includes('leave a message') ||
      summaryLower.includes('telefone estiver disponível')) {
    return 'TELEFONE_INDISPONIVEL';
  }
  
  // Verificar se agendou
  if (summaryLower.includes('agendou') || 
      summaryLower.includes('agendada') ||
      summaryLower.includes('agendamento') ||
      summaryLower.includes('marcou reunião') ||
      summaryLower.includes('confirmou horário')) {
    return 'REUNIAO_AGENDADA';
  }
  
  // Verificar se pediu email
  if (summaryLower.includes('enviar por email') || 
      summaryLower.includes('manda por email') ||
      summaryLower.includes('envia material')) {
    return 'ENVIAR_EMAIL';
  }
  
  return 'SEM_INTERESSE';
}

// Helper: Saudação baseada no horário (São Paulo)
function getGreeting() {
  const hour = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false });
  const h = parseInt(hour);
  if (h >= 5 && h < 12) return 'Bom dia';
  if (h >= 12 && h < 18) return 'Boa tarde';
  return 'Boa noite';
}

// Helper: Data de hoje formatada para o prompt (São Paulo)
function getTodayFormatted() {
  const now = new Date();
  const options = { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric',
    timeZone: 'America/Sao_Paulo'
  };
  return now.toLocaleDateString('pt-BR', options);
}

// Helper: Formatar telefone
function formatPhone(phone) {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.startsWith('55')) return '+' + digits;
  if (digits.length === 11 || digits.length === 10) return '+55' + digits;
  return '+55' + digits;
}

// Disparar uma ligação via Vapi
async function makeCall(prospect) {
  const greeting = getGreeting();
  const firstName = (prospect.name || '').split(' ')[0];
  const todayDate = getTodayFormatted();
  
  const response = await fetch('https://api.vapi.ai/call/phone', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VAPI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      assistantId: VAPI_ASSISTANT_ID,
      phoneNumberId: VAPI_PHONE_NUMBER_ID,
      customer: { number: formatPhone(prospect.phone) },
      assistantOverrides: {
        variableValues: {
          greeting,
          todayDate,
          prospectName: firstName,
          prospectCompany: prospect.company || 'sua empresa',
          prospectIndustry: prospect.industry || 'seu setor',
        },
        metadata: {
          clientId: prospect.id,
          prospectName: prospect.name,
          prospectCompany: prospect.company || '',
        },
      },
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Vapi error: ${response.status} - ${error}`);
  }
  
  return response.json();
}

// Autenticação com OAuth2 (cria eventos como o usuário real)
async function getCalendarClient() {
  console.log('[CALENDAR] Iniciando autenticação com Google Calendar...');
  
  // Prioridade: OAuth2 > Service Account
  if (process.env.GOOGLE_OAUTH_REFRESH_TOKEN) {
    console.log('[CALENDAR] Usando OAuth2 (eventos criados como lucas.santos@labregoia.com.br)');
    
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_OAUTH_CLIENT_ID,
      process.env.GOOGLE_OAUTH_CLIENT_SECRET
    );
    
    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN
    });
    
    console.log('[CALENDAR] OAuth2 configurado. Calendar ID:', CALENDAR_ID);
    return google.calendar({ version: 'v3', auth: oauth2Client });
  }
  
  // Fallback: Service Account
  let auth;
  if (process.env.GOOGLE_CREDENTIALS) {
    console.log('[CALENDAR] Usando Service Account via GOOGLE_CREDENTIALS');
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    auth = new google.auth.GoogleAuth({
      credentials,
      scopes: SCOPES,
    });
  } else {
    const keyFile = process.env.GOOGLE_CREDENTIALS_PATH || '.google-credentials.json';
    console.log('[CALENDAR] Usando Service Account via arquivo:', keyFile);
    auth = new google.auth.GoogleAuth({
      keyFile,
      scopes: SCOPES,
    });
  }

  console.log('[CALENDAR] Autenticação configurada. Calendar ID:', CALENDAR_ID);
  return google.calendar({ version: 'v3', auth });
}

// Helper: criar data em São Paulo
function createSaoPauloDate(year, month, day, hour = 0, minute = 0) {
  // São Paulo é UTC-3 (sem horário de verão desde 2019)
  const date = new Date(Date.UTC(year, month, day, hour + 3, minute, 0, 0));
  return date;
}

// Helper: obter data atual em São Paulo
function getNowInSaoPaulo() {
  const now = new Date();
  // Converter para string em São Paulo e parsear de volta
  const spString = now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
  return new Date(spString);
}

// Buscar horários disponíveis
async function getAvailableSlots(daysAhead = 7) {
  console.log('[CALENDAR] ========== BUSCANDO HORÁRIOS DISPONÍVEIS ==========');
  console.log('[CALENDAR] Dias à frente:', daysAhead);

  const calendar = await getCalendarClient();

  const now = new Date();
  const nowSP = getNowInSaoPaulo();
  const timeMin = now.toISOString();
  const timeMax = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000).toISOString();

  console.log('[CALENDAR] Agora em São Paulo:', nowSP.toLocaleString('pt-BR'));
  console.log('[CALENDAR] Período de busca:', timeMin, 'até', timeMax);

  // Buscar eventos existentes
  console.log('[CALENDAR] Buscando eventos existentes no Google Calendar...');
  const response = await calendar.events.list({
    calendarId: CALENDAR_ID,
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: 'startTime',
  });

  console.log('[CALENDAR] Eventos encontrados:', response.data.items?.length || 0);
  if (response.data.items?.length > 0) {
    response.data.items.forEach((event, i) => {
      console.log(`[CALENDAR]   ${i + 1}. ${event.summary} - ${event.start?.dateTime || event.start?.date}`);
    });
  }

  const busySlots = response.data.items.map(event => ({
    start: new Date(event.start.dateTime || event.start.date),
    end: new Date(event.end.dateTime || event.end.date),
  }));

  // Gerar slots disponíveis (horário comercial: 9h-18h em São Paulo)
  const availableSlots = [];
  const workStart = 9; // 9h São Paulo
  const workEnd = 18; // 18h São Paulo
  const slotDuration = 30; // 30 minutos

  // Começar de amanhã (d = 1) para evitar confusão com "hoje"
  for (let d = 1; d < daysAhead; d++) {
    const targetDate = new Date(nowSP);
    targetDate.setDate(targetDate.getDate() + d);

    // Pular fins de semana
    if (targetDate.getDay() === 0 || targetDate.getDay() === 6) continue;

    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();
    const day = targetDate.getDate();

    // Gerar slots do dia (em horário de São Paulo)
    for (let hour = workStart; hour < workEnd; hour++) {
      for (let min = 0; min < 60; min += slotDuration) {
        // Criar slot em horário de São Paulo (UTC-3)
        const slotStart = createSaoPauloDate(year, month, day, hour, min);
        const slotEnd = new Date(slotStart.getTime() + slotDuration * 60 * 1000);

        // Verificar se o slot está no passado
        if (slotStart < now) continue;

        // Verificar se conflita com algum evento
        const isBusy = busySlots.some(busy =>
          (slotStart >= busy.start && slotStart < busy.end) ||
          (slotEnd > busy.start && slotEnd <= busy.end)
        );

        if (!isBusy) {
          availableSlots.push({
            start: slotStart.toISOString(),
            end: slotEnd.toISOString(),
            formatted: formatSlot(slotStart),
          });
        }
      }
    }
  }

  console.log('[CALENDAR] Total de slots disponíveis gerados:', availableSlots.length);
  if (availableSlots.length > 0) {
    console.log('[CALENDAR] Primeiros 5 slots:', availableSlots.slice(0, 5).map(s => s.formatted).join(', '));
  }
  console.log('[CALENDAR] ========== FIM BUSCA DE HORÁRIOS ==========');

  return availableSlots;
}

// Formatar slot para fala (TTS-friendly, natural)
function formatSlot(date) {
  const dias = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  
  // Converter para horário de São Paulo
  const spDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  
  const diaSemana = dias[spDate.getDay()];
  const diaMes = spDate.getDate();
  const hora = spDate.getHours();
  const minutos = spDate.getMinutes();
  
  const horaFormatada = minutos === 0 ? `${hora} horas` : `${hora} e ${minutos}`;
  
  return `${diaSemana} dia ${diaMes} às ${horaFormatada}`;
}

// Criar evento no calendário
async function createMeeting(startTime, prospectName, prospectCompany, prospectPhone, prospectEmail) {
  console.log('[CALENDAR] ========== CRIANDO REUNIÃO ==========');
  console.log('[CALENDAR] Dados recebidos:');
  console.log('[CALENDAR]   - startTime:', startTime);
  console.log('[CALENDAR]   - prospectName:', prospectName);
  console.log('[CALENDAR]   - prospectCompany:', prospectCompany);
  console.log('[CALENDAR]   - prospectPhone:', prospectPhone);
  console.log('[CALENDAR]   - prospectEmail:', prospectEmail);

  const calendar = await getCalendarClient();

  const start = new Date(startTime);
  const end = new Date(start.getTime() + 30 * 60 * 1000); // 30 minutos

  const event = {
    summary: `Reunião Labrego IA - ${prospectCompany}`,
    description: `Reunião de apresentação com ${prospectName} da ${prospectCompany}\nTelefone: ${prospectPhone}`,
    start: {
      dateTime: start.toISOString(),
      timeZone: 'America/Sao_Paulo',
    },
    end: {
      dateTime: end.toISOString(),
      timeZone: 'America/Sao_Paulo',
    },
    // Adicionar participantes para enviar convite
    attendees: prospectEmail ? [
      { email: prospectEmail, displayName: prospectName }
    ] : [],
  };

  console.log('[CALENDAR] Evento a ser criado:', JSON.stringify(event, null, 2));
  console.log('[CALENDAR] Inserindo evento no Google Calendar...');

  const response = await calendar.events.insert({
    calendarId: CALENDAR_ID,
    resource: event,
    sendUpdates: prospectEmail ? 'all' : 'none', // Envia convite se tiver email
  });

  console.log('[CALENDAR] Evento criado com sucesso!');
  console.log('[CALENDAR]   - Event ID:', response.data.id);
  console.log('[CALENDAR]   - HTML Link:', response.data.htmlLink);
  console.log('[CALENDAR]   - Convite enviado:', prospectEmail ? 'Sim' : 'Não (sem email)');
  console.log('[CALENDAR] ========== FIM CRIAÇÃO DE REUNIÃO ==========');

  return response.data;
}

// ========== CRM FUNCTIONS ==========

// Buscar prospects para prospecção ativa
async function getActiveProspects(limit = 50) {
  const url = new URL(CRM_BASE_URL);
  url.searchParams.set('funnelStage', 'Prospecção ativa');
  url.searchParams.set('limit', limit.toString());
  
  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${CRM_WEBHOOK_SECRET}`,
    },
  });
  
  if (!response.ok) {
    throw new Error(`CRM error: ${response.status}`);
  }
  
  return response.json();
}

// Buscar prospect por ID
async function getProspectById(clientId) {
  const url = new URL(CRM_BASE_URL);
  url.searchParams.set('search', clientId);
  url.searchParams.set('limit', '1');
  
  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${CRM_WEBHOOK_SECRET}`,
    },
  });
  
  if (!response.ok) {
    throw new Error(`CRM error: ${response.status}`);
  }
  
  const data = await response.json();
  return data.clients?.[0] || null;
}

// Registrar follow-up no CRM
async function addFollowUp(clientId, text, author = 'agente-voz') {
  const response = await fetch(CRM_BASE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CRM_WEBHOOK_SECRET}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      clientId,
      followup: text,
      author,
    }),
  });
  
  if (!response.ok) {
    throw new Error(`CRM error: ${response.status}`);
  }
  
  return response.json();
}

// Registrar log no CRM
async function addLog(clientId, message, source = 'prospeccao-voz') {
  const response = await fetch(CRM_BASE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CRM_WEBHOOK_SECRET}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      clientId,
      log: message,
      source,
    }),
  });
  
  if (!response.ok) {
    throw new Error(`CRM error: ${response.status}`);
  }
  
  return response.json();
}

// Mover lead para outra etapa do funil
async function updateFunnelStage(clientId, stageName, prospectName) {
  // Endpoint específico para atualizar leads
  const leadsUrl = CRM_BASE_URL.replace('/crm', '/leads');
  
  const response = await fetch(leadsUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-webhook-secret': CRM_WEBHOOK_SECRET,
    },
    body: JSON.stringify({
      clientId,
      name: prospectName || 'Lead',
      funnelStage: stageName,
      funnelStageUpdatedAt: new Date().toISOString(),
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`CRM error ao mover etapa: ${response.status} - ${errorText}`);
  }
  
  return response.json();
}

// Códigos das etapas do funil (constante global)
const ETAPAS_FUNIL = {
  PROSPECCAO_ATIVA: 'UvnIbksdP5RLTYED5Ls7',
  TELEFONE_INDISPONIVEL: 'icmJMFGBg4yCAlgZ957A',
  PRIMEIRO_CONTATO: 'qB1lFGTkGWWRkLfyyTEA',
  REUNIAO_BRIEFING: 'McODeXTMDLyIGWLin6rG',
  ENVIAR_APRESENTACAO: 'kAou6U9lzJ7aK9GKkONb',
  SEM_INTERESSE: 'PwNhDN5TpmFZibczzsm2',
  ON_HOLD: 'XEHpX54uoW2Au6T0ksxL',
  BARRADO_TWILIO: 'wcBPtzDxFBtDdGyB3hjx',
};

// ========== ENDPOINTS ==========

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Endpoint para Vapi - Buscar horários
app.post('/vapi/available-slots', async (req, res) => {
  console.log('[ENDPOINT] ========== /vapi/available-slots CHAMADO ==========');
  console.log('[ENDPOINT] Timestamp:', new Date().toISOString());
  console.log('[ENDPOINT] Request body:', JSON.stringify(req.body, null, 2));

  try {
    const toolCallId = req.body.message?.toolCallList?.[0]?.id;
    console.log('[ENDPOINT] Tool Call ID:', toolCallId);

    console.log('[ENDPOINT] Chamando getAvailableSlots(7)...');
    const slots = await getAvailableSlots(7);
    console.log('[ENDPOINT] Slots retornados:', slots.length);

    // Retornar apenas 3 opções para não confundir
    const nextSlots = slots.slice(0, 3);
    console.log('[ENDPOINT] Próximos 3 slots selecionados:', nextSlots.map(s => s.formatted));

    // Formatar para o Vapi (TTS-friendly)
    const responseText = `Tenho três opções: ${nextSlots.map((s, i) => `${i + 1}, ${s.formatted}`).join('. ')}. Qual funciona melhor pra você?`;
    console.log('[ENDPOINT] Resposta para Vapi:', responseText);

    const response = {
      results: [{
        toolCallId,
        result: responseText
      }]
    };

    console.log('[ENDPOINT] ========== /vapi/available-slots SUCESSO ==========');
    res.json(response);
  } catch (error) {
    console.error('[ENDPOINT] ========== ERRO em /vapi/available-slots ==========');
    console.error('[ENDPOINT] Erro:', error.message);
    console.error('[ENDPOINT] Stack:', error.stack);
    res.json({
      results: [{
        toolCallId: req.body.message?.toolCallList?.[0]?.id,
        result: 'Desculpe, não consegui acessar a agenda no momento. Podemos confirmar o horário por WhatsApp?'
      }]
    });
  }
});

// Endpoint para Vapi - Agendar reunião
app.post('/vapi/schedule-meeting', async (req, res) => {
  console.log('[ENDPOINT] ========== /vapi/schedule-meeting CHAMADO ==========');
  console.log('[ENDPOINT] Timestamp:', new Date().toISOString());
  console.log('[ENDPOINT] Request body:', JSON.stringify(req.body, null, 2));

  try {
    const toolCall = req.body.message?.toolCallList?.[0];
    const args = toolCall?.function?.arguments || {};
    const toolCallId = toolCall?.id;
    
    // Pegar metadata da chamada (fallback para dados do prospect)
    const callMetadata = req.body.message?.call?.assistantOverrides?.metadata || {};
    const customerPhone = req.body.message?.call?.customer?.number;

    console.log('[ENDPOINT] Tool Call ID:', toolCallId);
    console.log('[ENDPOINT] Argumentos recebidos:', JSON.stringify(args, null, 2));
    console.log('[ENDPOINT] Metadata da chamada:', JSON.stringify(callMetadata, null, 2));

    // Usar args da tool, com fallback para metadata da chamada
    const startTime = args.startTime;
    const prospectEmail = args.prospectEmail;
    const prospectName = args.prospectName || callMetadata.prospectName || 'Prospect';
    const prospectCompany = args.prospectCompany || callMetadata.prospectCompany || 'Empresa';
    const prospectPhone = args.prospectPhone || customerPhone;

    console.log('[ENDPOINT] Dados extraídos (com fallback):');
    console.log('[ENDPOINT]   - startTime:', startTime);
    console.log('[ENDPOINT]   - prospectName:', prospectName);
    console.log('[ENDPOINT]   - prospectCompany:', prospectCompany);
    console.log('[ENDPOINT]   - prospectPhone:', prospectPhone);
    console.log('[ENDPOINT]   - prospectEmail:', prospectEmail);

    if (!startTime) {
      console.log('[ENDPOINT] AVISO: startTime não fornecido, solicitando horário');
      return res.json({
        results: [{
          toolCallId,
          result: 'Preciso do horário para agendar. Qual horário você prefere?'
        }]
      });
    }

    console.log('[ENDPOINT] Chamando createMeeting()...');
    const event = await createMeeting(startTime, prospectName, prospectCompany, prospectPhone, prospectEmail);
    console.log('[ENDPOINT] Reunião criada! Event ID:', event.id);

    const meetingDate = new Date(startTime);
    const formatted = formatSlot(meetingDate);
    const confirmationMsg = prospectEmail 
      ? `Você vai receber o convite no seu email ${prospectEmail}.`
      : `Vou enviar uma confirmação por WhatsApp.`;
    const responseText = `Reunião agendada com sucesso para ${formatted}. ${confirmationMsg}`;

    console.log('[ENDPOINT] Resposta para Vapi:', responseText);
    console.log('[ENDPOINT] ========== /vapi/schedule-meeting SUCESSO ==========');

    res.json({
      results: [{
        toolCallId,
        result: responseText
      }]
    });
  } catch (error) {
    console.error('[ENDPOINT] ========== ERRO em /vapi/schedule-meeting ==========');
    console.error('[ENDPOINT] Erro:', error.message);
    console.error('[ENDPOINT] Stack:', error.stack);
    res.json({
      results: [{
        toolCallId: req.body.message?.toolCallList?.[0]?.id,
        result: 'Houve um problema ao agendar. Vou confirmar o horário por WhatsApp, ok?'
      }]
    });
  }
});

// Endpoint genérico do Vapi (Server URL)
app.post('/vapi/webhook', async (req, res) => {
  console.log('Vapi webhook:', JSON.stringify(req.body, null, 2));
  
  const messageType = req.body.message?.type;
  console.log('[WEBHOOK] Message type:', messageType);

  // Tool calls - consultar agenda ou agendar reunião
  if (messageType === 'tool-calls') {
    const toolCall = req.body.message?.toolCallList?.[0];
    const functionName = toolCall?.function?.name;
    const toolCallId = toolCall?.id;
    const args = toolCall?.function?.arguments;

    console.log('[WEBHOOK] ========== TOOL CALL DETECTADO ==========');
    console.log('[WEBHOOK] Function name:', functionName);
    console.log('[WEBHOOK] Tool Call ID:', toolCallId);
    console.log('[WEBHOOK] Arguments:', JSON.stringify(args, null, 2));

    if (functionName === 'getAvailableSlots') {
      console.log('[WEBHOOK] >>> Redirecionando para /vapi/available-slots');
      return app._router.handle({ ...req, url: '/vapi/available-slots' }, res, () => {});
    }

    if (functionName === 'scheduleMeeting') {
      console.log('[WEBHOOK] >>> Redirecionando para /vapi/schedule-meeting');
      return app._router.handle({ ...req, url: '/vapi/schedule-meeting' }, res, () => {});
    }

    console.log('[WEBHOOK] Tool call não reconhecido:', functionName);
  }
  
  // End of call - registrar no CRM
  if (messageType === 'end-of-call-report') {
    try {
      // Debug: logar estrutura completa
      console.log('=== END OF CALL PAYLOAD ===');
      console.log('req.body keys:', Object.keys(req.body));
      console.log('req.body.message keys:', Object.keys(req.body.message || {}));
      
      // Dados podem vir em diferentes lugares dependendo da versão da API
      const message = req.body.message || {};
      const call = message.call || message;
      
      console.log('call keys:', Object.keys(call));
      console.log('call.analysis:', call.analysis);
      console.log('call.startedAt:', call.startedAt);
      console.log('call.endedAt:', call.endedAt);
      
      // ID da ligação
      const callId = call?.id || message?.call?.id || message?.id;
      console.log('callId:', callId);
      
      // Metadata pode estar em diferentes lugares
      const metadata = call?.assistantOverrides?.metadata || 
                       message?.call?.assistantOverrides?.metadata ||
                       message?.metadata || {};
      const { clientId, prospectName, prospectCompany } = metadata;
      
      console.log('metadata:', metadata);
      console.log('clientId:', clientId);
      
      // Dados da análise
      const summary = call?.analysis?.summary || message?.analysis?.summary || '';
      const successRaw = call?.analysis?.successEvaluation || message?.analysis?.successEvaluation;
      const isSuccess = successRaw === 'true' || successRaw === true;
      
      console.log('summary:', summary);
      console.log('successRaw:', successRaw);
      
      // Duração - tentar pegar de diferentes lugares
      let durationSec = 0;
      const startedAt = call?.startedAt || message?.startedAt;
      const endedAt = call?.endedAt || message?.endedAt;
      if (startedAt && endedAt) {
        durationSec = Math.round((new Date(endedAt) - new Date(startedAt)) / 1000);
      }
      console.log('startedAt:', startedAt, 'endedAt:', endedAt, 'durationSec:', durationSec);
      const durationMin = Math.floor(durationSec / 60);
      const durationSecRest = durationSec % 60;
      const durationText = durationSec >= 60 
        ? `~${durationMin}min${durationSecRest > 0 ? durationSecRest + 's' : ''}` 
        : `${durationSec}s`;
      
      // Motivo de encerramento
      const endedReason = call?.endedReason || message?.endedReason || 'unknown';
      console.log('endedReason:', endedReason);
      
      // Mapear motivo para texto humanizado
      const reasonMap = {
        'customer-ended-call': 'Cliente desligou',
        'assistant-ended-call': 'Assistente encerrou',
        'voicemail': 'Caixa postal',
        'no-answer': 'Não atendeu',
        'busy': 'Linha ocupada',
        'failed': 'Falha na ligação',
        'customer-did-not-give-response': 'Cliente não respondeu',
        'assistant-did-not-give-response': 'Erro do assistente',
        'silence-timeout': 'Silêncio prolongado',
        'call-exceeded-max-duration': 'Tempo máximo excedido',
        'manually-canceled': 'Cancelada',
        'assistant-error': 'Erro do assistente',
        'pipeline-error': 'Erro técnico',
      };
      const reasonText = reasonMap[endedReason] || endedReason;
      
      // Verificar se conectou
      const notConnected = ['voicemail', 'no-answer', 'busy', 'failed', 'pipeline-error', 'manually-canceled'].includes(endedReason);
      
      console.log('End of call - clientId:', clientId, 'endedReason:', endedReason, 'success:', isSuccess, 'connected:', !notConnected);
      
      if (clientId) {
        // Classificar resultado usando IA
        const classification = await classifyCallResult(summary, endedReason);
        console.log('Classificação final:', classification);
        
        // Mapear classificação para resultado e etapa
        let resultado;
        let nextStage;
        
        switch (classification) {
          case 'TELEFONE_INDISPONIVEL':
            resultado = `Não foi possível falar (${reasonText})`;
            nextStage = ETAPAS_FUNIL.TELEFONE_INDISPONIVEL; // Move para Telefone indisponível
            break;
          case 'REUNIAO_AGENDADA':
            resultado = 'Cliente aceitou agendar reunião ✅';
            nextStage = ETAPAS_FUNIL.REUNIAO_BRIEFING;
            break;
          case 'ENVIAR_EMAIL':
            resultado = 'Cliente pediu para enviar material por email';
            nextStage = ETAPAS_FUNIL.ENVIAR_APRESENTACAO;
            break;
          case 'SEM_INTERESSE':
          default:
            resultado = 'Sem interesse no momento';
            nextStage = ETAPAS_FUNIL.SEM_INTERESSE;
            break;
        }
        
        // Montar follow-up simples e limpo
        let followupText = `📞 Ligação de prospecção

⏱️ Duração: ${durationText}
🎯 Resultado: ${resultado}

📝 Resumo: ${summary || 'Não disponível'}`;
        
        // Registrar follow-up
        await addFollowUp(clientId, followupText, 'agente-voz');
        
        // Mover lead para próxima etapa (só se classificado)
        if (nextStage) {
          try {
            await updateFunnelStage(clientId, nextStage, prospectName);
            console.log('Lead movido para etapa:', nextStage);
          } catch (stageError) {
            console.error('Erro ao mover etapa:', stageError.message);
          }
        }
        
        await addLog(clientId, `Ligação: ${resultado}${nextStage ? '' : ' (mantido na etapa atual)'}`, 'vapi-webhook');
        console.log('CRM atualizado com sucesso para clientId:', clientId);
        
        // Registrar no tracker para relatório
        const atendeu = !notConnected;
        trackCallResult(callId, atendeu, classification, prospectName || prospectCompany || 'Desconhecido');
      } else {
        console.log('Sem clientId no metadata, não registrou no CRM');
        // Ainda assim registra no tracker
        const atendeu = !notConnected;
        trackCallResult(callId, atendeu, classification || 'DESCONHECIDO', 'Desconhecido');
      }
    } catch (error) {
      console.error('Erro ao registrar end-of-call no CRM:', error);
    }
  }
  
  // Default response
  res.json({ status: 'received' });
});

// ========== AUTOMAÇÃO DE LIGAÇÕES ==========

// Disparar ligações em lote
app.post('/trigger-calls', async (req, res) => {
  try {
    const { limit = 5, intervalMs = 30000 } = req.body; // Padrão: 5 ligações, 30s entre elas
    
    // Buscar prospects em Prospecção Ativa
    const prospects = await getActiveProspects(limit * 2); // Busca mais para ter margem após ordenação
    
    if (!prospects.clients || prospects.clients.length === 0) {
      return res.json({ 
        success: true, 
        message: 'Nenhum prospect em Prospecção Ativa',
        calls: [] 
      });
    }
    
    // Ordenar por lastFollowUpAt (mais antigo primeiro = mais tempo sem contato)
    // null/undefined vem primeiro (nunca teve contato)
    const sortedClients = prospects.clients.sort((a, b) => {
      const dateA = a.lastFollowUpAt ? new Date(a.lastFollowUpAt).getTime() : 0;
      const dateB = b.lastFollowUpAt ? new Date(b.lastFollowUpAt).getTime() : 0;
      return dateA - dateB; // Ascendente: mais antigo primeiro
    });
    
    // Aplicar limite após ordenação
    const clientsToCall = sortedClients.slice(0, limit);
    
    console.log('Prospects ordenados por último contato (mais antigo primeiro):');
    clientsToCall.forEach((c, i) => {
      console.log(`  ${i + 1}. ${c.name} - último contato: ${c.lastFollowUpAt || 'nunca'}`);
    });
    
    const results = [];
    const greeting = getGreeting();
    
    // Resetar tracker para novo batch
    resetDailyTracker();
    
    console.log(`Iniciando ${clientsToCall.length} ligações com intervalo de ${intervalMs}ms`);
    
    for (let i = 0; i < clientsToCall.length; i++) {
      const prospect = clientsToCall[i];
      
      try {
        // Disparar ligação
        const call = await makeCall(prospect);
        
        // Registrar no tracker
        trackCallStarted(call.id, prospect.name);
        
        results.push({
          prospect: prospect.name,
          phone: prospect.phone,
          callId: call.id,
          status: 'queued',
        });
        
        console.log(`✅ Ligação ${i + 1}/${clientsToCall.length}: ${prospect.name} - ${call.id}`);
        
        // Aguardar intervalo antes da próxima (exceto na última)
        if (i < clientsToCall.length - 1) {
          await new Promise(resolve => setTimeout(resolve, intervalMs));
        }
      } catch (error) {
        console.error(`❌ Erro ao ligar para ${prospect.name}:`, error.message);
        results.push({
          prospect: prospect.name,
          phone: prospect.phone,
          status: 'error',
          error: error.message,
        });
      }
    }
    
    res.json({
      success: true,
      greeting,
      total: results.length,
      calls: results,
    });
  } catch (error) {
    console.error('Erro no trigger-calls:', error);
    res.status(500).json({ error: error.message });
  }
});

// Status das ligações do dia
app.get('/calls/today', async (req, res) => {
  try {
    // Buscar ligações das últimas 24h via Vapi
    const response = await fetch('https://api.vapi.ai/call?limit=50', {
      headers: { 'Authorization': `Bearer ${VAPI_API_KEY}` },
    });
    
    if (!response.ok) throw new Error('Erro ao buscar ligações');
    
    const calls = await response.json();
    
    // Filtrar ligações de hoje
    const today = new Date().toISOString().split('T')[0];
    const todayCalls = calls.filter(c => c.createdAt?.startsWith(today));
    
    res.json({
      date: today,
      total: todayCalls.length,
      calls: todayCalls.map(c => ({
        id: c.id,
        phone: c.customer?.number,
        status: c.status,
        endedReason: c.endedReason,
        duration: c.startedAt && c.endedAt 
          ? Math.round((new Date(c.endedAt) - new Date(c.startedAt)) / 1000) 
          : null,
        success: c.analysis?.successEvaluation,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Relatório do dia para envio via WhatsApp
app.get('/calls/report', async (req, res) => {
  try {
    // Buscar ligações das últimas 24h via Vapi
    const response = await fetch('https://api.vapi.ai/call?limit=100', {
      headers: { 'Authorization': `Bearer ${VAPI_API_KEY}` },
    });
    
    if (!response.ok) throw new Error('Erro ao buscar ligações');
    
    const calls = await response.json();
    
    // Filtrar ligações de hoje
    const today = new Date().toISOString().split('T')[0];
    const todayCalls = calls.filter(c => c.createdAt?.startsWith(today));
    
    // Classificar por resultado
    const naoAtendeuReasons = ['voicemail', 'no-answer', 'busy', 'failed', 'pipeline-error', 'manually-canceled', 'twilio-failed-to-connect-call'];
    
    // Frases que indicam caixa postal
    const frasesCaixaPostal = [
      'entrego o seu recado',
      'deixe sua mensagem',
      'caixa postal',
      'voicemail',
      'telefone estiver disponível',
      'leave a message',
      'não está disponível'
    ];
    
    let atenderam = 0;
    let naoAtenderam = 0;
    const resultados = {};
    const detalhes = [];
    
    for (const call of todayCalls) {
      const phone = call.customer?.number || 'Desconhecido';
      const metadata = call.assistantOverrides?.metadata || {};
      const name = metadata.prospectName || phone;
      const endedReason = call.endedReason || 'unknown';
      const summary = (call.analysis?.summary || '').toLowerCase();
      
      // Verificar se é caixa postal pelo summary
      const ehCaixaPostal = frasesCaixaPostal.some(frase => summary.includes(frase));
      
      if (naoAtendeuReasons.includes(endedReason) || ehCaixaPostal) {
        naoAtenderam++;
        const motivo = ehCaixaPostal ? 'caixa postal' : endedReason;
        detalhes.push({ name, status: 'não atendeu', motivo });
      } else {
        atenderam++;
        // Tentar pegar o resultado da análise
        const success = call.analysis?.successEvaluation;
        let resultado = 'Conversa realizada';
        if (success === 'true' || success === true) {
          resultado = 'Reunião agendada';
        }
        detalhes.push({ name, status: 'atendeu', resultado });
        resultados[resultado] = (resultados[resultado] || 0) + 1;
      }
    }
    
    res.json({
      date: today,
      total: todayCalls.length,
      atenderam,
      naoAtenderam,
      resultados,
      detalhes: detalhes.slice(0, 30), // Limitar para não ficar muito grande
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Teste local - ver slots
app.get('/test/slots', async (req, res) => {
  try {
    const slots = await getAvailableSlots(7);
    res.json({ 
      total: slots.length,
      slots: slots.slice(0, 20)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== CRM ENDPOINTS ==========

// Buscar prospects para ligar
app.get('/crm/prospects', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const data = await getActiveProspects(limit);
    res.json(data);
  } catch (error) {
    console.error('Erro ao buscar prospects:', error);
    res.status(500).json({ error: error.message });
  }
});

// Registrar resultado da ligação
app.post('/crm/call-result', async (req, res) => {
  try {
    const { clientId, result, notes, meetingScheduled, meetingTime } = req.body;
    
    if (!clientId) {
      return res.status(400).json({ error: 'clientId é obrigatório' });
    }
    
    // Montar texto do follow-up
    let followupText = `📞 Ligação de prospecção\nResultado: ${result || 'Não informado'}`;
    if (notes) followupText += `\nObservações: ${notes}`;
    if (meetingScheduled && meetingTime) {
      followupText += `\n✅ Reunião agendada: ${meetingTime}`;
    }
    
    // Registrar follow-up
    await addFollowUp(clientId, followupText, 'agente-voz');
    
    // Registrar log
    await addLog(clientId, `Ligação realizada - ${result}`, 'prospeccao-voz');
    
    res.json({ success: true, message: 'Resultado registrado' });
  } catch (error) {
    console.error('Erro ao registrar resultado:', error);
    res.status(500).json({ error: error.message });
  }
});

// Webhook do Vapi - fim da ligação
app.post('/vapi/end-of-call', async (req, res) => {
  try {
    console.log('Vapi end-of-call:', JSON.stringify(req.body, null, 2));
    
    const { call } = req.body.message || {};
    const metadata = call?.assistantOverrides?.metadata || {};
    const { clientId, prospectName, prospectCompany } = metadata;
    
    // Extrair resumo da conversa
    const summary = call?.analysis?.summary || 'Sem resumo disponível';
    const successEval = call?.analysis?.successEvaluation || 'unknown';
    
    // Registrar no CRM se tiver clientId
    if (clientId) {
      const followupText = `📞 Ligação automática finalizada
Prospect: ${prospectName || 'N/A'} - ${prospectCompany || 'N/A'}
Avaliação: ${successEval}
Resumo: ${summary}`;
      
      await addFollowUp(clientId, followupText, 'agente-voz');
      await addLog(clientId, `Ligação finalizada - ${successEval}`, 'vapi-webhook');
    }
    
    res.json({ status: 'received' });
  } catch (error) {
    console.error('Erro no end-of-call:', error);
    res.json({ status: 'error', message: error.message });
  }
});

// ========== CRON - DISPARO AUTOMÁTICO ==========

// Configuração do disparo automático
const CRON_ENABLED = process.env.CRON_ENABLED !== 'false'; // Habilitado por padrão
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '0 9 * * 1-5'; // 09h seg-sex
const CRON_LIMIT = parseInt(process.env.CRON_LIMIT) || 50;
const CRON_INTERVAL_MS = parseInt(process.env.CRON_INTERVAL_MS) || 30000;

// Função que dispara as ligações
async function triggerScheduledCalls() {
  console.log(`\n========================================`);
  console.log(`🕐 CRON EXECUTANDO - ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
  console.log(`========================================\n`);
  
  try {
    // Buscar prospects
    const prospects = await getActiveProspects(CRON_LIMIT * 2);
    
    if (!prospects.clients || prospects.clients.length === 0) {
      console.log('📭 Nenhum prospect em Prospecção Ativa');
      return;
    }
    
    // Ordenar por lastFollowUpAt (mais antigo primeiro)
    const sortedClients = prospects.clients.sort((a, b) => {
      const dateA = a.lastFollowUpAt ? new Date(a.lastFollowUpAt).getTime() : 0;
      const dateB = b.lastFollowUpAt ? new Date(b.lastFollowUpAt).getTime() : 0;
      return dateA - dateB;
    });
    
    const clientsToCall = sortedClients.slice(0, CRON_LIMIT);
    
    console.log(`📞 Iniciando ${clientsToCall.length} ligações (limite: ${CRON_LIMIT})`);
    console.log(`⏱️  Intervalo: ${CRON_INTERVAL_MS / 1000}s entre ligações\n`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < clientsToCall.length; i++) {
      const prospect = clientsToCall[i];
      
      try {
        const call = await makeCall(prospect);
        successCount++;
        console.log(`✅ ${i + 1}/${clientsToCall.length} - ${prospect.name} (${prospect.phone}) - ID: ${call.id}`);
        
        // Aguardar intervalo
        if (i < clientsToCall.length - 1) {
          await new Promise(resolve => setTimeout(resolve, CRON_INTERVAL_MS));
        }
      } catch (error) {
        errorCount++;
        console.error(`❌ ${i + 1}/${clientsToCall.length} - ${prospect.name}: ${error.message}`);
      }
    }
    
    console.log(`\n========================================`);
    console.log(`📊 RESUMO: ${successCount} OK | ${errorCount} erros`);
    console.log(`========================================\n`);
    
  } catch (error) {
    console.error('❌ Erro no cron de ligações:', error);
  }
}

// Agendar cron job
if (CRON_ENABLED) {
  cron.schedule(CRON_SCHEDULE, triggerScheduledCalls, {
    timezone: 'America/Sao_Paulo'
  });
  console.log(`⏰ Cron agendado: "${CRON_SCHEDULE}" (America/Sao_Paulo)`);
  console.log(`   Limite: ${CRON_LIMIT} ligações | Intervalo: ${CRON_INTERVAL_MS / 1000}s`);
} else {
  console.log('⏰ Cron DESABILITADO (CRON_ENABLED=false)');
}

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  console.log(`Calendar ID: ${CALENDAR_ID}`);
});
