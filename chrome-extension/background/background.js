// Background Service Worker - Labrego IA WhatsApp Extension

// API Base URL padrão (pode ser sobrescrita pelo storage)
const DEFAULT_API_URL = 'https://labregoia.app.br';

// Função para obter a URL da API (do storage ou padrão)
async function getApiBaseUrl() {
  const stored = await chrome.storage.local.get(['apiBaseUrl']);
  return stored.apiBaseUrl || DEFAULT_API_URL;
}

// Sempre carregar o estado de autenticação do storage (não confiar na memória)
async function getAuthState() {
  try {
    const stored = await chrome.storage.local.get(['authState']);
    if (stored.authState && stored.authState.isAuthenticated && stored.authState.token) {
      return stored.authState;
    }
  } catch (error) {
    console.error('Erro ao carregar estado de autenticação:', error);
  }
  return {
    isAuthenticated: false,
    token: null,
    user: null
  };
}

// Salvar estado de autenticação
async function saveAuthState(state) {
  try {
    await chrome.storage.local.set({ authState: state });
    console.log('Labrego IA: Estado de autenticação salvo');
  } catch (error) {
    console.error('Erro ao salvar estado de autenticação:', error);
  }
}

// Inicialização (apenas na instalação)
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Labrego IA Extension instalada');

  // Criar menu de contexto
  chrome.contextMenus.create({
    id: 'labrego-copy-message',
    title: 'Copiar para Labrego IA',
    contexts: ['selection'],
    documentUrlPatterns: ['https://web.whatsapp.com/*']
  });

  chrome.contextMenus.create({
    id: 'labrego-create-contact',
    title: 'Criar contato no Labrego IA',
    contexts: ['page'],
    documentUrlPatterns: ['https://web.whatsapp.com/*']
  });
});

// Listener de mensagens do content script e popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse);
  return true; // Indica resposta assíncrona
});

// Handler de mensagens
async function handleMessage(message, sender) {
  switch (message.type) {
    case 'LOGIN':
      return await handleLogin(message.payload);

    case 'LOGOUT':
      return await handleLogout();

    case 'CHECK_AUTH':
      // Sempre carregar do storage para garantir persistência
      const authState = await getAuthState();
      return { isAuthenticated: authState.isAuthenticated, user: authState.user };

    case 'CREATE_CONTACT':
      return await handleCreateContact(message.payload);

    case 'SAVE_MESSAGE':
      return await handleSaveMessage(message.payload);

    case 'GET_CONTACTS':
      return await handleGetContacts(message.payload);

    case 'SEARCH_CONTACT':
      return await handleSearchContact(message.payload);

    case 'CREATE_LEAD':
      return await handleCreateLead(message.payload);

    case 'GET_FUNNELS':
      return await handleGetFunnels();

    case 'GET_COLUMNS':
      return await handleGetColumns(message.payload);

    case 'GET_OPPORTUNITIES':
      return await handleGetOpportunities(message.payload);

    case 'SAVE_MESSAGES_TO_OPPORTUNITY':
      return await handleSaveMessagesToOpportunity(message.payload);

    default:
      return { error: 'Tipo de mensagem desconhecido' };
  }
}

// Handlers de ações

async function handleLogin(credentials) {
  try {
    const apiBaseUrl = await getApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/api/extension/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(credentials)
    });

    const data = await response.json();

    if (data.success) {
      const newAuthState = {
        isAuthenticated: true,
        token: data.token,
        user: data.user
      };
      await saveAuthState(newAuthState);
      return { success: true, user: data.user };
    } else {
      return { success: false, error: data.error || 'Falha na autenticação' };
    }
  } catch (error) {
    console.error('Erro no login:', error);
    return { success: false, error: 'Erro de conexão com o servidor' };
  }
}

async function handleLogout() {
  await saveAuthState({
    isAuthenticated: false,
    token: null,
    user: null
  });
  return { success: true };
}

async function handleCreateContact(contactData) {
  const authState = await getAuthState();
  if (!authState.isAuthenticated) {
    return { success: false, error: 'Não autenticado' };
  }

  try {
    const apiBaseUrl = await getApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/api/extension/contacts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authState.token}`
      },
      body: JSON.stringify(contactData)
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Erro ao criar contato:', error);
    return { success: false, error: 'Erro ao criar contato' };
  }
}

async function handleSaveMessage(messageData) {
  const authState = await getAuthState();
  if (!authState.isAuthenticated) {
    return { success: false, error: 'Não autenticado' };
  }

  try {
    const apiBaseUrl = await getApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/api/extension/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authState.token}`
      },
      body: JSON.stringify(messageData)
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Erro ao salvar mensagem:', error);
    return { success: false, error: 'Erro ao salvar mensagem' };
  }
}

async function handleGetContacts(params) {
  const authState = await getAuthState();
  if (!authState.isAuthenticated) {
    return { success: false, error: 'Não autenticado' };
  }

  try {
    const apiBaseUrl = await getApiBaseUrl();
    const queryParams = new URLSearchParams(params).toString();
    const response = await fetch(`${apiBaseUrl}/api/extension/contacts?${queryParams}`, {
      headers: {
        'Authorization': `Bearer ${authState.token}`
      }
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Erro ao buscar contatos:', error);
    return { success: false, error: 'Erro ao buscar contatos' };
  }
}

async function handleSearchContact(params) {
  const authState = await getAuthState();
  if (!authState.isAuthenticated) {
    return { success: false, error: 'Não autenticado' };
  }

  try {
    const apiBaseUrl = await getApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/api/extension/contacts/search?phone=${encodeURIComponent(params.phone)}`, {
      headers: {
        'Authorization': `Bearer ${authState.token}`
      }
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Erro ao buscar contato:', error);
    return { success: false, error: 'Erro ao buscar contato' };
  }
}

async function handleCreateLead(leadData) {
  const authState = await getAuthState();
  if (!authState.isAuthenticated) {
    return { success: false, error: 'Não autenticado' };
  }

  try {
    const apiBaseUrl = await getApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/api/extension/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authState.token}`
      },
      body: JSON.stringify(leadData)
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Erro ao criar lead:', error);
    return { success: false, error: 'Erro ao criar lead' };
  }
}

async function handleGetFunnels() {
  const authState = await getAuthState();
  if (!authState.isAuthenticated) {
    return { success: false, error: 'Não autenticado' };
  }

  try {
    const apiBaseUrl = await getApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/api/extension/funnels`, {
      headers: {
        'Authorization': `Bearer ${authState.token}`
      }
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Erro ao buscar funis:', error);
    return { success: false, error: 'Erro ao buscar funis' };
  }
}

async function handleGetColumns(params) {
  const authState = await getAuthState();
  if (!authState.isAuthenticated) {
    return { success: false, error: 'Não autenticado' };
  }

  try {
    const apiBaseUrl = await getApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/api/extension/columns?funnelId=${encodeURIComponent(params.funnelId)}`, {
      headers: {
        'Authorization': `Bearer ${authState.token}`
      }
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Erro ao buscar colunas:', error);
    return { success: false, error: 'Erro ao buscar colunas' };
  }
}

async function handleGetOpportunities(params) {
  const authState = await getAuthState();
  if (!authState.isAuthenticated) {
    return { success: false, error: 'Não autenticado' };
  }

  try {
    const apiBaseUrl = await getApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/api/extension/opportunities?funnelId=${encodeURIComponent(params.funnelId)}`, {
      headers: {
        'Authorization': `Bearer ${authState.token}`
      }
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Erro ao buscar oportunidades:', error);
    return { success: false, error: 'Erro ao buscar oportunidades' };
  }
}

async function handleSaveMessagesToOpportunity(data) {
  const authState = await getAuthState();
  if (!authState.isAuthenticated) {
    return { success: false, error: 'Não autenticado' };
  }

  try {
    const apiBaseUrl = await getApiBaseUrl();
    console.log('Labrego IA: Salvando mensagens para oportunidade', {
      opportunityId: data.opportunityId,
      messageCount: data.messages?.length,
      apiBaseUrl
    });

    const response = await fetch(`${apiBaseUrl}/api/extension/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authState.token}`
      },
      body: JSON.stringify({
        ...data,
        saveToOpportunity: true
      })
    });

    const result = await response.json();
    console.log('Labrego IA: Resposta do servidor', result);

    if (!result.success) {
      console.error('Labrego IA: Erro ao salvar', result.error);
    }

    return result;
  } catch (error) {
    console.error('Erro ao salvar mensagens:', error);
    return { success: false, error: 'Erro ao salvar mensagens: ' + error.message };
  }
}

// Menu de contexto
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'labrego-copy-message') {
    // Enviar mensagem selecionada para o content script
    chrome.tabs.sendMessage(tab.id, {
      type: 'CONTEXT_COPY_MESSAGE',
      text: info.selectionText
    });
  } else if (info.menuItemId === 'labrego-create-contact') {
    // Abrir modal para criar contato
    chrome.tabs.sendMessage(tab.id, {
      type: 'CONTEXT_CREATE_CONTACT'
    });
  }
});

// A URL base é carregada dinamicamente do storage via getApiBaseUrl()
