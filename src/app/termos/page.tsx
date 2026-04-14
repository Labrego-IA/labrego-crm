export default function TermosPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-8">Termos de Uso</h1>

      <div className="prose prose-slate max-w-none space-y-6 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
        <p>Ultima atualizacao: Abril de 2026</p>

        <h2 className="text-lg font-semibold text-slate-800 dark:text-white mt-8">1. Aceite dos Termos</h2>
        <p>
          Ao acessar e utilizar a plataforma Voxium CRM, voce concorda com estes Termos de Uso.
          Se voce nao concordar, nao utilize o servico.
        </p>

        <h2 className="text-lg font-semibold text-slate-800 dark:text-white mt-8">2. Descricao do Servico</h2>
        <p>
          O Voxium CRM e uma plataforma SaaS de gestao de relacionamento com clientes que inclui:
          gestao de contatos, funis de vendas, campanhas de email, agentes de IA para atendimento
          automatico via WhatsApp e Email, e ferramentas de analise.
        </p>

        <h2 className="text-lg font-semibold text-slate-800 dark:text-white mt-8">3. Conta e Responsabilidade</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>Voce e responsavel por manter a seguranca de sua conta e senha</li>
          <li>Voce e responsavel por todas as atividades realizadas em sua conta</li>
          <li>Voce deve fornecer informacoes verdadeiras e atualizadas</li>
          <li>E proibido compartilhar credenciais de acesso</li>
        </ul>

        <h2 className="text-lg font-semibold text-slate-800 dark:text-white mt-8">4. Uso Aceitavel</h2>
        <p>Voce concorda em nao utilizar o servico para:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Enviar spam ou mensagens nao solicitadas em massa</li>
          <li>Violar leis ou regulamentos aplicaveis</li>
          <li>Armazenar conteudo ilegal ou ofensivo</li>
          <li>Tentar acessar dados de outras organizacoes</li>
          <li>Interferir no funcionamento da plataforma</li>
        </ul>

        <h2 className="text-lg font-semibold text-slate-800 dark:text-white mt-8">5. Agentes de IA</h2>
        <p>
          Os agentes de IA sao ferramentas de assistencia e nao substituem o julgamento humano.
          Voce e responsavel por configurar adequadamente o agente, revisar suas respostas,
          e garantir que o atendimento automatico esteja em conformidade com as leis aplicaveis.
        </p>

        <h2 className="text-lg font-semibold text-slate-800 dark:text-white mt-8">6. Planos e Pagamento</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>Os planos sao cobrados mensalmente via Stripe</li>
          <li>Creditos de acoes e minutos sao renovados a cada ciclo</li>
          <li>Creditos nao utilizados nao sao acumulados</li>
          <li>O cancelamento pode ser feito a qualquer momento</li>
        </ul>

        <h2 className="text-lg font-semibold text-slate-800 dark:text-white mt-8">7. Propriedade Intelectual</h2>
        <p>
          A plataforma, incluindo codigo, design, marca e documentacao, e propriedade da Labrego Solucoes.
          Voce mantem a propriedade de todos os dados que insere na plataforma.
        </p>

        <h2 className="text-lg font-semibold text-slate-800 dark:text-white mt-8">8. Limitacao de Responsabilidade</h2>
        <p>
          A plataforma e fornecida &ldquo;como esta&rdquo;. Nao garantimos disponibilidade ininterrupta
          ou ausencia de erros. Nao somos responsaveis por danos indiretos resultantes do uso do servico.
        </p>

        <h2 className="text-lg font-semibold text-slate-800 dark:text-white mt-8">9. Contato</h2>
        <p>
          Duvidas sobre estes termos podem ser enviadas para:{' '}
          <a href="mailto:suporte@labrego.com.br" className="text-cyan-600 hover:underline">suporte@labrego.com.br</a>
        </p>
      </div>
    </div>
  )
}
