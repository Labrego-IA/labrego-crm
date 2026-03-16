'use client'

import { useState } from 'react'
import {
  UserGroupIcon,
  FunnelIcon,
  PhoneArrowUpRightIcon,
  UsersIcon,
  PresentationChartLineIcon,
  CreditCardIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  TagIcon,
  CurrencyDollarIcon,
  ClockIcon,
  BookOpenIcon,
  EnvelopeIcon,
  QuestionMarkCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline'
import {
  MixerHorizontalIcon,
  BarChartIcon,
  LightningBoltIcon,
  TargetIcon,
  ActivityLogIcon,
} from '@radix-ui/react-icons'

interface GuideSection {
  id: string
  title: string
  icon: JSX.Element
  color: string
  summary: string
  details: string[]
  tips?: string[]
}

const moduleSections: GuideSection[] = [
  {
    id: 'contatos',
    title: 'Gestao de Contatos',
    icon: <UserGroupIcon className="w-6 h-6" />,
    color: 'bg-blue-500',
    summary:
      'Aqui e onde ficam todos os seus contatos — as pessoas e empresas que voce conversa no dia a dia do seu trabalho.',
    details: [
      'Voce pode cadastrar novos contatos com nome, email, telefone e outras informacoes.',
      'Da pra buscar e filtrar seus contatos por nome, status, responsavel e muito mais.',
      'Cada contato tem uma ficha completa onde voce ve todo o historico: anotacoes, ligacoes, emails e em qual etapa do funil ele esta.',
      'Voce pode importar contatos de uma planilha Excel ou exportar a lista completa.',
      'E possivel transferir um contato para outro membro da equipe quando necessario.',
    ],
    tips: [
      'Use os filtros para achar rapidinho quem voce procura.',
      'Clique no nome do contato para ver todos os detalhes dele.',
      'Mantenha as informacoes sempre atualizadas para nao perder oportunidades!',
    ],
  },
  {
    id: 'funil',
    title: 'Funis de Vendas',
    icon: <MixerHorizontalIcon className="w-6 h-6" />,
    color: 'bg-cyan-500',
    summary:
      'O funil e como um caminho que o cliente percorre desde o primeiro contato ate fechar negocio. Aqui voce acompanha cada etapa desse caminho.',
    details: [
      'Os contatos aparecem como cartoes que voce pode arrastar entre as etapas (colunas) do funil.',
      'Cada etapa representa um momento diferente: primeiro contato, proposta enviada, negociacao, fechado, etc.',
      'Voce pode ter varios funis diferentes — por exemplo, um para vendas e outro para pos-venda.',
      'Ao clicar num cartao, voce ve os detalhes do contato e pode adicionar anotacoes ou agendar tarefas.',
    ],
    tips: [
      'Arraste os cartoes entre as colunas conforme o cliente avanca no processo.',
      'Mantenha o funil organizado — isso ajuda voce a saber exatamente o que precisa fazer a seguir.',
    ],
  },
  {
    id: 'produtividade',
    title: 'Produtividade',
    icon: <ActivityLogIcon className="w-6 h-6" />,
    color: 'bg-violet-500',
    summary:
      'Essa pagina mostra o quanto voce e sua equipe estao produzindo. E como um "placar" do desempenho de cada um.',
    details: [
      'Voce ve quantos contatos foram movidos no funil, quantas ligacoes foram feitas e outras atividades.',
      'Da pra comparar o desempenho entre os membros da equipe.',
      'Tem graficos e numeros que mostram a evolucao ao longo do tempo.',
      'Ajuda a identificar quem pode precisar de ajuda e quem esta arrasando.',
    ],
    tips: [
      'Use essa pagina para acompanhar suas metas semanais ou mensais.',
      'Se voce e gestor, aqui e o lugar certo para ver como o time esta indo.',
    ],
  },
  {
    id: 'conversao',
    title: 'Conversao do Funil',
    icon: <FunnelIcon className="w-6 h-6" />,
    color: 'bg-emerald-500',
    summary:
      'Aqui voce descobre quantos dos seus contatos realmente avancam e fecham negocio. E o "raio-x" do seu funil.',
    details: [
      'Mostra a porcentagem de contatos que passam de uma etapa para outra.',
      'Voce consegue ver onde esta "travando" — ou seja, em qual etapa os contatos param e nao avancam.',
      'Tem graficos visuais que facilitam entender os numeros.',
      'Da pra filtrar por periodo, funil especifico e outros criterios.',
    ],
    tips: [
      'Se uma etapa tem conversao muito baixa, pode ser hora de repensar a abordagem naquele momento.',
      'Acompanhe esses numeros toda semana para ir melhorando aos poucos.',
    ],
  },
  {
    id: 'analytics',
    title: 'Analises & Insights',
    icon: <BarChartIcon className="w-6 h-6" />,
    color: 'bg-amber-500',
    summary:
      'Essa e a pagina dos graficos e relatorios mais completos. Aqui voce tem uma visao geral de como o negocio esta indo.',
    details: [
      'Graficos de barras, linhas e pizza mostram os dados de formas diferentes.',
      'Voce ve tendencias — por exemplo, se as vendas estao subindo ou caindo.',
      'Da pra analisar por periodo (semana, mes, trimestre) e por equipe ou membro.',
      'Tem indicadores importantes como ticket medio, tempo medio de fechamento e taxa de conversao.',
    ],
    tips: [
      'Venha aqui pelo menos uma vez por semana para nao perder nenhuma tendencia importante.',
      'Use os filtros de data para comparar periodos diferentes.',
    ],
  },
  {
    id: 'projecao',
    title: 'Projecao de Vendas',
    icon: <PresentationChartLineIcon className="w-6 h-6" />,
    color: 'bg-rose-500',
    summary:
      'Aqui o sistema tenta prever quanto voce vai vender nos proximos meses, com base no que ja esta no funil.',
    details: [
      'Mostra uma estimativa de receita futura baseada nos negocios em andamento.',
      'Cada negocio tem uma probabilidade de fechar, e o sistema calcula o valor esperado.',
      'Voce consegue ver se esta no caminho certo para bater suas metas.',
      'Ajuda a planejar o mes e o trimestre com mais seguranca.',
    ],
    tips: [
      'Quanto mais atualizado o funil, mais precisa sera a projecao.',
      'Use essa pagina para apresentar previsoes em reunioes de equipe.',
    ],
  },
  {
    id: 'automacoes',
    title: 'Automacoes IA',
    icon: <LightningBoltIcon className="w-6 h-6" />,
    color: 'bg-purple-500',
    summary:
      'Essa area esta sendo preparada! Em breve voce vai poder criar automacoes inteligentes que fazem tarefas repetitivas por voce.',
    details: [
      'A ideia e que o sistema faca coisas automaticamente — como enviar um email quando um contato entra no funil.',
      'Vai ter reengajamento automatico: o sistema tenta reconectar com contatos que ficaram parados.',
      'Voce vai poder criar regras tipo "se o contato nao respondeu em 3 dias, enviar lembrete".',
      'Tudo isso usando inteligencia artificial para ser mais esperto e personalizado.',
    ],
    tips: [
      'Fique de olho! Essa funcionalidade vai economizar muito tempo quando estiver pronta.',
    ],
  },
  {
    id: 'campanhas',
    title: 'Campanhas',
    icon: <TargetIcon className="w-6 h-6" />,
    color: 'bg-teal-500',
    summary:
      'Aqui voce cria e envia campanhas de email para varios contatos de uma vez. Perfeito para divulgar novidades, ofertas ou manter contato.',
    details: [
      'Voce pode criar uma campanha do zero ou usar um modelo pronto.',
      'Da pra escolher exatamente quais contatos vao receber o email.',
      'Tem um editor visual onde voce monta o email do jeito que quiser.',
      'Depois de enviar, voce acompanha quantas pessoas abriram, clicaram e responderam.',
    ],
    tips: [
      'Use os templates prontos para agilizar — depois e so personalizar.',
      'Sempre confira o email antes de enviar para muitas pessoas!',
    ],
  },
]

const agentSections: GuideSection[] = [
  {
    id: 'agente-config',
    title: 'Configuracao do Agente',
    icon: <Cog6ToothIcon className="w-6 h-6" />,
    color: 'bg-indigo-500',
    summary:
      'Aqui voce configura o seu agente de voz com IA — um assistente virtual que pode fazer ligacoes por voce!',
    details: [
      'Voce escolhe a voz, o tom e o jeito que o agente vai falar.',
      'Da pra definir o roteiro: o que o agente deve dizer em cada situacao.',
      'Voce configura integracao com calendario para que o agente possa agendar reunioes.',
      'Tem um passo a passo bem simples para montar tudo.',
    ],
    tips: [
      'Comece com um roteiro simples e va ajustando conforme os resultados.',
      'Teste o agente antes de colocar para ligar de verdade.',
    ],
  },
  {
    id: 'disparo',
    title: 'Disparo Massivo',
    icon: <PhoneArrowUpRightIcon className="w-6 h-6" />,
    color: 'bg-orange-500',
    summary:
      'Essa pagina e para disparar ligacoes em grande quantidade usando o agente de voz. Ideal para campanhas de contato.',
    details: [
      'Voce seleciona uma lista de contatos para serem ligados.',
      'O agente de IA faz as ligacoes automaticamente, uma por uma.',
      'Voce acompanha em tempo real quantas ligacoes foram feitas e o resultado de cada uma.',
      'Cada ligacao fica registrada para voce ouvir depois se quiser.',
    ],
    tips: [
      'Comece com lotes pequenos para testar o resultado antes de disparar para muita gente.',
      'Preste atencao nos horarios — ligar em horario comercial tem muito mais resultado.',
    ],
  },
  {
    id: 'historico',
    title: 'Historico de Ligacoes',
    icon: <ClockIcon className="w-6 h-6" />,
    color: 'bg-slate-500',
    summary:
      'Aqui fica o registro de todas as ligacoes feitas pelo agente de voz. E como um diario de chamadas.',
    details: [
      'Voce ve a lista completa de ligacoes com data, hora e duracao.',
      'Da pra ouvir a gravacao de cada ligacao.',
      'Mostra se a ligacao foi atendida, nao atendida, ocupada etc.',
      'Voce pode filtrar por data, contato ou resultado.',
    ],
    tips: [
      'Ouca as gravacoes para entender como o agente esta se saindo e melhorar o roteiro.',
    ],
  },
]

const adminSections: GuideSection[] = [
  {
    id: 'usuarios',
    title: 'Usuarios',
    icon: <UsersIcon className="w-6 h-6" />,
    color: 'bg-blue-600',
    summary:
      'Aqui voce gerencia quem tem acesso ao sistema. Pode convidar novas pessoas, definir cargos e controlar permissoes.',
    details: [
      'Voce convida novos membros pelo email — eles recebem um convite para entrar.',
      'Cada pessoa pode ter um cargo diferente: administrador, gerente, vendedor ou apenas visualizador.',
      'Voce controla o que cada pessoa pode ver e fazer no sistema.',
      'Da pra desativar o acesso de alguem quando necessario.',
    ],
    tips: [
      'De acesso de administrador apenas para quem realmente precisa.',
      'Mantenha a lista de usuarios atualizada quando alguem sair da equipe.',
    ],
  },
  {
    id: 'email-config',
    title: 'Email',
    icon: <EnvelopeIcon className="w-6 h-6" />,
    color: 'bg-pink-500',
    summary:
      'Aqui voce configura o provedor de email que o sistema vai usar para enviar mensagens e campanhas.',
    details: [
      'Voce conecta a conta de email da empresa (Gmail, Outlook etc.).',
      'Depois de conectar, o sistema consegue enviar emails em nome da empresa.',
      'E necessario para que as campanhas e automacoes funcionem corretamente.',
    ],
    tips: [
      'Use um email profissional (nao pessoal) para manter tudo organizado.',
    ],
  },
  {
    id: 'funis-admin',
    title: 'Funis',
    icon: <FunnelIcon className="w-6 h-6" />,
    color: 'bg-cyan-600',
    summary:
      'Aqui voce cria e configura os funis de vendas. Voce decide quais etapas cada funil vai ter.',
    details: [
      'Voce pode criar novos funis para diferentes processos (vendas, pos-venda, suporte etc.).',
      'Cada funil tem etapas personalizaveis — voce define o nome e a ordem de cada uma.',
      'Da pra reorganizar, renomear ou remover etapas conforme sua necessidade.',
    ],
    tips: [
      'Comece com poucas etapas e adicione mais conforme sentir necessidade.',
      'Nomes claros nas etapas ajudam toda a equipe a entender o processo.',
    ],
  },
  {
    id: 'icp',
    title: 'Perfis ICP',
    icon: <TagIcon className="w-6 h-6" />,
    color: 'bg-lime-600',
    summary:
      'ICP significa "Perfil do Cliente Ideal". Aqui voce define como e o tipo de cliente que mais combina com o seu negocio.',
    details: [
      'Voce cria perfis descrevendo caracteristicas do cliente ideal: tamanho da empresa, area de atuacao, regiao etc.',
      'Isso ajuda a equipe a focar nos contatos que tem mais chance de fechar negocio.',
      'Os perfis podem ser usados para filtrar e priorizar contatos automaticamente.',
    ],
    tips: [
      'Pense nos seus melhores clientes atuais — o que eles tem em comum? Esse e o seu ICP!',
    ],
  },
  {
    id: 'centros-custo',
    title: 'Centros de Custo',
    icon: <CurrencyDollarIcon className="w-6 h-6" />,
    color: 'bg-yellow-600',
    summary:
      'Aqui voce organiza os centros de custo para acompanhar de onde vem e para onde vai o dinheiro.',
    details: [
      'Voce cria categorias para organizar receitas e despesas.',
      'Isso ajuda a entender quais areas ou projetos estao dando mais resultado.',
      'Os centros de custo podem ser associados a contatos e negocios.',
    ],
    tips: [
      'Mantenha os nomes simples e padronizados para facilitar os relatorios.',
    ],
  },
  {
    id: 'propostas',
    title: 'Propostas',
    icon: <DocumentTextIcon className="w-6 h-6" />,
    color: 'bg-emerald-600',
    summary:
      'Aqui voce configura tudo relacionado a propostas comerciais: marca, produtos, layout e campos personalizados.',
    details: [
      'Na aba de marca, voce coloca o logo e as cores da empresa para as propostas ficarem com a sua cara.',
      'Na aba de produtos, voce cadastra os servicos e produtos que aparecem nas propostas.',
      'Voce pode personalizar a estrutura do PDF e adicionar campos extras conforme sua necessidade.',
      'Tudo isso faz com que as propostas geradas fiquem profissionais e padronizadas.',
    ],
    tips: [
      'Cadastre seus produtos com precos atualizados para agilizar a criacao de propostas.',
      'Mantenha a identidade visual atualizada para passar profissionalismo.',
    ],
  },
  {
    id: 'creditos',
    title: 'Creditos',
    icon: <CreditCardIcon className="w-6 h-6" />,
    color: 'bg-red-500',
    summary:
      'Aqui voce ve quantos creditos (acoes e minutos) sua empresa ainda tem disponiveis e o historico de uso.',
    details: [
      'Os creditos sao usados para funcionalidades como ligacoes com IA e automacoes.',
      'Voce ve o saldo atual e todo o historico de consumo.',
      'Quando os creditos estiverem acabando, o sistema avisa para voce nao ficar sem.',
    ],
    tips: [
      'Fique de olho no saldo — quando os creditos acabam, algumas funcionalidades param de funcionar.',
    ],
  },
  {
    id: 'estrategia',
    title: 'Estrategia Comercial',
    icon: <BookOpenIcon className="w-6 h-6" />,
    color: 'bg-fuchsia-500',
    summary:
      'Aqui voce define e organiza as estrategias comerciais da sua equipe, com templates prontos para diferentes situacoes.',
    details: [
      'Voce cria modelos de abordagem para diferentes tipos de clientes ou situacoes.',
      'A equipe pode consultar essas estrategias para padronizar o atendimento.',
      'Ajuda todo mundo a falar a mesma lingua e seguir o mesmo processo.',
    ],
    tips: [
      'Atualize as estrategias conforme voce descobre o que funciona melhor.',
    ],
  },
  {
    id: 'plano',
    title: 'Meu Plano',
    icon: <Cog6ToothIcon className="w-6 h-6" />,
    color: 'bg-gray-600',
    summary:
      'Aqui voce ve qual plano sua empresa esta usando e quais funcionalidades estao disponiveis.',
    details: [
      'Mostra o plano atual (gratuito, basico, pro ou enterprise).',
      'Voce ve o que cada plano oferece e pode comparar as opcoes.',
      'Se precisar de mais recursos, da pra solicitar uma mudanca de plano.',
    ],
    tips: [
      'Confira se o plano atual atende suas necessidades — as vezes vale a pena fazer upgrade.',
    ],
  },
]

function GuideCard({ section }: { section: GuideSection }) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-6 flex items-start gap-4"
      >
        <div className={`${section.color} w-12 h-12 rounded-xl flex items-center justify-center text-white flex-shrink-0 shadow-sm`}>
          {section.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-slate-800 mb-1.5">{section.title}</h3>
          <p className="text-base text-slate-600 leading-relaxed">{section.summary}</p>
        </div>
        <div className="flex-shrink-0 mt-1">
          {expanded ? (
            <ChevronUpIcon className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDownIcon className="w-5 h-5 text-slate-400" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-6 pb-6 pt-0">
          <div className="border-t border-slate-100 pt-4">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">Como funciona:</h4>
            <ul className="space-y-2.5 mb-4">
              {section.details.map((detail, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-slate-600 leading-relaxed">
                  <span className="w-2 h-2 rounded-full bg-[#13DEFC] flex-shrink-0 mt-1.5" />
                  {detail}
                </li>
              ))}
            </ul>

            {section.tips && section.tips.length > 0 && (
              <div className="bg-amber-50 border border-amber-200/60 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-amber-800 mb-2">Dicas:</h4>
                <ul className="space-y-1.5">
                  {section.tips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-amber-700 leading-relaxed">
                      <span className="flex-shrink-0">💡</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function GuiaPage() {
  return (
    <div className="w-full px-4 sm:px-6 lg:px-10 py-8">
      {/* Header */}
      <div className="mb-12">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#13DEFC] to-[#09B00F] flex items-center justify-center shadow-lg">
            <QuestionMarkCircleIcon className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Guia do Voxium</h1>
            <p className="text-base text-slate-500">Entenda tudo sobre cada pagina do sistema</p>
          </div>
        </div>
        <div className="bg-gradient-to-r from-[#13DEFC]/10 to-[#09B00F]/10 rounded-2xl p-6 border border-[#13DEFC]/20">
          <p className="text-base text-slate-700 leading-relaxed">
            Bem-vindo ao guia do Voxium! Aqui voce vai encontrar uma explicacao simples e direta de cada parte do sistema.
            Clique em qualquer secao para expandir ou recolher os detalhes.
            Nao se preocupe com termos tecnicos — explicamos tudo de um jeito facil de entender! 😊
          </p>
        </div>
      </div>

      {/* Módulos Principais */}
      <div className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-1.5 h-7 rounded-full bg-[#13DEFC]" />
          <h2 className="text-xl font-bold text-slate-800">Modulos Principais</h2>
        </div>
        <p className="text-base text-slate-500 mb-6 ml-4">
          Essas sao as ferramentas do dia a dia. E aqui que voce vai passar a maior parte do tempo.
        </p>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {moduleSections.map((section) => (
            <GuideCard key={section.id} section={section} />
          ))}
        </div>
      </div>

      {/* Agentes de Voz */}
      <div className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-1.5 h-7 rounded-full bg-[#09B00F]" />
          <h2 className="text-xl font-bold text-slate-800">Agentes de Voz (IA)</h2>
        </div>
        <p className="text-base text-slate-500 mb-6 ml-4">
          Aqui fica tudo relacionado ao assistente virtual que faz ligacoes por voce usando inteligencia artificial.
        </p>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {agentSections.map((section) => (
            <GuideCard key={section.id} section={section} />
          ))}
        </div>
      </div>

      {/* Administração */}
      <div className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-1.5 h-7 rounded-full bg-amber-500" />
          <h2 className="text-xl font-bold text-slate-800">Administracao</h2>
        </div>
        <p className="text-base text-slate-500 mb-6 ml-4">
          Essa area e mais para quem cuida das configuracoes do sistema. Se voce e administrador ou gestor, aqui e onde voce ajusta tudo.
        </p>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {adminSections.map((section) => (
            <GuideCard key={section.id} section={section} />
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-8 border-t border-slate-200/60">
        <p className="text-sm text-slate-400">
          Ficou com duvida? Fale com o suporte da sua empresa ou com o administrador do sistema.
        </p>
      </div>
    </div>
  )
}
