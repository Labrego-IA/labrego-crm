// Labrego IA - Popup Script

document.addEventListener('DOMContentLoaded', async () => {
  // Elementos
  const notWhatsApp = document.getElementById('not-whatsapp');
  const loginSection = document.getElementById('login-section');
  const loggedSection = document.getElementById('logged-section');
  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error');
  const logoutBtn = document.getElementById('logout-btn');
  const openSidebarBtn = document.getElementById('open-sidebar-btn');
  const openCrmBtn = document.getElementById('open-crm-btn');
  const saveSettingsBtn = document.getElementById('save-settings-btn');
  const apiUrlInput = document.getElementById('api-url');

  // Verificar se está no WhatsApp Web
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const isWhatsApp = tab?.url?.includes('web.whatsapp.com');

  if (!isWhatsApp) {
    notWhatsApp.classList.remove('hidden');
    return;
  }

  // Verificar autenticação
  let authStatus = { isAuthenticated: false, user: null };
  try {
    authStatus = await sendMessage({ type: 'CHECK_AUTH' });
  } catch (error) {
    console.error('Error checking auth:', error);
  }

  if (authStatus?.isAuthenticated) {
    showLoggedSection(authStatus.user);
  } else {
    showLoginSection();
  }

  // Carregar configurações salvas
  const stored = await chrome.storage.local.get(['apiBaseUrl']);
  if (stored.apiBaseUrl) {
    apiUrlInput.value = stored.apiBaseUrl;
  }

  // Event Listeners
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    loginError.classList.add('hidden');

    try {
      const result = await sendMessage({
        type: 'LOGIN',
        payload: { email, password }
      });

      if (result?.success) {
        showLoggedSection(result.user);
      } else {
        document.getElementById('login-error-text').textContent = result?.error || 'Erro ao fazer login';
        loginError.classList.remove('hidden');
      }
    } catch (error) {
      console.error('Login error:', error);
      document.getElementById('login-error-text').textContent = 'Erro de conexão. Tente novamente.';
      loginError.classList.remove('hidden');
    }
  });

  logoutBtn.addEventListener('click', async () => {
    try {
      await sendMessage({ type: 'LOGOUT' });
    } catch (error) {
      console.error('Logout error:', error);
    }
    showLoginSection();
  });

  openSidebarBtn.addEventListener('click', async () => {
    // Enviar mensagem para o content script para abrir a sidebar
    chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_SIDEBAR' });
    window.close();
  });

  openCrmBtn.addEventListener('click', async () => {
    const stored = await chrome.storage.local.get(['apiBaseUrl']);
    const baseUrl = stored.apiBaseUrl || 'https://labregoia.app.br';
    chrome.tabs.create({ url: baseUrl });
  });

  saveSettingsBtn.addEventListener('click', async () => {
    const url = apiUrlInput.value.trim();
    if (url) {
      await chrome.storage.local.set({ apiBaseUrl: url });
      showNotification('Configurações salvas!');
    }
  });

  // Funções auxiliares
  function showLoginSection() {
    loginSection.classList.remove('hidden');
    loggedSection.classList.add('hidden');
  }

  function showLoggedSection(user) {
    loginSection.classList.add('hidden');
    loggedSection.classList.remove('hidden');

    // Atualizar informações do usuário
    document.getElementById('user-name').textContent = user?.name || 'Usuário';
    document.getElementById('user-email').textContent = user?.email || '';
    document.getElementById('user-initial').textContent = (user?.name?.[0] || 'U').toUpperCase();

    // Carregar estatísticas
    loadStats();
  }

  async function loadStats() {
    // Aqui poderia carregar estatísticas reais da API
    // Por enquanto, mostramos valores estáticos
    const stored = await chrome.storage.local.get(['dailyStats']);
    const stats = stored.dailyStats || { contacts: 0, messages: 0 };

    document.getElementById('contacts-count').textContent = stats.contacts;
    document.getElementById('messages-count').textContent = stats.messages;
  }

  function showNotification(message) {
    // Criar notificação temporária
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      bottom: 60px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(to right, #2563EB, #3b82f6);
      color: white;
      padding: 10px 20px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 500;
      z-index: 1000;
      box-shadow: 0 10px 25px -5px rgba(37, 99, 235, 0.4);
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => notification.remove(), 2000);
  }

  function sendMessage(message) {
    return new Promise((resolve, reject) => {
      try {
        if (!chrome.runtime || !chrome.runtime.id) {
          reject(new Error('Extension context invalidated'));
          return;
        }

        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Chrome runtime error:', chrome.runtime.lastError);
            reject(new Error(chrome.runtime.lastError.message || 'Unknown error'));
            return;
          }
          resolve(response);
        });
      } catch (error) {
        console.error('Error sending message:', error);
        reject(error);
      }
    });
  }
});
