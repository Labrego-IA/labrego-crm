# Documentacao Tecnica — Labrego CRM

**Data:** 09/03/2026 | **Versao:** 1.0.0 | **Desenvolvido por:** Labrego IA

---

## 1. Stack Tecnologica

| Camada | Tecnologia | Versao |
|--------|-----------|--------|
| Framework | Next.js (App Router) | 15.5.9 |
| UI | React | 18.3.1 |
| Linguagem | TypeScript | — |
| Banco de Dados | Firebase Firestore | 12.2.1 |
| Admin SDK | Firebase Admin | 13.4.0 |
| Autenticacao | Firebase Auth | 12.2.1 |
| Editor | TipTap (rich text) | 3.15.3 |
| Email | Nodemailer + React Email | 7.0.5 |
| PDF | jsPDF + autotable | 3.0.2 |
| ZIP | JSZip | 3.10.1 |
| Drag & Drop | @hello-pangea/dnd | 18.0.1 |
| Google APIs | googleapis | 132.0.0 |
| Icones | Lucide React + Heroicons | — |
| CSS | Tailwind CSS + @tailwindcss/typography | — |
| Screenshots | html2canvas-pro | 1.6.7 |

---

## 2. Banco de Dados (Firestore)

| Collection | Descricao |
|-----------|-----------|
| `contacts` | Contatos do CRM |
| `deals` | Negocios/pipeline |
| `companies` | Empresas (multi-tenant) |
| `activities` | Atividades e interacoes |
| `calls` | Registro de chamadas |
| `emails` | Emails enviados |
| `templates` | Templates de email |
| `users` | Usuarios do sistema |

---

## 3. Editor TipTap

O CRM inclui editor de email rico com:
- Formatacao de texto (negrito, italico, sublinhado)
- Cores e destaque
- Imagens e links
- Bubble menu contextual
- Placeholder inteligente

---

## 4. Variaveis de Ambiente

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

---

## 5. Deploy

```bash
npm run build
npm start
```

---

*Labrego IA — Documentacao Tecnica Labrego CRM v1.0*
