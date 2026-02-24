# Gestão Mundo - WhatsApp Chrome Extension

Extensão do Chrome para integrar o WhatsApp Web com o CRM Gestão Mundo. Permite copiar mensagens e criar contatos diretamente no sistema sem sair do WhatsApp.

## Funcionalidades

- **Criar Contatos**: Crie contatos diretamente do WhatsApp Web
- **Salvar Mensagens**: Selecione e salve mensagens como atividades no CRM
- **Copiar Conversas**: Copie conversas inteiras para a área de transferência
- **Criar Leads Rápido**: Transforme contatos em leads com um clique
- **Busca de Contatos**: Verifica automaticamente se o contato já existe no CRM

## Instalação

### Passo 1: Gerar os Ícones

1. Abra o arquivo `icons/generate-icons.html` no navegador
2. Baixe os 4 ícones gerados (icon16.png, icon32.png, icon48.png, icon128.png)
3. Substitua os arquivos na pasta `icons/`

Ou execute com Node.js (requer canvas):
```bash
npm install canvas
node scripts/generate-icons.js
```

### Passo 2: Carregar no Chrome

1. Abra o Chrome e vá para `chrome://extensions/`
2. Ative o **Modo do desenvolvedor** (canto superior direito)
3. Clique em **Carregar sem compactação**
4. Selecione a pasta `chrome-extension`

### Passo 3: Configurar URL do CRM

1. Clique no ícone da extensão
2. Em Configurações, insira a URL do seu CRM
3. Faça login com suas credenciais do Gestão Mundo

## Como Usar

### Na página do WhatsApp Web:

1. **Botão Flutuante**: Clique no botão verde no canto inferior direito para abrir o painel
2. **Atalho de Teclado**: `Ctrl/Cmd + Shift + G` para abrir/fechar o painel

### Funcionalidades Disponíveis:

#### Criar Contato
1. Abra uma conversa no WhatsApp
2. Clique no botão flutuante para abrir o painel
3. Os dados do contato são preenchidos automaticamente
4. Complete as informações e clique em "Criar Contato"

#### Salvar Mensagens
1. Passe o mouse sobre as mensagens na conversa
2. Clique no seletor que aparece ao lado esquerdo de cada mensagem
3. As mensagens selecionadas aparecem no painel
4. Clique em "Salvar no CRM" para registrar como atividade

#### Criar Lead Rápido
1. Abra uma conversa
2. Clique em "Criar Lead Rápido" no painel
3. O lead é criado automaticamente no funil de WhatsApp

## Endpoints da API

A extensão utiliza os seguintes endpoints:

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/extension/auth` | POST | Autenticação |
| `/api/extension/contacts` | GET/POST | Gerenciar contatos |
| `/api/extension/contacts/search` | GET | Buscar contato por telefone |
| `/api/extension/messages` | POST | Salvar mensagens |
| `/api/extension/funnels` | GET | Listar funis |
| `/api/extension/leads` | POST | Criar leads |

## Configuração do Servidor

Adicione a variável de ambiente para o JWT:

```env
EXTENSION_JWT_SECRET=sua-chave-secreta-aqui
```

## Desenvolvimento

### Estrutura de Arquivos

```
chrome-extension/
├── manifest.json           # Configuração da extensão
├── background/
│   └── background.js       # Service worker
├── content/
│   ├── content.js          # Script injetado no WhatsApp
│   └── content.css         # Estilos do painel
├── popup/
│   ├── popup.html          # Interface do popup
│   ├── popup.css           # Estilos do popup
│   └── popup.js            # Lógica do popup
├── icons/
│   ├── icon.svg            # Ícone fonte
│   └── generate-icons.html # Gerador de ícones
└── scripts/
    └── generate-icons.js   # Script Node para gerar ícones
```

### Recarregar a Extensão

Após fazer alterações:
1. Vá para `chrome://extensions/`
2. Clique no botão de atualizar na extensão
3. Recarregue a página do WhatsApp Web

## Troubleshooting

### Extensão não aparece no WhatsApp Web
- Verifique se está na URL correta: `https://web.whatsapp.com`
- Recarregue a página após instalar a extensão

### Erro de autenticação
- Verifique se o servidor está rodando
- Confirme que a URL do CRM está correta nas configurações
- Tente fazer logout e login novamente

### Mensagens não são salvas
- Verifique sua conexão com a internet
- Confirme que está autenticado na extensão
- Verifique os logs do console (F12 > Console)

## Licença

Uso interno - Gestão Mundo
