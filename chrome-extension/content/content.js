// Content Script - Labrego IA WhatsApp Integration
// Este script é injetado no WhatsApp Web

(function() {
  'use strict';

  // Estado local
  let isAuthenticated = false;
  let currentUser = null;
  let sidebarOpen = false;
  let sidebarPosition = 'right'; // 'left' ou 'right'
  let currentContact = null;
  let lastDetectedContactName = null; // Rastrear último contato para detectar mudanças
  let selectedMessages = [];
  let selectionModeActive = false;

  // Campos em modo de edição (não serão atualizados automaticamente)
  let fieldsBeingEdited = {
    name: false,
    phone: false
  };

  // Campos modificados manualmente pelo usuário (não serão sobrescritos)
  let userModifiedFields = {
    name: false,
    phone: false
  };

  // Draggable button state
  let isDragging = false;
  let wasDragged = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  // Load button position from Chrome Storage
  async function loadButtonPosition(button) {
    try {
      const result = await chrome.storage.local.get('gmButtonPosition');
      if (result.gmButtonPosition) {
        const { x, y } = result.gmButtonPosition;
        // Validate position is within viewport
        const maxX = window.innerWidth - 60;
        const maxY = window.innerHeight - 60;
        const validX = Math.max(0, Math.min(x, maxX));
        const validY = Math.max(0, Math.min(y, maxY));

        button.style.right = 'auto';
        button.style.bottom = 'auto';
        button.style.left = validX + 'px';
        button.style.top = validY + 'px';
      }
    } catch (error) {
      console.log('Error loading button position:', error);
    }
  }

  // Save button position to Chrome Storage
  async function saveButtonPosition(x, y) {
    try {
      await chrome.storage.local.set({
        gmButtonPosition: { x, y }
      });
    } catch (error) {
      console.log('Error saving button position:', error);
    }
  }

  // Setup draggable functionality - Simple and robust implementation
  function setupDraggable(button) {
    function onMouseDown(e) {
      // Only handle left mouse button
      if (e.button !== 0) return;

      e.preventDefault();

      isDragging = true;
      wasDragged = false;

      const rect = button.getBoundingClientRect();
      dragOffsetX = e.clientX - rect.left;
      dragOffsetY = e.clientY - rect.top;

      button.classList.add('gm-dragging');

      document.onmousemove = onMouseMove;
      document.onmouseup = onMouseUp;
    }

    function onMouseMove(e) {
      if (!isDragging) return;

      e.preventDefault();

      wasDragged = true;

      let newX = e.clientX - dragOffsetX;
      let newY = e.clientY - dragOffsetY;

      // Keep within viewport
      const maxX = window.innerWidth - button.offsetWidth;
      const maxY = window.innerHeight - button.offsetHeight;
      newX = Math.max(0, Math.min(newX, maxX));
      newY = Math.max(0, Math.min(newY, maxY));

      button.style.right = 'auto';
      button.style.bottom = 'auto';
      button.style.left = newX + 'px';
      button.style.top = newY + 'px';
    }

    function onMouseUp(e) {
      if (!isDragging) return;

      isDragging = false;
      button.classList.remove('gm-dragging');

      document.onmousemove = null;
      document.onmouseup = null;

      if (wasDragged) {
        // Save position
        const rect = button.getBoundingClientRect();
        saveButtonPosition(rect.left, rect.top);
      } else {
        // It was a click
        toggleSidebar();
      }
    }

    // Touch events for mobile
    function onTouchStart(e) {
      if (e.touches.length !== 1) return;

      const touch = e.touches[0];
      isDragging = true;
      wasDragged = false;

      const rect = button.getBoundingClientRect();
      dragOffsetX = touch.clientX - rect.left;
      dragOffsetY = touch.clientY - rect.top;

      button.classList.add('gm-dragging');
    }

    function onTouchMove(e) {
      if (!isDragging || e.touches.length !== 1) return;

      e.preventDefault();
      wasDragged = true;

      const touch = e.touches[0];
      let newX = touch.clientX - dragOffsetX;
      let newY = touch.clientY - dragOffsetY;

      const maxX = window.innerWidth - button.offsetWidth;
      const maxY = window.innerHeight - button.offsetHeight;
      newX = Math.max(0, Math.min(newX, maxX));
      newY = Math.max(0, Math.min(newY, maxY));

      button.style.right = 'auto';
      button.style.bottom = 'auto';
      button.style.left = newX + 'px';
      button.style.top = newY + 'px';
    }

    function onTouchEnd(e) {
      if (!isDragging) return;

      isDragging = false;
      button.classList.remove('gm-dragging');

      if (wasDragged) {
        const rect = button.getBoundingClientRect();
        saveButtonPosition(rect.left, rect.top);
      } else {
        toggleSidebar();
      }
    }

    // Attach events to the button container directly
    button.onmousedown = onMouseDown;
    button.ontouchstart = onTouchStart;
    button.ontouchmove = onTouchMove;
    button.ontouchend = onTouchEnd;

    // Prevent context menu on long press
    button.oncontextmenu = (e) => e.preventDefault();
  }

  // Inicialização
  async function init() {
    console.log('Labrego IA Extension carregada no WhatsApp Web');

    try {
      const authStatus = await sendMessage({ type: 'CHECK_AUTH' });
      isAuthenticated = authStatus?.isAuthenticated || false;
      currentUser = authStatus?.user || null;
    } catch (error) {
      console.error('Error checking auth status:', error);
      isAuthenticated = false;
      currentUser = null;
    }

    injectUI();
    injectStyles();

    document.addEventListener('keydown', handleKeyDown);

    // Detectar mudança de contato periodicamente
    setInterval(detectCurrentContact, 1500);

    // Detectar mudança de contato mais rapidamente quando clicar no painel lateral de conversas
    document.addEventListener('click', (e) => {
      // Verificar se clicou em um item da lista de conversas
      const chatItem = e.target.closest('[data-testid="cell-frame-container"], [data-testid="list-item"], [role="listitem"], [data-id]');
      if (chatItem) {
        // Aguardar um pouco para o WhatsApp carregar o novo contato, depois detectar
        setTimeout(detectCurrentContact, 300);
        setTimeout(detectCurrentContact, 600);
      }
    }, true);
  }

  function sendMessage(message) {
    return new Promise((resolve, reject) => {
      try {
        // Verificar se o contexto da extensão ainda é válido
        if (!chrome.runtime || !chrome.runtime.id) {
          reject(new Error('Extension context invalidated. Please reload the page.'));
          return;
        }

        chrome.runtime.sendMessage(message, (response) => {
          // Verificar erro de runtime do Chrome
          if (chrome.runtime.lastError) {
            const errorMessage = chrome.runtime.lastError.message || 'Unknown error';
            console.error('Chrome runtime error:', errorMessage);

            // Se o contexto foi invalidado, mostrar mensagem amigável
            if (errorMessage.includes('Extension context invalidated') ||
                errorMessage.includes('Could not establish connection')) {
              reject(new Error('A extensão foi atualizada. Por favor, recarregue a página (F5) para continuar.'));
            } else {
              reject(new Error(errorMessage));
            }
            return;
          }
          resolve(response);
        });
      } catch (error) {
        console.error('Error sending message:', error);
        reject(new Error('A extensão foi atualizada. Por favor, recarregue a página (F5) para continuar.'));
      }
    });
  }

  // Injetar estilos para seleção de mensagens
  function injectStyles() {
    const style = document.createElement('style');
    style.id = 'gm-selection-styles';
    style.textContent = `
      .gm-selection-mode [data-id] {
        cursor: pointer !important;
        transition: all 0.2s ease !important;
      }
      .gm-selection-mode [data-id]:hover {
        background: rgba(37, 99, 235, 0.1) !important;
        border-radius: 8px !important;
      }
      .gm-message-selected {
        background: rgba(37, 99, 235, 0.2) !important;
        border-left: 4px solid #2563EB !important;
        border-radius: 8px !important;
      }
      .gm-selection-indicator {
        position: fixed;
        top: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #2563EB, #3b82f6);
        color: white;
        padding: 10px 20px;
        border-radius: 20px;
        font-size: 14px;
        font-weight: 600;
        z-index: 99999;
        box-shadow: 0 4px 20px rgba(37, 99, 235, 0.4);
        display: none;
      }
      .gm-selection-indicator.active {
        display: block;
        animation: pulse 2s infinite;
      }
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.8; }
      }
    `;
    document.head.appendChild(style);

    // Indicador de modo seleção
    const indicator = document.createElement('div');
    indicator.id = 'gm-selection-indicator';
    indicator.className = 'gm-selection-indicator';
    indicator.textContent = '🎯 Modo Seleção: Clique nas mensagens para selecionar';
    document.body.appendChild(indicator);
  }

  async function injectUI() {
    // Verificar se já existe para evitar duplicação
    if (document.getElementById('gm-floating-button')) {
      console.log('Labrego IA: Botão já existe');
      return;
    }

    console.log('Labrego IA: Criando botão flutuante...');

    const floatingButton = document.createElement('div');
    floatingButton.id = 'gm-floating-button';
    floatingButton.innerHTML = `
      <div class="gm-fab">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
      </div>
    `;
    document.body.appendChild(floatingButton);

    // Garantir que o botão está visível inicialmente
    floatingButton.style.position = 'fixed';
    floatingButton.style.bottom = '24px';
    floatingButton.style.left = '24px';
    floatingButton.style.zIndex = '99999';

    // Load saved position (pode sobrescrever a posição acima)
    await loadButtonPosition(floatingButton);

    // Setup drag functionality
    setupDraggable(floatingButton);

    console.log('Labrego IA: Botão criado com sucesso');

    const sidebar = document.createElement('div');
    sidebar.id = 'gm-sidebar';
    sidebar.innerHTML = getSidebarHTML();
    document.body.appendChild(sidebar);

    sidebar.addEventListener('click', (e) => e.stopPropagation());
    setupSidebarListeners();
  }

  function getSidebarHTML() {
    const logoUrl = chrome.runtime.getURL('assets/logo-branco.svg');
    return `
      <div class="gm-sidebar-header">
        <img src="${logoUrl}" alt="Labrego IA" class="gm-header-logo" />
        <div class="gm-header-actions">
          <button id="gm-toggle-position" class="gm-icon-btn" title="Mover para o outro lado">⇄</button>
          <button id="gm-close-sidebar" class="gm-icon-btn">×</button>
        </div>
      </div>

      <div class="gm-sidebar-content">
        <!-- Login -->
        <div id="gm-login-form" class="gm-section ${isAuthenticated ? 'hidden' : ''}">
          <h4>Entrar</h4>
          <input type="email" id="gm-email" placeholder="Email" class="gm-input" />
          <input type="password" id="gm-password" placeholder="Senha" class="gm-input" />
          <button id="gm-login-btn" class="gm-btn gm-btn-primary gm-btn-block">Entrar</button>
          <div id="gm-login-error" class="gm-error hidden"></div>
        </div>

        <!-- Conteúdo principal -->
        <div id="gm-main-content" class="${!isAuthenticated ? 'hidden' : ''}">
          <div class="gm-user-info">
            <span id="gm-user-name">${currentUser?.name || 'Usuário'}</span>
            <button id="gm-logout-btn" class="gm-btn gm-btn-secondary gm-btn-small">Sair</button>
          </div>

          <!-- Contato Detectado -->
          <div id="gm-contact-info" class="gm-section">
            <h4>Contato Atual</h4>
            <div id="gm-contact-details">
              <p class="gm-muted">Abra uma conversa...</p>
            </div>
            <button id="gm-get-phone-btn" class="gm-btn gm-btn-tertiary gm-btn-block gm-btn-sm">
              Buscar Telefone
            </button>
          </div>

          <!-- Tabs -->
          <div class="gm-tabs">
            <button id="gm-tab-contact" class="gm-tab active" data-tab="contact">
              Criar Contato
            </button>
            <button id="gm-tab-messages" class="gm-tab" data-tab="messages">
              Salvar Mensagens
            </button>
          </div>

          <!-- Tab: Criar Contato -->
          <div id="gm-tab-content-contact" class="gm-tab-content active">
            <div class="gm-section">
              <p class="gm-muted gm-mb-8">Salvar este contato na lista e enviar para uma etapa do funil</p>
              <label class="gm-label">Nome</label>
              <input type="text" id="gm-contact-name" placeholder="Nome do contato" class="gm-input" />
              <label class="gm-label">Telefone</label>
              <input type="tel" id="gm-contact-phone" placeholder="(00) 00000-0000" class="gm-input" />
              <label class="gm-label">Email (opcional)</label>
              <input type="email" id="gm-contact-email" placeholder="email@exemplo.com" class="gm-input" />
              <label class="gm-label">Tipo</label>
              <select id="gm-contact-type" class="gm-select">
                <option value="inbound" selected>Inbound</option>
                <option value="lead">Lead</option>
                <option value="cliente">Cliente</option>
                <option value="fornecedor">Fornecedor</option>
                <option value="parceiro">Parceiro</option>
              </select>
              <label class="gm-label">Etapa do Funil</label>
              <select id="gm-contact-stage" class="gm-select">
                <option value="">Selecione a etapa...</option>
              </select>
              <label class="gm-label">Observações</label>
              <textarea id="gm-contact-notes" placeholder="Anotações sobre o contato..." class="gm-input gm-textarea"></textarea>
              <button id="gm-create-contact-btn" class="gm-btn gm-btn-primary gm-btn-block">
                Criar Contato
              </button>
            </div>
          </div>

          <!-- Tab: Salvar Mensagens -->
          <div id="gm-tab-content-messages" class="gm-tab-content">
            <div class="gm-section">
              <p class="gm-muted gm-mb-8">Selecione mensagens e salve no histórico do contato atual</p>

              <!-- Info do contato onde será salvo -->
              <div id="gm-msg-contact-info" class="gm-info-box">
                <p class="gm-muted" style="margin: 0;">Abra uma conversa para salvar mensagens...</p>
              </div>

              <!-- Modo Seleção -->
              <div class="gm-btn-group gm-mb-8">
                <button id="gm-toggle-selection-btn" class="gm-btn gm-btn-primary gm-btn-sm" style="flex: 1;">
                  Modo Seleção
                </button>
                <button id="gm-select-all-btn" class="gm-btn gm-btn-tertiary gm-btn-sm" style="flex: 1;">
                  Selecionar Todas
                </button>
              </div>
              <p class="gm-muted" style="font-size: 11px;">
                Use "Modo Seleção" para clicar nas mensagens ou "Selecionar Todas" para toda a conversa
              </p>

              <!-- Mensagens Selecionadas -->
              <div id="gm-selected-messages-list" class="hidden gm-mt-12">
                <p id="gm-selected-count" class="gm-mb-8" style="font-weight: 600;"></p>
                <div id="gm-messages-preview" class="gm-msg-preview"></div>
                <div class="gm-btn-group gm-mt-12">
                  <button id="gm-copy-selected-btn" class="gm-btn gm-btn-secondary gm-btn-sm">Copiar</button>
                  <button id="gm-save-messages-btn" class="gm-btn gm-btn-success gm-btn-sm">Salvar no CRM</button>
                  <button id="gm-clear-selected-btn" class="gm-btn gm-btn-danger gm-btn-sm">Limpar</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="gm-sidebar-footer">
        <small>Plugin WhatsApp Labrego IA v1.0.0</small>
      </div>
    `;
  }

  function setupSidebarListeners() {
    document.getElementById('gm-close-sidebar')?.addEventListener('click', toggleSidebar);
    document.getElementById('gm-toggle-position')?.addEventListener('click', toggleSidebarPosition);
    document.getElementById('gm-login-btn')?.addEventListener('click', handleLogin);
    document.getElementById('gm-logout-btn')?.addEventListener('click', handleLogout);
    document.getElementById('gm-get-phone-btn')?.addEventListener('click', extractPhoneFromProfile);
    document.getElementById('gm-create-contact-btn')?.addEventListener('click', handleCreateContact);
    document.getElementById('gm-toggle-selection-btn')?.addEventListener('click', toggleSelectionMode);
    document.getElementById('gm-select-all-btn')?.addEventListener('click', selectAllMessages);
    document.getElementById('gm-copy-selected-btn')?.addEventListener('click', copySelectedMessages);
    document.getElementById('gm-save-messages-btn')?.addEventListener('click', saveMessagesToContact);
    document.getElementById('gm-clear-selected-btn')?.addEventListener('click', clearSelectedMessages);

    // Tabs
    document.getElementById('gm-tab-contact')?.addEventListener('click', () => switchTab('contact'));
    document.getElementById('gm-tab-messages')?.addEventListener('click', () => switchTab('messages'));

    // Carregar posição salva da sidebar
    loadSidebarPosition();

    // Detectar quando usuário está editando campos de contato
    const nameInput = document.getElementById('gm-contact-name');
    const phoneInput = document.getElementById('gm-contact-phone');

    nameInput?.addEventListener('focus', () => { fieldsBeingEdited.name = true; });
    nameInput?.addEventListener('blur', () => { fieldsBeingEdited.name = false; });
    nameInput?.addEventListener('input', () => { userModifiedFields.name = true; });

    phoneInput?.addEventListener('focus', () => { fieldsBeingEdited.phone = true; });
    phoneInput?.addEventListener('blur', () => { fieldsBeingEdited.phone = false; });
    phoneInput?.addEventListener('input', () => { userModifiedFields.phone = true; });

    if (isAuthenticated) loadFunnels();
  }

  function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.gm-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Update tab content
    document.querySelectorAll('.gm-tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `gm-tab-content-${tabName}`);
    });
  }

  function toggleSidebar() {
    const sidebar = document.getElementById('gm-sidebar');
    sidebarOpen = !sidebarOpen;
    sidebar.classList.toggle('open', sidebarOpen);
    if (sidebarOpen) detectCurrentContact();
  }

  // Carregar posição salva da sidebar
  async function loadSidebarPosition() {
    try {
      const result = await chrome.storage.local.get('gmSidebarPosition');
      if (result.gmSidebarPosition) {
        sidebarPosition = result.gmSidebarPosition;
        applySidebarPosition();
      }
    } catch (error) {
      console.log('Erro ao carregar posição da sidebar:', error);
    }
  }

  // Salvar posição da sidebar
  async function saveSidebarPosition() {
    try {
      await chrome.storage.local.set({ gmSidebarPosition: sidebarPosition });
    } catch (error) {
      console.log('Erro ao salvar posição da sidebar:', error);
    }
  }

  // Aplicar posição da sidebar
  function applySidebarPosition() {
    const sidebar = document.getElementById('gm-sidebar');
    if (!sidebar) return;

    if (sidebarPosition === 'left') {
      sidebar.classList.add('gm-sidebar-left');
    } else {
      sidebar.classList.remove('gm-sidebar-left');
    }
  }

  // Alternar posição da sidebar (esquerda/direita)
  function toggleSidebarPosition() {
    sidebarPosition = sidebarPosition === 'right' ? 'left' : 'right';
    applySidebarPosition();
    saveSidebarPosition();
    showNotification(`Painel movido para ${sidebarPosition === 'left' ? 'esquerda' : 'direita'}`, 'info');
  }

  // ========== DETECÇÃO DE CONTATO ==========

  // Verificar se um texto parece ser um número de telefone
  function isPhoneNumber(text) {
    if (!text) return false;
    const cleaned = text.replace(/[\s\-()]/g, '');
    // Se tem mais de 8 dígitos e é majoritariamente números, é um telefone
    const digitCount = (cleaned.match(/\d/g) || []).length;
    return digitCount >= 8 && digitCount / cleaned.length > 0.7;
  }

  // Buscar o "push name" (nome do perfil WhatsApp) nas mensagens recebidas
  function extractPushNameFromMessages() {
    // Buscar nas mensagens recebidas (message-in) o nome do remetente
    const messageContainers = document.querySelectorAll('[data-testid="msg-container"]');

    for (const container of messageContainers) {
      // Verificar se é mensagem recebida (não enviada por mim)
      const isIncoming = container.closest('.message-in') ||
                        !container.querySelector('[data-testid="msg-dblcheck"], [data-testid="msg-check"]');

      if (isIncoming) {
        // Buscar o nome do autor em mensagens de grupo ou o push name
        const authorEl = container.querySelector('[data-testid="author"]') ||
                        container.querySelector('span[dir="auto"].copyable-text');

        if (authorEl) {
          const authorName = authorEl.textContent?.trim();
          if (authorName && !isPhoneNumber(authorName) && authorName.length > 1) {
            return authorName;
          }
        }
      }
    }

    // Tentar buscar o push name no copyable-text das mensagens
    const copyableTexts = document.querySelectorAll('.message-in .copyable-text[data-pre-plain-text]');
    for (const el of copyableTexts) {
      const prePlainText = el.getAttribute('data-pre-plain-text');
      // Formato: [HH:MM, DD/MM/YYYY] Nome:
      const match = prePlainText?.match(/\]\s*([^:]+):/);
      if (match && match[1]) {
        const extractedName = match[1].trim();
        if (!isPhoneNumber(extractedName) && extractedName.length > 1) {
          return extractedName;
        }
      }
    }

    return null;
  }

  // Buscar o push name no drawer de informações do contato (painel direito)
  function extractPushNameFromDrawer() {
    // Tentar múltiplos seletores para o drawer
    const drawer = document.querySelector('[data-testid="drawer-right"]') ||
                   document.querySelector('[data-testid="contact-info"]') ||
                   document.querySelector('div[data-testid="chat-info-drawer"]') ||
                   document.querySelector('aside') ||
                   document.querySelector('span._ao3e'); // Fallback para estrutura do WhatsApp

    if (!drawer) {
      console.log('Labrego IA: Drawer não encontrado');
      return null;
    }

    console.log('Labrego IA: Drawer encontrado, buscando push name...');

    // MÉTODO 1: Buscar QUALQUER texto que começa com "~" em toda a página direita
    const allSpansInPage = document.querySelectorAll('span');
    for (const span of allSpansInPage) {
      const text = (span.textContent || '').trim();
      if (text && text.startsWith('~') && text.length > 1 && text.length < 50) {
        console.log('Labrego IA: Push name encontrado:', text);
        return text.substring(1).trim(); // Remove o ~ do início
      }
    }

    // MÉTODO 2: Buscar pelo title que começa com ~
    const spansWithTitle = document.querySelectorAll('span[title]');
    for (const span of spansWithTitle) {
      const title = span.getAttribute('title') || '';
      if (title.startsWith('~')) {
        console.log('Labrego IA: Push name encontrado via title:', title);
        return title.substring(1).trim();
      }
    }

    // MÉTODO 3: Buscar em seletores específicos do drawer
    const nameSelectors = [
      '[data-testid="contact-info-header"] span[dir="auto"]',
      '[data-testid="chat-info-drawer"] h2 span',
      'section span[dir="auto"]',
      'div[role="button"] span[dir="auto"]'
    ];

    for (const selector of nameSelectors) {
      const elements = drawer.querySelectorAll(selector);
      for (const el of elements) {
        const text = (el.getAttribute('title') || el.textContent || '').trim();
        // Ignorar se for telefone ou texto muito curto
        if (text && !isPhoneNumber(text) && text.length > 1) {
          // Se começa com ~, remover
          if (text.startsWith('~')) {
            return text.substring(1).trim();
          }
        }
      }
    }

    // MÉTODO 4: Buscar qualquer texto que não seja telefone, status ou label comum
    const ignoreTexts = ['pesquisar', 'adicionar', 'mídia', 'links', 'docs', 'mensagens',
                         'silenciar', 'privacidade', 'criptografia', 'bloquear', 'denunciar',
                         'favoritas', 'temporárias', 'avançada', 'desativada', 'desativadas',
                         'notas', 'cliente', 'comercial', 'conta', 'dados do contato'];

    const allTexts = drawer.querySelectorAll('span');
    for (const span of allTexts) {
      const text = (span.textContent || '').trim();
      const lower = text.toLowerCase();

      // Ignorar textos comuns da interface
      if (ignoreTexts.some(ignore => lower.includes(ignore))) continue;

      // Ignorar telefones
      if (isPhoneNumber(text)) continue;

      // Ignorar textos muito curtos ou muito longos
      if (text.length < 2 || text.length > 50) continue;

      // Se encontrou um texto válido que começa com ~
      if (text.startsWith('~')) {
        return text.substring(1).trim();
      }
    }

    console.log('Labrego IA: Push name não encontrado no drawer');
    return null;
  }

  function detectCurrentContact() {
    let name = null;
    let phone = null;
    let pushName = null; // Nome do perfil do WhatsApp

    // Textos que são STATUS/DESCRIÇÃO e devem ser ignorados (não são nomes de contato)
    const statusTexts = [
      'online', 'offline', 'digitando', 'typing', 'gravando', 'recording',
      'visto por último', 'last seen', 'clique para', 'click to', 'whatsapp',
      'disponível', 'available', 'ocupado', 'busy', 'outras empresas',
      'aberta', 'fechada', 'abre às', 'fecha às', 'horário de funcionamento',
      'responder pendência', 'ticket', 'bot', 'status', 'mensagem de saudação'
    ];

    function isStatusText(text) {
      if (!text) return true;
      const lower = text.toLowerCase().trim();
      // Se é muito curto e não parece número, provavelmente é status
      if (lower.length < 2 && !/\d/.test(lower)) return true;
      return statusTexts.some(s => lower.includes(s));
    }

    // MÉTODO 0: Buscar em qualquer header do #main (mais genérico)
    const mainEl = document.querySelector('#main');
    const headerEl = mainEl ? mainEl.querySelector('header') : null;

    if (headerEl) {
      // MÉTODO 1: Buscar o título principal da conversa (seletores específicos do WhatsApp - atualizados)
      const titleSelectors = [
        '[data-testid="conversation-info-header-chat-title"] span[title]',
        '[data-testid="conversation-header"] span[title]',
        '[data-testid="conversation-title"] span[title]',
        '[data-testid="contact-name"] span[title]',
        'header [role="button"] span[title]',
        'header span[dir="auto"][title]',
        'header span[title][aria-label]',
        // Novos seletores para versões mais recentes
        'header div[role="button"] span[dir="auto"]',
        'header section span[dir="auto"]',
        'header div[tabindex="-1"] span[dir="auto"]'
      ];

      for (const selector of titleSelectors) {
        const el = headerEl.querySelector(selector);
        if (el) {
          // Tentar pegar do atributo title primeiro, depois do textContent
          const text = (el.getAttribute('title') || el.textContent || '').trim();
          if (text && !isStatusText(text)) {
            name = text;
            break;
          }
        }
      }

      // MÉTODO 2: Se não encontrou, pegar o PRIMEIRO span[title] dentro do primeiro grupo clicável
      if (!name) {
        const clickableArea = headerEl.querySelector('[role="button"], [tabindex="0"], [tabindex="-1"]');
        if (clickableArea) {
          const firstSpan = clickableArea.querySelector('span[title], span[dir="auto"]');
          if (firstSpan) {
            const text = (firstSpan.getAttribute('title') || firstSpan.textContent || '').trim();
            if (text && !isStatusText(text)) {
              name = text;
            }
          }
        }
      }

      // MÉTODO 3: Pegar qualquer span com dir="auto" que tenha texto válido (muito comum no WhatsApp)
      if (!name) {
        const spans = headerEl.querySelectorAll('span[dir="auto"]');
        for (const span of spans) {
          const text = (span.getAttribute('title') || span.textContent || '').trim();
          if (text && text.length > 1 && !isStatusText(text)) {
            name = text;
            break;
          }
        }
      }

      // MÉTODO 4: Fallback - pegar todos os spans e filtrar
      if (!name) {
        const spans = headerEl.querySelectorAll('span[title]');
        for (const span of spans) {
          const text = (span.getAttribute('title') || '').trim();
          if (text && !isStatusText(text)) {
            name = text;
            break;
          }
        }
      }
    }

    // ========== EXTRAÇÃO DO TELEFONE ==========

    // MÉTODO 1: Se o nome for um número de telefone, usar ele como telefone
    if (name && isPhoneNumber(name)) {
      phone = name.replace(/[\s\-()]/g, '');
      if (!phone.startsWith('+')) {
        phone = '+' + phone;
      }

      // Se o nome é um telefone, tentar buscar o push name (nome real do perfil)
      pushName = extractPushNameFromDrawer() || extractPushNameFromMessages();

      // Se encontrou o push name, usar como nome
      if (pushName) {
        name = pushName;
      }
    } else if (name) {
      // Nome não é telefone, mas ainda precisamos extrair o telefone
      const phoneMatch = name.match(/\+?\d[\d\s\-()]{8,}/);
      if (phoneMatch) {
        phone = phoneMatch[0].replace(/[\s\-()]/g, '');
      }
    }

    // MÉTODO 2: Buscar data-id na conversa selecionada (contém telefone no formato 5511999999999@c.us)
    if (!phone) {
      // Buscar o item de conversa selecionado na lista lateral
      const selectedChat = document.querySelector('[data-testid="cell-frame-container"][aria-selected="true"]') ||
                          document.querySelector('[data-testid="list-item"][aria-selected="true"]') ||
                          document.querySelector('[role="listitem"][aria-selected="true"]');

      if (selectedChat) {
        // Buscar elemento com data-id que contém o número
        const chatWithId = selectedChat.closest('[data-id]') || selectedChat.querySelector('[data-id]');
        if (chatWithId) {
          const dataId = chatWithId.getAttribute('data-id');
          // Formato: 5511999999999@c.us ou true_5511999999999@c.us_...
          const idMatch = dataId?.match(/(\d{10,15})@/);
          if (idMatch) {
            phone = '+' + idMatch[1];
          }
        }
      }
    }

    // MÉTODO 3: Buscar data-id no #main (área principal da conversa)
    if (!phone && mainEl) {
      const conversationId = mainEl.querySelector('[data-id]');
      if (conversationId) {
        const dataId = conversationId.getAttribute('data-id');
        const idMatch = dataId?.match(/(\d{10,15})@/);
        if (idMatch) {
          phone = '+' + idMatch[1];
        }
      }
    }

    // MÉTODO 4: Buscar telefone em todo o header (pode estar na descrição ou subtítulo)
    if (!phone && headerEl) {
      const allText = headerEl.textContent || '';
      // Padrão brasileiro: +55 XX XXXXX-XXXX ou +55 XX XXXX-XXXX
      const phonePatterns = [
        /\+55\s?\d{2}\s?\d{4,5}[\s\-]?\d{4}/g,
        /\+\d{1,3}\s?\d{2,3}\s?\d{4,5}[\s\-]?\d{4}/g,
        /\(\d{2}\)\s?\d{4,5}[\s\-]?\d{4}/g
      ];

      for (const pattern of phonePatterns) {
        const matches = allText.match(pattern);
        if (matches && matches.length > 0) {
          phone = matches[0].replace(/[\s\-()]/g, '');
          break;
        }
      }
    }

    // MÉTODO 5: Buscar telefone no drawer de informações do contato (se aberto)
    if (!phone) {
      phone = extractPhoneFromDrawer();
    }

    // MÉTODO 6: Buscar na URL do WhatsApp Web (formato: /55119999999@c.us)
    if (!phone) {
      const urlMatch = window.location.href.match(/\/(\d{10,15})(@|%40)/);
      if (urlMatch) {
        phone = '+' + urlMatch[1];
      }
    }

    if (name) {
      // Detectar se o contato mudou
      const contactChanged = name !== lastDetectedContactName;

      // Atualizar o contato atual
      currentContact = { name, phone: phone || null };

      // Se o contato mudou, resetar flags e forçar atualização dos campos
      if (contactChanged) {
        lastDetectedContactName = name;
        // Resetar flags de modificação manual para o novo contato
        userModifiedFields.name = false;
        userModifiedFields.phone = false;
        updateContactDisplay(true); // true = forçar atualização
      } else {
        updateContactDisplay(false);
      }
    }
  }

  // Extrair telefone do drawer de informações do contato (apenas se drawer estiver aberto)
  function extractPhoneFromDrawer() {
    // Só buscar no drawer de informações do contato (painel direito), não em toda a página
    const drawer = document.querySelector('[data-testid="drawer-right"]');
    if (!drawer) return null;

    const phoneSelectors = [
      '[data-testid="contact-info-subtitle"]',
      'span[title*="+"]',
      'span[title]'
    ];

    for (const selector of phoneSelectors) {
      const elements = drawer.querySelectorAll(selector);
      for (const el of elements) {
        const text = el.getAttribute('title') || el.textContent || '';
        const phoneMatch = text.match(/\+?\d[\d\s\-()]{8,}/);
        if (phoneMatch) {
          return phoneMatch[0].replace(/[\s\-()]/g, '');
        }
      }
    }

    return null;
  }

  function extractPhoneFromProfile() {
    // Tentar encontrar o telefone e o nome do perfil no painel lateral de informações do contato
    let phone = null;
    let pushName = null;

    // Buscar QUALQUER texto que começa com "~" na página (push name)
    const allSpans = document.querySelectorAll('span');
    for (const span of allSpans) {
      const text = (span.textContent || '').trim();
      if (text && text.startsWith('~') && text.length > 1 && text.length < 50) {
        pushName = text.substring(1).trim(); // Remove o ~ do início
        console.log('Labrego IA: Push name encontrado:', pushName);
        break;
      }
    }

    // Buscar APENAS no drawer de informações do contato (painel direito)
    const drawer = document.querySelector('[data-testid="drawer-right"]') ||
                   document.querySelector('aside') ||
                   document.querySelector('[data-testid="contact-info"]');

    if (drawer) {
      const phoneSelectors = [
        '[data-testid="contact-info-subtitle"]',
        'span[title*="+"]',
        'span[title]'
      ];

      for (const selector of phoneSelectors) {
        const elements = drawer.querySelectorAll(selector);
        for (const el of elements) {
          const text = el.getAttribute('title') || el.textContent;
          const phoneMatch = text?.match(/\+?\d[\d\s\-()]{8,}/);
          if (phoneMatch) {
            phone = phoneMatch[0].replace(/[\s\-()]/g, '');
            break;
          }
        }
        if (phone) break;
      }
    }

    // Atualizar contato com telefone e/ou nome encontrado
    if (phone || pushName) {
      const updates = {};
      if (phone) updates.phone = phone;
      if (pushName && isPhoneNumber(currentContact?.name)) {
        updates.name = pushName; // Substituir número pelo nome real
      }
      currentContact = { ...currentContact, ...updates };
      updateContactDisplay(true);

      if (phone && pushName) {
        showNotification(`Telefone: ${phone} | Nome: ${pushName}`, 'success');
      } else if (phone) {
        showNotification(`Telefone encontrado: ${phone}`, 'success');
      } else if (pushName) {
        showNotification(`Nome encontrado: ${pushName}`, 'success');
      }
    } else {
      showNotification('Clique no nome do contato para abrir o perfil, depois tente novamente', 'warning');
    }
  }

  function updateContactDisplay(forceUpdate = false) {
    const detailsEl = document.getElementById('gm-contact-details');
    const nameInput = document.getElementById('gm-contact-name');
    const phoneInput = document.getElementById('gm-contact-phone');
    const msgContactInfo = document.getElementById('gm-msg-contact-info');

    if (!currentContact?.name) {
      detailsEl.innerHTML = '<p class="gm-muted">Abra uma conversa...</p>';
      if (msgContactInfo) {
        msgContactInfo.innerHTML = '<p class="gm-muted">Abra uma conversa para salvar mensagens...</p>';
      }
      return;
    }

    detailsEl.innerHTML = `
      <p><strong>Nome:</strong> ${currentContact.name}</p>
      <p><strong>Telefone:</strong> ${currentContact.phone || '<span class="gm-muted">Não detectado - clique em "Buscar Telefone"</span>'}</p>
    `;

    // Atualizar também a seção de mensagens
    if (msgContactInfo) {
      if (currentContact.phone) {
        msgContactInfo.innerHTML = `
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #4f46e5, #7C83FD); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">
              ${(currentContact.name || 'C')[0].toUpperCase()}
            </div>
            <div>
              <p style="margin: 0; font-weight: 600; color: #1E1E2F;">${currentContact.name}</p>
              <p style="margin: 0; font-size: 12px; color: #4b5563;">${currentContact.phone}</p>
            </div>
          </div>
        `;
      } else {
        msgContactInfo.innerHTML = `
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 40px; height: 40px; background: #e5e7eb; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #9ca3af; font-weight: bold;">
              ${(currentContact.name || 'C')[0].toUpperCase()}
            </div>
            <div>
              <p style="margin: 0; font-weight: 600; color: #1E1E2F;">${currentContact.name}</p>
              <p style="margin: 0; font-size: 12px; color: #fbbc05;">Telefone não detectado</p>
            </div>
          </div>
        `;
      }
    }

    // Só preencher automaticamente se:
    // 1. O campo está vazio, OU
    // 2. O contato mudou (forceUpdate) E o usuário não modificou manualmente o campo

    if (nameInput) {
      // Quando contato muda (forceUpdate), SEMPRE atualizar o nome
      if (forceUpdate) {
        nameInput.value = currentContact.name;
      } else if (!userModifiedFields.name && !fieldsBeingEdited.name) {
        // Atualização normal - só preencher se usuário não modificou e campo está vazio
        if (!nameInput.value.trim()) {
          nameInput.value = currentContact.name;
        }
      }
    }

    if (phoneInput) {
      // Quando contato muda (forceUpdate), SEMPRE atualizar o telefone
      if (forceUpdate) {
        phoneInput.value = currentContact.phone || '';
      } else if (currentContact.phone && !userModifiedFields.phone && !fieldsBeingEdited.phone) {
        // Atualização normal - só preencher se tem telefone e usuário não modificou
        if (!phoneInput.value.trim()) {
          phoneInput.value = currentContact.phone;
        }
      }
    }
  }

  // ========== SELEÇÃO DE MENSAGENS ==========

  function toggleSelectionMode() {
    selectionModeActive = !selectionModeActive;
    const btn = document.getElementById('gm-toggle-selection-btn');
    const indicator = document.getElementById('gm-selection-indicator');

    if (selectionModeActive) {
      document.body.classList.add('gm-selection-mode');
      btn.textContent = '❌ Desativar';
      btn.classList.remove('gm-btn-primary');
      btn.classList.add('gm-btn-danger');
      indicator.classList.add('active');

      // Adicionar listener de clique nas mensagens
      document.addEventListener('click', handleMessageClick, true);
      showNotification('Clique nas mensagens para selecionar', 'info');
    } else {
      document.body.classList.remove('gm-selection-mode');
      btn.textContent = '🎯 Modo Seleção';
      btn.classList.remove('gm-btn-danger');
      btn.classList.add('gm-btn-primary');
      indicator.classList.remove('active');

      document.removeEventListener('click', handleMessageClick, true);
    }
  }

  // Selecionar todas as mensagens da conversa
  function selectAllMessages() {
    // Limpar seleção anterior
    clearSelectedMessages();

    // Buscar todas as mensagens na conversa atual
    const mainEl = document.querySelector('#main');
    if (!mainEl) {
      showNotification('Abra uma conversa primeiro', 'error');
      return;
    }

    // Buscar todos os elementos de mensagem com data-id
    const messageElements = mainEl.querySelectorAll('[data-id]');

    if (messageElements.length === 0) {
      showNotification('Nenhuma mensagem encontrada na conversa', 'warning');
      return;
    }

    let selectedCount = 0;

    messageElements.forEach((msgEl, index) => {
      const msgId = msgEl.getAttribute('data-id');

      // Verificar se já está selecionada
      if (selectedMessages.some(m => m.id === msgId)) return;

      // Extrair dados da mensagem (passando índice para ordem)
      const msgData = extractMessageData(msgEl, index);
      if (msgData && msgData.text) {
        selectedMessages.push({ id: msgId, ...msgData });
        msgEl.classList.add('gm-message-selected');
        selectedCount++;
      }
    });

    // Ordenar mensagens por timestamp (mais antigas primeiro)
    selectedMessages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    updateSelectedMessagesUI();

    if (selectedCount > 0) {
      showNotification(`${selectedCount} mensagens selecionadas!`, 'success');
    } else {
      showNotification('Nenhuma mensagem com texto encontrada', 'warning');
    }
  }

  function handleMessageClick(e) {
    if (!selectionModeActive) return;

    // Encontrar o elemento de mensagem mais próximo
    const msgEl = e.target.closest('[data-id]');
    if (!msgEl) return;

    // Não interferir com cliques no sidebar
    if (e.target.closest('#gm-sidebar') || e.target.closest('#gm-floating-button')) return;

    e.preventDefault();
    e.stopPropagation();

    const msgId = msgEl.getAttribute('data-id');
    const isSelected = selectedMessages.some(m => m.id === msgId);

    if (isSelected) {
      // Remover seleção
      selectedMessages = selectedMessages.filter(m => m.id !== msgId);
      msgEl.classList.remove('gm-message-selected');
    } else {
      // Adicionar seleção
      const msgData = extractMessageData(msgEl);
      if (msgData) {
        selectedMessages.push({ id: msgId, ...msgData });
        msgEl.classList.add('gm-message-selected');
      }
    }

    updateSelectedMessagesUI();
  }

  function extractMessageData(msgEl, index = 0) {
    // Extrair dados da mensagem
    let text = '';
    let sender = 'Desconhecido';
    let time = '';
    let fullDateTime = null;
    let timestamp = null;
    let isFromMe = false;

    // Verificar se é mensagem enviada ou recebida
    const isOutgoing = msgEl.classList.contains('message-out') ||
                       msgEl.querySelector('[data-testid="msg-check"]') ||
                       msgEl.querySelector('[data-icon="msg-check"]') ||
                       msgEl.querySelector('[data-icon="msg-dblcheck"]');

    if (isOutgoing) {
      sender = 'Você';
      isFromMe = true;
    } else {
      // Tentar pegar o nome do remetente (em grupos)
      const senderEl = msgEl.querySelector('[data-testid="msg-container"] span[dir="auto"]');
      if (senderEl && senderEl.closest('[data-testid="msg-container"]')?.querySelector('[data-testid="author"]')) {
        sender = senderEl.textContent?.trim() || currentContact?.name || 'Contato';
      } else {
        sender = currentContact?.name || 'Contato';
      }
    }

    // Extrair texto da mensagem
    const textEl = msgEl.querySelector('.copyable-text span[dir], .selectable-text span');
    if (textEl) {
      text = textEl.textContent?.trim() || '';
    }

    // Extrair data e horário completos
    const copyableText = msgEl.querySelector('.copyable-text[data-pre-plain-text]');
    if (copyableText) {
      const preText = copyableText.getAttribute('data-pre-plain-text');
      // Formato: [HH:MM, DD/MM/YYYY] Nome:
      const dateTimeMatch = preText?.match(/\[(\d{1,2}:\d{2}),\s*(\d{1,2}\/\d{1,2}\/\d{4})\]/);
      if (dateTimeMatch) {
        time = dateTimeMatch[1]; // HH:MM
        const datePart = dateTimeMatch[2]; // DD/MM/YYYY
        fullDateTime = `${datePart} ${time}`;

        // Converter para timestamp para ordenação
        const [day, month, year] = datePart.split('/');
        const [hours, minutes] = time.split(':');
        timestamp = new Date(year, month - 1, day, hours, minutes).getTime();
      }
    }

    // Fallback: extrair apenas horário do meta
    if (!time) {
      const timeEl = msgEl.querySelector('[data-testid="msg-meta"] span');
      if (timeEl) {
        const timeMatch = timeEl.textContent?.trim()?.match(/\d{1,2}:\d{2}/);
        if (timeMatch) {
          time = timeMatch[0];
          // Usar data de hoje se não conseguiu extrair a data
          const today = new Date();
          const [hours, minutes] = time.split(':');
          timestamp = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hours, minutes).getTime();
          fullDateTime = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()} ${time}`;
        }
      }
    }

    // Fallback: usar data-id que contém timestamp
    if (!timestamp) {
      const dataId = msgEl.getAttribute('data-id');
      // data-id pode conter timestamp no formato: true_5511999999999@c.us_3EB0...._1704825600
      const tsMatch = dataId?.match(/_(\d{10,13})$/);
      if (tsMatch) {
        timestamp = parseInt(tsMatch[1]);
        // Se é timestamp em segundos, converter para milissegundos
        if (timestamp < 10000000000) {
          timestamp *= 1000;
        }
        const date = new Date(timestamp);
        time = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        fullDateTime = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()} ${time}`;
      }
    }

    // Último fallback: usar índice para manter ordem do DOM
    if (!timestamp) {
      timestamp = Date.now() + index;
    }

    if (!text) return null;

    return { text, sender, time, fullDateTime, timestamp, isFromMe, sortOrder: index };
  }

  function updateSelectedMessagesUI() {
    const listEl = document.getElementById('gm-selected-messages-list');
    const countEl = document.getElementById('gm-selected-count');
    const previewEl = document.getElementById('gm-messages-preview');

    if (selectedMessages.length === 0) {
      listEl.classList.add('hidden');
      return;
    }

    listEl.classList.remove('hidden');
    countEl.textContent = `${selectedMessages.length} mensagem(ns) selecionada(s)`;

    const previewHtml = selectedMessages.slice(0, 5).map(m => `
      <div class="gm-msg-item">
        <strong style="color: ${m.isFromMe ? '#4f46e5' : '#059669'}">${m.sender}</strong>
        ${m.time ? `<span style="color: #9ca3af; font-size: 11px; margin-left: 8px;">${m.time}</span>` : ''}
        <br/>
        <span style="color: #4b5563;">${truncate(m.text, 80)}</span>
      </div>
    `).join('');

    previewEl.innerHTML = previewHtml +
      (selectedMessages.length > 5 ? `<div class="gm-msg-more">+${selectedMessages.length - 5} mais...</div>` : '');
  }

  function clearSelectedMessages() {
    selectedMessages.forEach(m => {
      const el = document.querySelector(`[data-id="${m.id}"]`);
      if (el) el.classList.remove('gm-message-selected');
    });
    selectedMessages = [];
    updateSelectedMessagesUI();
    showNotification('Seleção limpa', 'info');
  }

  function copySelectedMessages() {
    if (selectedMessages.length === 0) {
      showNotification('Nenhuma mensagem selecionada', 'error');
      return;
    }

    const text = selectedMessages.map(m =>
      `[${m.time || '--:--'}] ${m.sender}: ${m.text}`
    ).join('\n\n');

    copyToClipboard(text);
    showNotification('Mensagens copiadas!', 'success');
  }

  async function saveMessagesToContact() {
    if (!isAuthenticated) {
      showNotification('Faça login primeiro!', 'error');
      scrollToLogin();
      return;
    }

    if (selectedMessages.length === 0) {
      showNotification('Selecione mensagens primeiro', 'error');
      return;
    }

    if (!currentContact?.phone) {
      showNotification('Telefone do contato não detectado. Clique em "Buscar Telefone" primeiro.', 'error');
      return;
    }

    const saveBtn = document.getElementById('gm-save-messages-btn');

    // Add loading state
    if (saveBtn) {
      saveBtn.classList.add('loading');
      saveBtn.disabled = true;
    }

    try {
      // Primeiro buscar o contato pelo telefone
      const searchResult = await sendMessage({
        type: 'SEARCH_CONTACT',
        payload: { phone: currentContact.phone }
      });

      if (!searchResult.success || !searchResult.contact) {
        showNotification('Contato não encontrado no CRM. Crie o contato primeiro na aba "Criar Contato".', 'warning');
        return;
      }

      const contactId = searchResult.contact.id;

      // Salvar mensagens no histórico/followup do contato
      // Ordenar por timestamp antes de enviar para manter ordem cronológica
      const sortedMessages = [...selectedMessages].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

      const result = await sendMessage({
        type: 'SAVE_MESSAGE',
        payload: {
          contactId: contactId,
          contactName: currentContact.name,
          contactPhone: currentContact.phone,
          messages: sortedMessages.map(m => ({
            text: m.text,
            sender: m.sender,
            timestamp: m.fullDateTime || m.time, // Data/hora formatada para exibição
            timestampMs: m.timestamp, // Timestamp em milissegundos para ordenação
            isFromMe: m.isFromMe
          }))
        }
      });

      if (result.success) {
        showNotification('Mensagens salvas no histórico do contato!', 'success');
        clearSelectedMessages();
      } else {
        handleApiError(result);
      }
    } catch (error) {
      console.error('Erro ao salvar mensagens:', error);
      showNotification(error.message || 'Erro ao salvar mensagens', 'error');
    } finally {
      // Remove loading state
      if (saveBtn) {
        saveBtn.classList.remove('loading');
        saveBtn.disabled = false;
      }
    }
  }

  async function saveSelectedMessages() {
    if (!isAuthenticated) {
      showNotification('Faça login primeiro!', 'error');
      scrollToLogin();
      return;
    }

    if (selectedMessages.length === 0) {
      showNotification('Selecione mensagens primeiro', 'error');
      return;
    }

    if (!currentContact?.name) {
      showNotification('Detecte o contato primeiro', 'error');
      return;
    }

    // Ordenar por timestamp antes de enviar
    const sortedMessages = [...selectedMessages].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    const result = await sendMessage({
      type: 'SAVE_MESSAGE',
      payload: {
        contactName: currentContact.name,
        contactPhone: currentContact.phone,
        messages: sortedMessages.map(m => ({
          text: m.text,
          sender: m.sender,
          timestamp: m.fullDateTime || m.time,
          timestampMs: m.timestamp,
          isFromMe: m.isFromMe
        }))
      }
    });

    if (result.success) {
      showNotification('Mensagens salvas no CRM!', 'success');
      clearSelectedMessages();
    } else {
      handleApiError(result);
    }
  }

  function handleApiError(result) {
    if (result.error?.includes('autenticado') || result.error?.includes('token') || result.error?.includes('unauthorized')) {
      isAuthenticated = false;
      document.getElementById('gm-login-form')?.classList.remove('hidden');
      document.getElementById('gm-main-content')?.classList.add('hidden');
      showNotification('Sessão expirada. Faça login novamente.', 'error');
    } else {
      showNotification(result.error || 'Erro na operação', 'error');
    }
  }

  function scrollToLogin() {
    const loginForm = document.getElementById('gm-login-form');
    const sidebar = document.getElementById('gm-sidebar');
    if (loginForm && sidebar) {
      loginForm.classList.remove('hidden');
      document.getElementById('gm-main-content')?.classList.add('hidden');
      loginForm.scrollIntoView({ behavior: 'smooth' });
    }
  }

  // ========== AUTENTICAÇÃO E CONTATOS ==========

  async function handleLogin() {
    const email = document.getElementById('gm-email').value;
    const password = document.getElementById('gm-password').value;
    const errorEl = document.getElementById('gm-login-error');
    const loginBtn = document.getElementById('gm-login-btn');

    if (!email || !password) {
      errorEl.textContent = 'Preencha todos os campos';
      errorEl.classList.remove('hidden');
      return;
    }

    // Add loading state
    if (loginBtn) {
      loginBtn.classList.add('loading');
      loginBtn.disabled = true;
    }

    try {
      const result = await sendMessage({ type: 'LOGIN', payload: { email, password } });

      if (result && result.success) {
        isAuthenticated = true;
        currentUser = result.user;
        document.getElementById('gm-login-form').classList.add('hidden');
        document.getElementById('gm-main-content').classList.remove('hidden');
        document.getElementById('gm-user-name').textContent = currentUser?.name || 'Usuário';
        loadFunnels();
        detectCurrentContact();
      } else {
        errorEl.textContent = result?.error || 'Erro ao fazer login';
        errorEl.classList.remove('hidden');
      }
    } catch (error) {
      console.error('Login error:', error);
      errorEl.textContent = error.message || 'Erro de conexão. Recarregue a página e tente novamente.';
      errorEl.classList.remove('hidden');
    } finally {
      // Remove loading state
      if (loginBtn) {
        loginBtn.classList.remove('loading');
        loginBtn.disabled = false;
      }
    }
  }

  async function handleLogout() {
    await sendMessage({ type: 'LOGOUT' });
    isAuthenticated = false;
    currentUser = null;
    document.getElementById('gm-login-form').classList.remove('hidden');
    document.getElementById('gm-main-content').classList.add('hidden');
  }

  async function loadFunnels() {
    const stageSelect = document.getElementById('gm-contact-stage');

    // Carregar etapas diretamente para o formulário de contato
    if (stageSelect) {
      stageSelect.innerHTML = '<option value="">Carregando etapas...</option>';

      const stagesResult = await sendMessage({ type: 'GET_COLUMNS', payload: { funnelId: 'default' } });

      if (stagesResult.success && stagesResult.columns && stagesResult.columns.length > 0) {
        const optionsHtml = stagesResult.columns.map(stage =>
          `<option value="${stage.id}">${stage.name}</option>`
        ).join('');
        stageSelect.innerHTML = '<option value="">Selecione a etapa do funil...</option>' + optionsHtml;
      } else if (stagesResult.error) {
        stageSelect.innerHTML = '<option value="">Erro ao carregar etapas</option>';
        console.error('Erro ao carregar etapas:', stagesResult.error);
      } else {
        stageSelect.innerHTML = '<option value="">Nenhuma etapa encontrada</option>';
      }
    }
  }

  async function handleCreateContact() {
    if (!isAuthenticated) {
      showNotification('Faça login primeiro!', 'error');
      scrollToLogin();
      return;
    }

    const name = document.getElementById('gm-contact-name').value;
    const phone = document.getElementById('gm-contact-phone').value;
    const email = document.getElementById('gm-contact-email').value;
    const type = document.getElementById('gm-contact-type').value;
    const stageId = document.getElementById('gm-contact-stage').value;
    const notes = document.getElementById('gm-contact-notes').value;
    const createBtn = document.getElementById('gm-create-contact-btn');

    if (!name) {
      showNotification('Preencha o nome', 'error');
      return;
    }

    // Add loading state
    if (createBtn) {
      createBtn.classList.add('loading');
      createBtn.disabled = true;
    }

    try {
      const result = await sendMessage({
        type: 'CREATE_CONTACT',
        payload: { name, phone, email, contactType: type, columnId: stageId, notes, origem: 'whatsapp' }
      });

      if (result.success) {
        showNotification('Contato criado!', 'success');
        document.getElementById('gm-contact-name').value = '';
        document.getElementById('gm-contact-phone').value = '';
        document.getElementById('gm-contact-email').value = '';
        document.getElementById('gm-contact-notes').value = '';
        // Resetar flags de modificação manual para próximo contato
        userModifiedFields.name = false;
        userModifiedFields.phone = false;
      } else {
        handleApiError(result);
      }
    } finally {
      // Remove loading state
      if (createBtn) {
        createBtn.classList.remove('loading');
        createBtn.disabled = false;
      }
    }
  }

  async function handleCreateQuickLead() {
    if (!isAuthenticated) {
      showNotification('Faça login primeiro!', 'error');
      scrollToLogin();
      return;
    }

    if (!currentContact?.name) {
      showNotification('Detecte o contato primeiro', 'error');
      return;
    }

    const result = await sendMessage({
      type: 'CREATE_LEAD',
      payload: { name: currentContact.name, phone: currentContact.phone, origem: 'whatsapp' }
    });

    if (result.success) {
      showNotification('Lead criado!', 'success');
    } else {
      handleApiError(result);
    }
  }

  // ========== UTILITÁRIOS ==========

  function handleKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'g') {
      e.preventDefault();
      toggleSidebar();
    }
    // ESC para sair do modo seleção
    if (e.key === 'Escape' && selectionModeActive) {
      toggleSelectionMode();
    }
  }

  chrome.runtime.onMessage.addListener((message) => {
    switch (message.type) {
      case 'TOGGLE_SIDEBAR':
        toggleSidebar();
        break;
    }
  });

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).catch(() => {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    });
  }

  function truncate(str, length) {
    if (!str) return '';
    return str.length <= length ? str : str.substring(0, length) + '...';
  }

  function showNotification(message, type = 'info') {
    document.querySelectorAll('.gm-notification').forEach(n => n.remove());
    const notification = document.createElement('div');
    notification.className = `gm-notification gm-notification-${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.classList.add('show'), 100);
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
