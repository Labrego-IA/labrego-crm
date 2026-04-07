export default function PrivacidadePage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold text-slate-800 mb-8">Politica de Privacidade</h1>

      <div className="prose prose-slate max-w-none space-y-6 text-sm text-slate-600 leading-relaxed">
        <p>Ultima atualizacao: Abril de 2026</p>

        <h2 className="text-lg font-semibold text-slate-800 mt-8">1. Coleta de Dados</h2>
        <p>
          Coletamos informacoes que voce nos fornece diretamente ao criar sua conta e utilizar nossos servicos,
          incluindo: nome, email, telefone, dados da empresa, e informacoes de contatos que voce cadastra no CRM.
        </p>

        <h2 className="text-lg font-semibold text-slate-800 mt-8">2. Uso dos Dados</h2>
        <p>Utilizamos seus dados para:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Fornecer e manter nossos servicos de CRM</li>
          <li>Processar atendimentos automaticos via agentes de IA (WhatsApp e Email)</li>
          <li>Enviar comunicacoes relacionadas ao servico</li>
          <li>Melhorar e personalizar sua experiencia</li>
          <li>Processar pagamentos e gerenciar sua assinatura</li>
        </ul>

        <h2 className="text-lg font-semibold text-slate-800 mt-8">3. Agentes de IA e Processamento</h2>
        <p>
          Quando voce ativa os agentes de IA, as mensagens recebidas sao processadas por modelos de inteligencia
          artificial (OpenAI) para gerar respostas automaticas. O conteudo das conversas e armazenado de forma
          segura e isolada por organizacao, acessivel apenas pelos membros autorizados da sua equipe.
        </p>

        <h2 className="text-lg font-semibold text-slate-800 mt-8">4. Compartilhamento de Dados</h2>
        <p>Nao vendemos seus dados. Compartilhamos informacoes apenas com:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Provedores de infraestrutura (Firebase/Google Cloud) para armazenamento</li>
          <li>Provedores de IA (OpenAI) para processamento de mensagens</li>
          <li>Provedores de pagamento (Stripe) para cobrancas</li>
          <li>Provedores de comunicacao (Z-API, ElevenLabs) para envio de mensagens e audio</li>
        </ul>

        <h2 className="text-lg font-semibold text-slate-800 mt-8">5. Seguranca</h2>
        <p>
          Implementamos medidas tecnicas e organizacionais para proteger seus dados, incluindo:
          criptografia em transito (HTTPS), isolamento de dados por organizacao, controle de acesso
          baseado em papeis (RBAC), e logs de auditoria.
        </p>

        <h2 className="text-lg font-semibold text-slate-800 mt-8">6. Seus Direitos (LGPD)</h2>
        <p>Conforme a Lei Geral de Protecao de Dados (Lei 13.709/2018), voce tem direito a:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Confirmar a existencia de tratamento de seus dados</li>
          <li>Acessar seus dados pessoais</li>
          <li>Corrigir dados incompletos ou desatualizados</li>
          <li>Solicitar anonimizacao ou eliminacao de dados desnecessarios</li>
          <li>Solicitar portabilidade dos dados</li>
          <li>Revogar consentimento a qualquer momento</li>
        </ul>

        <h2 className="text-lg font-semibold text-slate-800 mt-8">7. Retencao de Dados</h2>
        <p>
          Mantemos seus dados enquanto sua conta estiver ativa. Apos o encerramento da conta,
          os dados sao retidos por 90 dias para fins de backup e conformidade legal, apos os quais
          sao permanentemente excluidos.
        </p>

        <h2 className="text-lg font-semibold text-slate-800 mt-8">8. Contato</h2>
        <p>
          Para exercer seus direitos ou esclarecer duvidas sobre esta politica, entre em contato
          pelo email: <a href="mailto:privacidade@labrego.com.br" className="text-cyan-600 hover:underline">privacidade@labrego.com.br</a>
        </p>
      </div>
    </div>
  )
}
