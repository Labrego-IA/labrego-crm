'use client'

import Image from 'next/image'

/* ─── BRAND TOKENS ─── */
const brand = {
  primary: {
    name: 'Violet',
    hex: '#8B5CF6',
    rgb: '139, 92, 246',
    usage: 'Botoes principais, links, elementos de destaque',
  },
  primaryDark: {
    name: 'Deep Violet',
    hex: '#6D28D9',
    rgb: '109, 40, 217',
    usage: 'Hover states, headers, enfase',
  },
  primaryLight: {
    name: 'Soft Violet',
    hex: '#C4B5FD',
    rgb: '196, 181, 253',
    usage: 'Backgrounds suaves, badges, tags',
  },
  secondary: {
    name: 'Electric Cyan',
    hex: '#06B6D4',
    rgb: '6, 182, 212',
    usage: 'Acoes secundarias, indicadores, dados',
  },
  secondaryLight: {
    name: 'Light Cyan',
    hex: '#67E8F9',
    rgb: '103, 232, 249',
    usage: 'Highlights, notificacoes, status ativo',
  },
  accent: {
    name: 'Orchid',
    hex: '#C084FC',
    rgb: '192, 132, 252',
    usage: 'CTAs especiais, promos, gamificacao',
  },
  dark: {
    name: 'Deep Navy',
    hex: '#1E1B4B',
    rgb: '30, 27, 75',
    usage: 'Textos principais, backgrounds escuros',
  },
  darkMid: {
    name: 'Indigo Dark',
    hex: '#312E81',
    rgb: '49, 46, 129',
    usage: 'Sidebar, cards escuros, footers',
  },
  surface: {
    name: 'Ghost White',
    hex: '#F5F3FF',
    rgb: '245, 243, 255',
    usage: 'Background principal light mode',
  },
  surfaceMid: {
    name: 'Lavender Mist',
    hex: '#EDE9FE',
    rgb: '237, 233, 254',
    usage: 'Cards, containers, separadores',
  },
  textPrimary: {
    name: 'Charcoal',
    hex: '#1E1B4B',
    rgb: '30, 27, 75',
    usage: 'Headings, texto principal',
  },
  textSecondary: {
    name: 'Slate',
    hex: '#64748B',
    rgb: '100, 116, 139',
    usage: 'Texto secundario, labels, captions',
  },
  success: {
    name: 'Emerald',
    hex: '#10B981',
    rgb: '16, 185, 129',
    usage: 'Sucesso, confirmacao, ganhos',
  },
  warning: {
    name: 'Amber',
    hex: '#F59E0B',
    rgb: '245, 158, 11',
    usage: 'Alertas, atencao, pendencias',
  },
  error: {
    name: 'Rose',
    hex: '#EF4444',
    rgb: '239, 68, 68',
    usage: 'Erros, exclusao, perda',
  },
}

const gradients = [
  {
    name: 'Brand Signature',
    css: 'linear-gradient(135deg, #8B5CF6 0%, #06B6D4 100%)',
    tailwind: 'bg-gradient-to-br from-[#8B5CF6] to-[#06B6D4]',
    usage: 'Logo, headers, hero sections',
  },
  {
    name: 'Purple Depth',
    css: 'linear-gradient(135deg, #6D28D9 0%, #8B5CF6 50%, #C084FC 100%)',
    tailwind: 'bg-gradient-to-br from-[#6D28D9] via-[#8B5CF6] to-[#C084FC]',
    usage: 'Cards premium, banners, CTAs',
  },
  {
    name: 'Cyber Glow',
    css: 'linear-gradient(135deg, #312E81 0%, #06B6D4 100%)',
    tailwind: 'bg-gradient-to-br from-[#312E81] to-[#06B6D4]',
    usage: 'Dark mode surfaces, sidebar, dashboards',
  },
  {
    name: 'Frost',
    css: 'linear-gradient(135deg, #EDE9FE 0%, #CFFAFE 100%)',
    tailwind: 'bg-gradient-to-br from-[#EDE9FE] to-[#CFFAFE]',
    usage: 'Light mode backgrounds, cards suaves',
  },
]

const typography = {
  fontFamily: {
    primary: 'Inter',
    fallback: 'system-ui, -apple-system, sans-serif',
  },
  scale: [
    { name: 'Display', size: '3rem / 48px', weight: '800 (ExtraBold)', tracking: '-0.025em', usage: 'Hero headlines, pagina de login' },
    { name: 'H1', size: '2.25rem / 36px', weight: '700 (Bold)', tracking: '-0.025em', usage: 'Titulos de pagina' },
    { name: 'H2', size: '1.875rem / 30px', weight: '700 (Bold)', tracking: '-0.02em', usage: 'Secoes principais' },
    { name: 'H3', size: '1.5rem / 24px', weight: '600 (SemiBold)', tracking: '-0.015em', usage: 'Subsecoes, cards' },
    { name: 'H4', size: '1.25rem / 20px', weight: '600 (SemiBold)', tracking: '-0.01em', usage: 'Titulos menores' },
    { name: 'Body Large', size: '1.125rem / 18px', weight: '400 (Regular)', tracking: '0', usage: 'Texto de destaque' },
    { name: 'Body', size: '1rem / 16px', weight: '400 (Regular)', tracking: '0', usage: 'Texto padrao' },
    { name: 'Body Small', size: '0.875rem / 14px', weight: '400 (Regular)', tracking: '0', usage: 'Labels, captions' },
    { name: 'Caption', size: '0.75rem / 12px', weight: '500 (Medium)', tracking: '0.025em', usage: 'Metadata, badges, hints' },
    { name: 'Overline', size: '0.625rem / 10px', weight: '600 (SemiBold)', tracking: '0.1em', usage: 'Tags, categorias (UPPERCASE)' },
  ],
}

const spacing = [
  { token: 'xs', value: '4px', usage: 'Padding interno de badges/tags' },
  { token: 'sm', value: '8px', usage: 'Gap entre icones e texto' },
  { token: 'md', value: '16px', usage: 'Padding de cards e botoes' },
  { token: 'lg', value: '24px', usage: 'Margem entre secoes' },
  { token: 'xl', value: '32px', usage: 'Espacamento entre blocos' },
  { token: '2xl', value: '48px', usage: 'Margem de pagina' },
  { token: '3xl', value: '64px', usage: 'Hero sections, separadores grandes' },
]

const borderRadius = [
  { token: 'sm', value: '6px', usage: 'Badges, tags, inputs' },
  { token: 'md', value: '8px', usage: 'Botoes, dropdowns' },
  { token: 'lg', value: '12px', usage: 'Cards, modais' },
  { token: 'xl', value: '16px', usage: 'Cards maiores, containers' },
  { token: '2xl', value: '24px', usage: 'Hero cards, glass panels' },
  { token: 'full', value: '9999px', usage: 'Avatares, pills, chips' },
]

const shadows = [
  { name: 'Subtle', css: '0 1px 3px rgba(30,27,75,0.06)', usage: 'Cards em repouso' },
  { name: 'Medium', css: '0 4px 12px rgba(30,27,75,0.1)', usage: 'Cards em hover, dropdowns' },
  { name: 'Elevated', css: '0 8px 30px rgba(30,27,75,0.15)', usage: 'Modais, popovers' },
  { name: 'Glow Violet', css: '0 0 20px rgba(139,92,246,0.3)', usage: 'Botao primario hover' },
  { name: 'Glow Cyan', css: '0 0 20px rgba(6,182,212,0.3)', usage: 'Elementos interativos hover' },
]

/* ─── COLOR SWATCH COMPONENT ─── */
function ColorSwatch({ color, size = 'normal' }: { color: { name: string; hex: string; rgb: string; usage: string }; size?: 'normal' | 'large' }) {
  const isLarge = size === 'large'
  return (
    <div className={`group ${isLarge ? 'col-span-2 sm:col-span-1' : ''}`}>
      <div
        className={`${isLarge ? 'h-32' : 'h-20'} rounded-xl border border-white/20 shadow-sm transition-all duration-200 group-hover:scale-[1.02] group-hover:shadow-md`}
        style={{ backgroundColor: color.hex }}
      />
      <div className="mt-2">
        <p className="text-sm font-semibold text-[#1E1B4B]">{color.name}</p>
        <p className="text-xs font-mono text-[#64748B]">{color.hex}</p>
        <p className="text-xs font-mono text-[#64748B]">rgb({color.rgb})</p>
        <p className="text-[11px] text-[#94A3B8] mt-1">{color.usage}</p>
      </div>
    </div>
  )
}

/* ─── SECTION HEADER ─── */
function SectionHeader({ number, title, subtitle }: { number: string; title: string; subtitle: string }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-2">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-[#8B5CF6] to-[#06B6D4] text-white text-sm font-bold">
          {number}
        </span>
        <h2 className="text-2xl font-bold text-[#1E1B4B]">{title}</h2>
      </div>
      <p className="text-[#64748B] text-sm ml-11">{subtitle}</p>
    </div>
  )
}

/* ─── MAIN PAGE ─── */
export default function BrandBookPage() {
  return (
    <div className="min-h-screen bg-[#F5F3FF]">
      {/* HERO */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#1E1B4B] via-[#312E81] to-[#1E1B4B]">
        <div className="absolute inset-0">
          <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-[#8B5CF6]/20 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-20%] left-[-10%] w-[400px] h-[400px] bg-[#06B6D4]/15 rounded-full blur-[120px]" />
        </div>
        <div className="relative max-w-6xl mx-auto px-6 py-16">
          <div className="flex flex-col items-center text-center">
            <Image src="/logo-voxium.png" alt="Voxium" width={200} height={133} className="object-contain mb-8" />
            <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-4">
              Brand Book
            </h1>
            <p className="text-lg text-white/60 max-w-xl">
              Guia de identidade visual da marca Voxium. Cores, tipografia, espacamentos e estilo para manter consistencia em todos os pontos de contato.
            </p>
            <div className="flex items-center gap-2 mt-6 text-xs text-white/40">
              <span className="px-2 py-1 rounded-full border border-white/10 bg-white/5">v1.0</span>
              <span>Abril 2026</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-12 space-y-16">

        {/* ═══ 1. LOGO ═══ */}
        <section>
          <SectionHeader number="1" title="Logo" subtitle="Variacoes aprovadas e regras de uso do logo Voxium" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Dark background */}
            <div className="rounded-2xl bg-[#1E1B4B] p-8 flex items-center justify-center border border-[#312E81]">
              <Image src="/logo-voxium.png" alt="Logo em fundo escuro" width={180} height={120} className="object-contain" />
            </div>
            {/* Light background */}
            <div className="rounded-2xl bg-white p-8 flex items-center justify-center border border-[#EDE9FE]">
              <Image src="/logo-voxium.png" alt="Logo em fundo claro" width={180} height={120} className="object-contain" />
            </div>
            {/* Gradient background */}
            <div className="rounded-2xl bg-gradient-to-br from-[#8B5CF6] to-[#06B6D4] p-8 flex items-center justify-center">
              <Image src="/logo-voxium.png" alt="Logo em fundo gradiente" width={180} height={120} className="object-contain" />
            </div>
          </div>

          {/* Logo rules */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-xl bg-white border border-[#EDE9FE] p-6">
              <h4 className="text-sm font-semibold text-[#10B981] mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#10B981]/10 flex items-center justify-center text-xs">✓</span>
                Uso Correto
              </h4>
              <ul className="space-y-2 text-sm text-[#64748B]">
                <li>• Area de respiro minima: 20% da largura do logo em cada lado</li>
                <li>• Tamanho minimo: 80px de largura para digital</li>
                <li>• Usar sempre sobre fundos escuros, claros ou gradientes da marca</li>
                <li>• Manter proporcoes originais (nao distorcer)</li>
              </ul>
            </div>
            <div className="rounded-xl bg-white border border-[#EDE9FE] p-6">
              <h4 className="text-sm font-semibold text-[#EF4444] mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#EF4444]/10 flex items-center justify-center text-xs">✕</span>
                Uso Incorreto
              </h4>
              <ul className="space-y-2 text-sm text-[#64748B]">
                <li>• Nao alterar as cores do logo</li>
                <li>• Nao rotacionar ou inclinar</li>
                <li>• Nao colocar sobre fundos com pouco contraste</li>
                <li>• Nao adicionar sombras, bordas ou efeitos extras</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ═══ 2. PALETA DE CORES ═══ */}
        <section>
          <SectionHeader number="2" title="Paleta de Cores" subtitle="Sistema de cores baseado no gradiente roxo-ciano do logo" />

          {/* Primary & Secondary */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-[#1E1B4B] mb-4 uppercase tracking-wider">Cores Principais</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
              <ColorSwatch color={brand.primary} size="large" />
              <ColorSwatch color={brand.primaryDark} />
              <ColorSwatch color={brand.primaryLight} />
              <ColorSwatch color={brand.secondary} size="large" />
              <ColorSwatch color={brand.secondaryLight} />
              <ColorSwatch color={brand.accent} />
            </div>
          </div>

          {/* Neutrals & Dark */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-[#1E1B4B] mb-4 uppercase tracking-wider">Neutros & Escuros</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
              <ColorSwatch color={brand.dark} />
              <ColorSwatch color={brand.darkMid} />
              <ColorSwatch color={brand.surface} />
              <ColorSwatch color={brand.surfaceMid} />
              <ColorSwatch color={brand.textPrimary} />
              <ColorSwatch color={brand.textSecondary} />
            </div>
          </div>

          {/* Semantic */}
          <div>
            <h3 className="text-sm font-semibold text-[#1E1B4B] mb-4 uppercase tracking-wider">Cores Semanticas</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <ColorSwatch color={brand.success} />
              <ColorSwatch color={brand.warning} />
              <ColorSwatch color={brand.error} />
            </div>
          </div>
        </section>

        {/* ═══ 3. GRADIENTES ═══ */}
        <section>
          <SectionHeader number="3" title="Gradientes" subtitle="Gradientes da marca derivados do logo para uso em interfaces" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {gradients.map((g) => (
              <div key={g.name} className="rounded-xl overflow-hidden border border-[#EDE9FE]">
                <div className="h-24" style={{ background: g.css }} />
                <div className="bg-white p-4">
                  <p className="text-sm font-semibold text-[#1E1B4B]">{g.name}</p>
                  <p className="text-xs font-mono text-[#64748B] mt-1">{g.css}</p>
                  <p className="text-xs font-mono text-[#94A3B8] mt-0.5">{g.tailwind}</p>
                  <p className="text-[11px] text-[#94A3B8] mt-2">{g.usage}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ═══ 4. TIPOGRAFIA ═══ */}
        <section>
          <SectionHeader number="4" title="Tipografia" subtitle="Sistema tipografico baseado na fonte Inter com escala modular" />

          <div className="rounded-xl bg-white border border-[#EDE9FE] p-6 mb-6">
            <div className="flex items-baseline gap-4 mb-4">
              <span className="text-5xl font-extrabold bg-gradient-to-r from-[#8B5CF6] to-[#06B6D4] bg-clip-text text-transparent">
                Aa
              </span>
              <div>
                <p className="text-lg font-bold text-[#1E1B4B]">{typography.fontFamily.primary}</p>
                <p className="text-sm text-[#64748B]">{typography.fontFamily.fallback}</p>
              </div>
            </div>
            <p className="text-sm text-[#64748B] font-mono">
              ABCDEFGHIJKLMNOPQRSTUVWXYZ<br />
              abcdefghijklmnopqrstuvwxyz<br />
              0123456789 !@#$%&*()
            </p>
          </div>

          {/* Type scale */}
          <div className="rounded-xl bg-white border border-[#EDE9FE] overflow-hidden">
            <div className="grid grid-cols-[140px_1fr_200px] gap-4 p-4 bg-[#F5F3FF] border-b border-[#EDE9FE] text-xs font-semibold text-[#64748B] uppercase tracking-wider">
              <span>Token</span>
              <span>Preview</span>
              <span>Specs</span>
            </div>
            {typography.scale.map((t) => {
              const sizeNum = parseFloat(t.size.split('rem')[0])
              const weightNum = parseInt(t.weight.split(' ')[0])
              return (
                <div key={t.name} className="grid grid-cols-[140px_1fr_200px] gap-4 p-4 border-b border-[#EDE9FE] last:border-0 items-center">
                  <div>
                    <p className="text-sm font-semibold text-[#1E1B4B]">{t.name}</p>
                    <p className="text-[11px] text-[#94A3B8]">{t.usage}</p>
                  </div>
                  <p
                    className="text-[#1E1B4B] truncate"
                    style={{
                      fontSize: `${Math.min(sizeNum, 2)}rem`,
                      fontWeight: weightNum,
                      letterSpacing: t.tracking,
                    }}
                  >
                    Voxium CRM
                  </p>
                  <div className="text-xs text-[#64748B] space-y-0.5">
                    <p className="font-mono">{t.size}</p>
                    <p>{t.weight}</p>
                    <p className="font-mono">tracking: {t.tracking}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* ═══ 5. ESPACAMENTO & BORDER RADIUS ═══ */}
        <section>
          <SectionHeader number="5" title="Espacamento & Formas" subtitle="Tokens de espacamento e border radius para consistencia visual" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Spacing */}
            <div className="rounded-xl bg-white border border-[#EDE9FE] p-6">
              <h3 className="text-sm font-semibold text-[#1E1B4B] mb-4">Espacamento</h3>
              <div className="space-y-3">
                {spacing.map((s) => (
                  <div key={s.token} className="flex items-center gap-3">
                    <div
                      className="h-4 bg-gradient-to-r from-[#8B5CF6] to-[#06B6D4] rounded-sm shrink-0"
                      style={{ width: s.value }}
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-mono font-semibold text-[#1E1B4B]">{s.token}</span>
                      <span className="text-xs text-[#64748B] ml-2">({s.value})</span>
                    </div>
                    <span className="text-[11px] text-[#94A3B8] hidden sm:block">{s.usage}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Border Radius */}
            <div className="rounded-xl bg-white border border-[#EDE9FE] p-6">
              <h3 className="text-sm font-semibold text-[#1E1B4B] mb-4">Border Radius</h3>
              <div className="space-y-3">
                {borderRadius.map((r) => (
                  <div key={r.token} className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 bg-gradient-to-br from-[#8B5CF6]/20 to-[#06B6D4]/20 border-2 border-[#8B5CF6] shrink-0"
                      style={{ borderRadius: r.value }}
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-mono font-semibold text-[#1E1B4B]">{r.token}</span>
                      <span className="text-xs text-[#64748B] ml-2">({r.value})</span>
                    </div>
                    <span className="text-[11px] text-[#94A3B8] hidden sm:block">{r.usage}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ═══ 6. SOMBRAS ═══ */}
        <section>
          <SectionHeader number="6" title="Sombras & Elevacao" subtitle="Sistema de sombras para criar hierarquia e profundidade" />

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {shadows.map((s) => (
              <div key={s.name} className="rounded-xl bg-white border border-[#EDE9FE] p-5 text-center" style={{ boxShadow: s.css }}>
                <div className="w-10 h-10 mx-auto mb-3 rounded-lg bg-gradient-to-br from-[#8B5CF6]/10 to-[#06B6D4]/10" />
                <p className="text-sm font-semibold text-[#1E1B4B]">{s.name}</p>
                <p className="text-[10px] font-mono text-[#94A3B8] mt-1 break-all">{s.css}</p>
                <p className="text-[11px] text-[#64748B] mt-2">{s.usage}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ═══ 7. ESTILO DE COMPONENTES ═══ */}
        <section>
          <SectionHeader number="7" title="Estilo de Componentes" subtitle="Exemplos de aplicacao da identidade visual em componentes UI" />

          {/* Buttons */}
          <div className="rounded-xl bg-white border border-[#EDE9FE] p-6 mb-6">
            <h3 className="text-sm font-semibold text-[#1E1B4B] mb-4">Botoes</h3>
            <div className="flex flex-wrap gap-3 items-center">
              <button className="px-5 py-2.5 bg-[#8B5CF6] text-white text-sm font-medium rounded-lg hover:bg-[#7C3AED] transition-colors shadow-sm">
                Primario
              </button>
              <button className="px-5 py-2.5 bg-[#06B6D4] text-white text-sm font-medium rounded-lg hover:bg-[#0891B2] transition-colors shadow-sm">
                Secundario
              </button>
              <button className="px-5 py-2.5 bg-white text-[#8B5CF6] text-sm font-medium rounded-lg border-2 border-[#8B5CF6] hover:bg-[#F5F3FF] transition-colors">
                Outline
              </button>
              <button className="px-5 py-2.5 bg-gradient-to-r from-[#8B5CF6] to-[#06B6D4] text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity shadow-sm">
                Gradiente
              </button>
              <button className="px-5 py-2.5 bg-[#F5F3FF] text-[#8B5CF6] text-sm font-medium rounded-lg hover:bg-[#EDE9FE] transition-colors">
                Ghost
              </button>
              <button className="px-5 py-2.5 bg-[#EF4444] text-white text-sm font-medium rounded-lg hover:bg-[#DC2626] transition-colors shadow-sm">
                Destructivo
              </button>
            </div>
          </div>

          {/* Badges & Tags */}
          <div className="rounded-xl bg-white border border-[#EDE9FE] p-6 mb-6">
            <h3 className="text-sm font-semibold text-[#1E1B4B] mb-4">Badges & Tags</h3>
            <div className="flex flex-wrap gap-2 items-center">
              <span className="px-2.5 py-1 text-xs font-medium bg-[#8B5CF6]/10 text-[#8B5CF6] rounded-full">Novo</span>
              <span className="px-2.5 py-1 text-xs font-medium bg-[#06B6D4]/10 text-[#06B6D4] rounded-full">Ativo</span>
              <span className="px-2.5 py-1 text-xs font-medium bg-[#10B981]/10 text-[#10B981] rounded-full">Concluido</span>
              <span className="px-2.5 py-1 text-xs font-medium bg-[#F59E0B]/10 text-[#F59E0B] rounded-full">Pendente</span>
              <span className="px-2.5 py-1 text-xs font-medium bg-[#EF4444]/10 text-[#EF4444] rounded-full">Cancelado</span>
              <span className="px-2.5 py-1 text-xs font-medium bg-gradient-to-r from-[#8B5CF6] to-[#06B6D4] text-white rounded-full">Premium</span>
            </div>
          </div>

          {/* Cards Example */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Light card */}
            <div className="rounded-xl bg-white border border-[#EDE9FE] p-5 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-lg bg-[#8B5CF6]/10 flex items-center justify-center mb-3">
                <span className="text-[#8B5CF6] text-lg">✦</span>
              </div>
              <h4 className="text-sm font-semibold text-[#1E1B4B] mb-1">Card Light</h4>
              <p className="text-xs text-[#64748B]">Estilo padrao para cards em light mode com borda sutil lavanda.</p>
            </div>
            {/* Glass card */}
            <div className="rounded-xl bg-white/60 backdrop-blur-xl border border-[#C4B5FD]/30 p-5 hover:shadow-md transition-shadow" style={{ background: 'linear-gradient(135deg, rgba(237,233,254,0.6) 0%, rgba(207,250,254,0.3) 100%)' }}>
              <div className="w-10 h-10 rounded-lg bg-white/50 flex items-center justify-center mb-3">
                <span className="text-[#06B6D4] text-lg">◇</span>
              </div>
              <h4 className="text-sm font-semibold text-[#1E1B4B] mb-1">Card Glass</h4>
              <p className="text-xs text-[#64748B]">Estilo glassmorphism para modais, overlays e areas de destaque.</p>
            </div>
            {/* Dark card */}
            <div className="rounded-xl bg-[#1E1B4B] border border-[#312E81] p-5 hover:shadow-lg transition-shadow">
              <div className="w-10 h-10 rounded-lg bg-[#8B5CF6]/20 flex items-center justify-center mb-3">
                <span className="text-[#67E8F9] text-lg">⬡</span>
              </div>
              <h4 className="text-sm font-semibold text-white mb-1">Card Dark</h4>
              <p className="text-xs text-white/50">Estilo para dark mode, sidebar e areas premium.</p>
            </div>
          </div>
        </section>

        {/* ═══ 8. PRINCIPIOS DE DESIGN ═══ */}
        <section>
          <SectionHeader number="8" title="Principios de Design" subtitle="Valores que guiam todas as decisoes visuais e de UX" />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                icon: '◈',
                title: 'Premium & Moderno',
                desc: 'Visual sofisticado que transmite confianca e inovacao. Gradientes e profundidade criam uma experiencia memoravel.',
              },
              {
                icon: '◎',
                title: 'Clareza & Foco',
                desc: 'Informacao hierarquizada com espacamento generoso. O usuario encontra o que precisa sem esforco.',
              },
              {
                icon: '◆',
                title: 'Consistencia',
                desc: 'Tokens de design unificam toda a interface. Mesmos padroes em todas as telas e dispositivos.',
              },
              {
                icon: '◇',
                title: 'Acessibilidade',
                desc: 'Contraste WCAG AA em todos os textos. Interacoes claras para todos os usuarios.',
              },
            ].map((p) => (
              <div key={p.title} className="rounded-xl bg-white border border-[#EDE9FE] p-5">
                <span className="text-2xl bg-gradient-to-r from-[#8B5CF6] to-[#06B6D4] bg-clip-text text-transparent">{p.icon}</span>
                <h4 className="text-sm font-semibold text-[#1E1B4B] mt-3 mb-2">{p.title}</h4>
                <p className="text-xs text-[#64748B] leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ═══ FOOTER ═══ */}
        <footer className="text-center py-8 border-t border-[#EDE9FE]">
          <Image src="/logo-voxium.png" alt="Voxium" width={80} height={53} className="object-contain mx-auto mb-3 opacity-60" />
          <p className="text-xs text-[#94A3B8]">
            Voxium Brand Book v1.0 — Abril 2026
          </p>
          <p className="text-[11px] text-[#CBD5E1] mt-1">
            Identidade visual criada com base no logo oficial. Todos os tokens sao derivados da paleta roxo-ciano da marca.
          </p>
        </footer>
      </div>
    </div>
  )
}
