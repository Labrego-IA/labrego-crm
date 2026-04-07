'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'

/* ─── BRAND TOKENS ─── */
const brand = {
  primary: { name: 'Violet', hex: '#8B5CF6', rgb: '139, 92, 246', usage: 'Botoes principais, links, elementos de destaque' },
  primaryDark: { name: 'Deep Violet', hex: '#6D28D9', rgb: '109, 40, 217', usage: 'Hover states, headers, enfase' },
  primaryLight: { name: 'Soft Violet', hex: '#C4B5FD', rgb: '196, 181, 253', usage: 'Backgrounds suaves, badges, tags' },
  secondary: { name: 'Electric Cyan', hex: '#06B6D4', rgb: '6, 182, 212', usage: 'Acoes secundarias, indicadores, dados' },
  secondaryLight: { name: 'Light Cyan', hex: '#67E8F9', rgb: '103, 232, 249', usage: 'Highlights, notificacoes, status ativo' },
  accent: { name: 'Orchid', hex: '#C084FC', rgb: '192, 132, 252', usage: 'CTAs especiais, promos, gamificacao' },
  dark: { name: 'Deep Navy', hex: '#1E1B4B', rgb: '30, 27, 75', usage: 'Textos principais, backgrounds escuros' },
  darkMid: { name: 'Indigo Dark', hex: '#312E81', rgb: '49, 46, 129', usage: 'Sidebar, cards escuros, footers' },
  surface: { name: 'Ghost White', hex: '#F5F3FF', rgb: '245, 243, 255', usage: 'Background principal light mode' },
  surfaceMid: { name: 'Lavender Mist', hex: '#EDE9FE', rgb: '237, 233, 254', usage: 'Cards, containers, separadores' },
  textPrimary: { name: 'Charcoal', hex: '#1E1B4B', rgb: '30, 27, 75', usage: 'Headings, texto principal' },
  textSecondary: { name: 'Slate', hex: '#64748B', rgb: '100, 116, 139', usage: 'Texto secundario, labels, captions' },
  success: { name: 'Emerald', hex: '#10B981', rgb: '16, 185, 129', usage: 'Sucesso, confirmacao, ganhos' },
  warning: { name: 'Amber', hex: '#F59E0B', rgb: '245, 158, 11', usage: 'Alertas, atencao, pendencias' },
  error: { name: 'Rose', hex: '#EF4444', rgb: '239, 68, 68', usage: 'Erros, exclusao, perda' },
}

const gradients = [
  { name: 'Brand Signature', css: 'linear-gradient(135deg, #8B5CF6 0%, #06B6D4 100%)', tailwind: 'from-[#8B5CF6] to-[#06B6D4]', usage: 'Logo, headers, hero sections' },
  { name: 'Purple Depth', css: 'linear-gradient(135deg, #6D28D9 0%, #8B5CF6 50%, #C084FC 100%)', tailwind: 'from-[#6D28D9] via-[#8B5CF6] to-[#C084FC]', usage: 'Cards premium, banners, CTAs' },
  { name: 'Cyber Glow', css: 'linear-gradient(135deg, #312E81 0%, #06B6D4 100%)', tailwind: 'from-[#312E81] to-[#06B6D4]', usage: 'Dark mode surfaces, sidebar' },
  { name: 'Frost', css: 'linear-gradient(135deg, #EDE9FE 0%, #CFFAFE 100%)', tailwind: 'from-[#EDE9FE] to-[#CFFAFE]', usage: 'Light mode backgrounds, cards suaves' },
  { name: 'Aurora', css: 'linear-gradient(135deg, #C084FC 0%, #67E8F9 50%, #8B5CF6 100%)', tailwind: 'from-[#C084FC] via-[#67E8F9] to-[#8B5CF6]', usage: 'Estados especiais, animacoes' },
  { name: 'Midnight', css: 'linear-gradient(135deg, #0F0A2E 0%, #1E1B4B 50%, #312E81 100%)', tailwind: 'from-[#0F0A2E] via-[#1E1B4B] to-[#312E81]', usage: 'Backgrounds escuros premium' },
]

const typography = [
  { name: 'Display', size: '3rem', px: '48px', weight: 800, tracking: '-0.025em', usage: 'Hero headlines' },
  { name: 'H1', size: '2.25rem', px: '36px', weight: 700, tracking: '-0.025em', usage: 'Titulos de pagina' },
  { name: 'H2', size: '1.875rem', px: '30px', weight: 700, tracking: '-0.02em', usage: 'Secoes principais' },
  { name: 'H3', size: '1.5rem', px: '24px', weight: 600, tracking: '-0.015em', usage: 'Subsecoes, cards' },
  { name: 'H4', size: '1.25rem', px: '20px', weight: 600, tracking: '-0.01em', usage: 'Titulos menores' },
  { name: 'Body LG', size: '1.125rem', px: '18px', weight: 400, tracking: '0', usage: 'Texto de destaque' },
  { name: 'Body', size: '1rem', px: '16px', weight: 400, tracking: '0', usage: 'Texto padrao' },
  { name: 'Body SM', size: '0.875rem', px: '14px', weight: 400, tracking: '0', usage: 'Labels, captions' },
  { name: 'Caption', size: '0.75rem', px: '12px', weight: 500, tracking: '0.025em', usage: 'Metadata, badges' },
  { name: 'Overline', size: '0.625rem', px: '10px', weight: 600, tracking: '0.1em', usage: 'Tags (UPPERCASE)' },
]

const shadows = [
  { name: 'Subtle', css: '0 1px 3px rgba(30,27,75,0.06)', usage: 'Cards em repouso' },
  { name: 'Medium', css: '0 4px 12px rgba(30,27,75,0.1)', usage: 'Cards hover, dropdowns' },
  { name: 'Elevated', css: '0 8px 30px rgba(30,27,75,0.15)', usage: 'Modais, popovers' },
  { name: 'Glow Violet', css: '0 0 30px rgba(139,92,246,0.4)', usage: 'Botao primario hover' },
  { name: 'Glow Cyan', css: '0 0 30px rgba(6,182,212,0.4)', usage: 'Elementos interativos' },
]

/* ─── COPY FEEDBACK ─── */
function useCopyFeedback() {
  const [copied, setCopied] = useState<string | null>(null)
  const copy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(text)
    setTimeout(() => setCopied(null), 1500)
  }
  return { copied, copy }
}

/* ─── SCROLL ANIMATION HOOK ─── */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } }, { threshold: 0.15 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return { ref, visible }
}

function RevealSection({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const { ref, visible } = useReveal()
  return (
    <div ref={ref} className={`transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${className}`}>
      {children}
    </div>
  )
}

/* ─── COLOR SWATCH ─── */
function ColorSwatch({ color, large }: { color: { name: string; hex: string; rgb: string; usage: string }; large?: boolean }) {
  const { copied, copy } = useCopyFeedback()
  const isCopied = copied === color.hex
  return (
    <button
      onClick={() => copy(color.hex)}
      className={`group text-left relative rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.03] hover:-translate-y-1 ${large ? 'col-span-2 sm:col-span-1' : ''}`}
    >
      <div className={`${large ? 'h-32' : 'h-24'} relative`} style={{ backgroundColor: color.hex }}>
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className={`absolute inset-0 flex items-center justify-center transition-all duration-200 ${isCopied ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}>
          <span className="px-3 py-1 bg-white/90 backdrop-blur-sm rounded-full text-xs font-semibold text-[#1E1B4B]">Copiado!</span>
        </div>
      </div>
      <div className="p-3 bg-white/80 backdrop-blur-sm border border-white/50">
        <p className="text-sm font-semibold text-[#1E1B4B]">{color.name}</p>
        <p className="text-xs font-mono text-[#8B5CF6]">{color.hex}</p>
        <p className="text-[11px] text-[#94A3B8] mt-0.5">{color.usage}</p>
      </div>
    </button>
  )
}

/* ─── SECTION HEADER ─── */
function SectionHeader({ number, title, subtitle }: { number: string; title: string; subtitle: string }) {
  return (
    <div className="mb-10 relative">
      <div className="flex items-center gap-4 mb-2">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-[#8B5CF6] to-[#06B6D4] rounded-xl blur-md opacity-50" />
          <span className="relative inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-[#8B5CF6] to-[#06B6D4] text-white text-sm font-bold shadow-lg">
            {number}
          </span>
        </div>
        <h2 className="text-3xl font-extrabold text-[#1E1B4B] tracking-tight">{title}</h2>
      </div>
      <p className="text-[#64748B] text-sm ml-14">{subtitle}</p>
      <div className="mt-4 ml-14 h-px w-32 bg-gradient-to-r from-[#8B5CF6] to-transparent" />
    </div>
  )
}

/* ─── FLOATING PARTICLES (CSS) ─── */
function FloatingOrbs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute w-[600px] h-[600px] rounded-full blur-[150px] opacity-20 animate-[float_20s_ease-in-out_infinite] top-[-10%] right-[-15%]" style={{ background: 'radial-gradient(circle, #8B5CF6 0%, transparent 70%)' }} />
      <div className="absolute w-[500px] h-[500px] rounded-full blur-[150px] opacity-15 animate-[float_25s_ease-in-out_infinite_reverse] bottom-[-10%] left-[-10%]" style={{ background: 'radial-gradient(circle, #06B6D4 0%, transparent 70%)' }} />
      <div className="absolute w-[300px] h-[300px] rounded-full blur-[100px] opacity-10 animate-[float_15s_ease-in-out_infinite] top-[40%] left-[30%]" style={{ background: 'radial-gradient(circle, #C084FC 0%, transparent 70%)' }} />
    </div>
  )
}

/* ─── ANIMATED GRID BACKGROUND ─── */
function GridBg() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-[0.03]">
      <div className="absolute inset-0" style={{
        backgroundImage: `
          linear-gradient(rgba(139,92,246,1) 1px, transparent 1px),
          linear-gradient(90deg, rgba(139,92,246,1) 1px, transparent 1px)
        `,
        backgroundSize: '60px 60px',
      }} />
    </div>
  )
}

/* ─── MAIN PAGE ─── */
export default function BrandBookPage() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const heroRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!heroRef.current) return
      const rect = heroRef.current.getBoundingClientRect()
      setMousePos({
        x: ((e.clientX - rect.left) / rect.width) * 100,
        y: ((e.clientY - rect.top) / rect.height) * 100,
      })
    }
    const el = heroRef.current
    el?.addEventListener('mousemove', handleMove)
    return () => el?.removeEventListener('mousemove', handleMove)
  }, [])

  return (
    <div className="min-h-screen bg-[#F5F3FF] relative">
      {/* Global CSS for animations */}
      <style jsx global>{`
        @keyframes float {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          33% { transform: translate(30px, -30px) rotate(5deg); }
          66% { transform: translate(-20px, 20px) rotate(-3deg); }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes glow-pulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.05); }
        }
        @keyframes gradient-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes border-spin {
          0% { --angle: 0deg; }
          100% { --angle: 360deg; }
        }
        .animate-shimmer {
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%);
          background-size: 200% 100%;
          animation: shimmer 3s ease-in-out infinite;
        }
        .gradient-text {
          background: linear-gradient(135deg, #8B5CF6, #06B6D4, #C084FC, #8B5CF6);
          background-size: 300% 300%;
          animation: gradient-shift 6s ease infinite;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .glass-card {
          background: rgba(255,255,255,0.6);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.3);
        }
        .glass-card-dark {
          background: rgba(30,27,75,0.6);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(139,92,246,0.15);
        }
        .glow-border {
          position: relative;
        }
        .glow-border::before {
          content: '';
          position: absolute;
          inset: -1px;
          border-radius: inherit;
          padding: 1px;
          background: linear-gradient(135deg, #8B5CF6, #06B6D4, #C084FC, #8B5CF6);
          background-size: 300% 300%;
          animation: gradient-shift 4s ease infinite;
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          opacity: 0;
          transition: opacity 0.3s;
        }
        .glow-border:hover::before {
          opacity: 1;
        }
      `}</style>

      {/* ═══ HERO ═══ */}
      <div ref={heroRef} className="relative overflow-hidden min-h-[480px] flex items-center" style={{ background: 'linear-gradient(135deg, #0F0A2E 0%, #1E1B4B 40%, #312E81 100%)' }}>
        <FloatingOrbs />
        <GridBg />

        {/* Mouse-follow spotlight */}
        <div
          className="absolute w-[500px] h-[500px] rounded-full pointer-events-none transition-all duration-[600ms] ease-out"
          style={{
            background: `radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 60%)`,
            left: `${mousePos.x}%`,
            top: `${mousePos.y}%`,
            transform: 'translate(-50%, -50%)',
          }}
        />

        {/* Animated top border */}
        <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, transparent, #8B5CF6, #06B6D4, #C084FC, transparent)', backgroundSize: '200% 100%', animation: 'shimmer 3s ease-in-out infinite' }} />

        <div className="relative max-w-6xl mx-auto px-6 py-20 w-full">
          <div className="flex flex-col items-center text-center">
            {/* Logo with glow */}
            <div className="relative mb-10">
              <div className="absolute inset-0 blur-[60px] opacity-40 animate-[glow-pulse_4s_ease-in-out_infinite]" style={{ background: 'radial-gradient(circle, #8B5CF6 0%, #06B6D4 50%, transparent 70%)' }} />
              <Image src="/logo-voxium.png" alt="Voxium" width={220} height={147} className="object-contain relative z-10 drop-shadow-2xl" />
            </div>

            <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-5">
              <span className="gradient-text">Brand Book</span>
            </h1>
            <p className="text-lg text-white/40 max-w-lg leading-relaxed">
              Guia de identidade visual da marca Voxium. Cores, tipografia, espacamentos e estilo para criar experiencias consistentes e memoraveis.
            </p>

            {/* Version badge */}
            <div className="flex items-center gap-3 mt-8">
              <span className="px-3 py-1.5 rounded-full text-xs font-medium text-white/60 border border-white/10 bg-white/5 backdrop-blur-sm">v1.0</span>
              <span className="text-xs text-white/30">Abril 2026</span>
              <span className="w-1 h-1 rounded-full bg-[#8B5CF6]" />
              <span className="text-xs text-white/30">Voxium CRM</span>
            </div>

            {/* Scroll indicator */}
            <div className="mt-12 animate-bounce">
              <div className="w-6 h-10 rounded-full border-2 border-white/20 flex justify-center pt-2">
                <div className="w-1 h-2 rounded-full bg-white/40" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-16 space-y-24 relative">
        <FloatingOrbs />

        {/* ═══ 1. LOGO ═══ */}
        <RevealSection>
          <SectionHeader number="1" title="Logo" subtitle="Variacoes aprovadas e regras de uso do logo Voxium" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { bg: 'linear-gradient(135deg, #0F0A2E 0%, #1E1B4B 100%)', border: 'border-[#312E81]/50', label: 'Fundo Escuro' },
              { bg: '#FFFFFF', border: 'border-[#EDE9FE]', label: 'Fundo Claro' },
              { bg: 'linear-gradient(135deg, #8B5CF6 0%, #06B6D4 100%)', border: 'border-transparent', label: 'Fundo Gradiente' },
            ].map((v) => (
              <div key={v.label} className={`group relative rounded-2xl p-10 flex flex-col items-center justify-center gap-4 border ${v.border} overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-xl`} style={{ background: v.bg }}>
                <div className="absolute inset-0 animate-shimmer" />
                <Image src="/logo-voxium.png" alt={v.label} width={160} height={107} className="object-contain relative z-10 transition-transform duration-300 group-hover:scale-105" />
                <span className="text-[10px] font-medium uppercase tracking-widest text-white/40 relative z-10" style={{ color: v.bg === '#FFFFFF' ? '#94A3B8' : undefined }}>{v.label}</span>
              </div>
            ))}
          </div>

          {/* Logo rules */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-card rounded-2xl p-6 glow-border">
              <h4 className="text-sm font-bold text-[#10B981] mb-4 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#10B981]/10 flex items-center justify-center text-xs">✓</span>
                Uso Correto
              </h4>
              <ul className="space-y-2.5 text-sm text-[#64748B]">
                <li className="flex items-start gap-2"><span className="w-1 h-1 rounded-full bg-[#10B981] mt-2 shrink-0" />Area de respiro minima: 20% da largura do logo</li>
                <li className="flex items-start gap-2"><span className="w-1 h-1 rounded-full bg-[#10B981] mt-2 shrink-0" />Tamanho minimo: 80px de largura para digital</li>
                <li className="flex items-start gap-2"><span className="w-1 h-1 rounded-full bg-[#10B981] mt-2 shrink-0" />Sobre fundos escuros, claros ou gradientes da marca</li>
                <li className="flex items-start gap-2"><span className="w-1 h-1 rounded-full bg-[#10B981] mt-2 shrink-0" />Manter proporcoes originais</li>
              </ul>
            </div>
            <div className="glass-card rounded-2xl p-6 glow-border">
              <h4 className="text-sm font-bold text-[#EF4444] mb-4 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#EF4444]/10 flex items-center justify-center text-xs">✕</span>
                Uso Incorreto
              </h4>
              <ul className="space-y-2.5 text-sm text-[#64748B]">
                <li className="flex items-start gap-2"><span className="w-1 h-1 rounded-full bg-[#EF4444] mt-2 shrink-0" />Nao alterar as cores do logo</li>
                <li className="flex items-start gap-2"><span className="w-1 h-1 rounded-full bg-[#EF4444] mt-2 shrink-0" />Nao rotacionar ou inclinar</li>
                <li className="flex items-start gap-2"><span className="w-1 h-1 rounded-full bg-[#EF4444] mt-2 shrink-0" />Nao usar sobre fundos com pouco contraste</li>
                <li className="flex items-start gap-2"><span className="w-1 h-1 rounded-full bg-[#EF4444] mt-2 shrink-0" />Nao adicionar sombras ou efeitos extras</li>
              </ul>
            </div>
          </div>
        </RevealSection>

        {/* ═══ 2. PALETA DE CORES ═══ */}
        <RevealSection>
          <SectionHeader number="2" title="Paleta de Cores" subtitle="Sistema de cores extraido do gradiente roxo-ciano do logo. Clique para copiar." />

          <div className="mb-10">
            <h3 className="text-xs font-bold text-[#8B5CF6] mb-5 uppercase tracking-[0.2em]">Cores Principais</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
              <ColorSwatch color={brand.primary} large />
              <ColorSwatch color={brand.primaryDark} />
              <ColorSwatch color={brand.primaryLight} />
              <ColorSwatch color={brand.secondary} large />
              <ColorSwatch color={brand.secondaryLight} />
              <ColorSwatch color={brand.accent} />
            </div>
          </div>

          <div className="mb-10">
            <h3 className="text-xs font-bold text-[#8B5CF6] mb-5 uppercase tracking-[0.2em]">Neutros & Escuros</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
              <ColorSwatch color={brand.dark} />
              <ColorSwatch color={brand.darkMid} />
              <ColorSwatch color={brand.surface} />
              <ColorSwatch color={brand.surfaceMid} />
              <ColorSwatch color={brand.textPrimary} />
              <ColorSwatch color={brand.textSecondary} />
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold text-[#8B5CF6] mb-5 uppercase tracking-[0.2em]">Semanticas</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <ColorSwatch color={brand.success} />
              <ColorSwatch color={brand.warning} />
              <ColorSwatch color={brand.error} />
            </div>
          </div>
        </RevealSection>

        {/* ═══ 3. GRADIENTES ═══ */}
        <RevealSection>
          <SectionHeader number="3" title="Gradientes" subtitle="Gradientes derivados do logo para interfaces premium" />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {gradients.map((g) => (
              <div key={g.name} className="group rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-xl glow-border">
                <div className="h-28 relative overflow-hidden" style={{ background: g.css }}>
                  <div className="absolute inset-0 animate-shimmer" />
                  <div className="absolute bottom-3 left-4">
                    <span className="px-2 py-0.5 rounded-full bg-white/10 backdrop-blur-sm text-[10px] font-medium text-white/80">{g.name}</span>
                  </div>
                </div>
                <div className="glass-card p-4 border-t-0 rounded-t-none">
                  <p className="text-[11px] font-mono text-[#64748B] break-all">{g.css}</p>
                  <p className="text-[10px] font-mono text-[#C4B5FD] mt-1">{g.tailwind}</p>
                  <p className="text-[11px] text-[#94A3B8] mt-2">{g.usage}</p>
                </div>
              </div>
            ))}
          </div>
        </RevealSection>

        {/* ═══ 4. TIPOGRAFIA ═══ */}
        <RevealSection>
          <SectionHeader number="4" title="Tipografia" subtitle="Sistema tipografico Inter com escala modular de 10 niveis" />

          {/* Font showcase */}
          <div className="glass-card rounded-2xl p-8 mb-8 relative overflow-hidden glow-border">
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-[100px] opacity-10" style={{ background: 'radial-gradient(circle, #8B5CF6, transparent)' }} />
            <div className="flex items-end gap-6 mb-6 relative z-10">
              <span className="text-8xl font-black gradient-text leading-none">Aa</span>
              <div className="pb-2">
                <p className="text-2xl font-bold text-[#1E1B4B]">Inter</p>
                <p className="text-sm text-[#64748B]">system-ui, -apple-system, sans-serif</p>
                <div className="flex gap-2 mt-2">
                  {[400, 500, 600, 700, 800].map((w) => (
                    <span key={w} className="px-2 py-0.5 rounded-md bg-[#F5F3FF] text-[10px] font-mono text-[#8B5CF6]" style={{ fontWeight: w }}>{w}</span>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
              <p className="text-sm text-[#64748B] font-mono leading-relaxed">ABCDEFGHIJKLMNOPQRSTUVWXYZ<br />abcdefghijklmnopqrstuvwxyz</p>
              <p className="text-sm text-[#64748B] font-mono leading-relaxed">0123456789<br />!@#$%&*()-+=[]{}|;:&apos;,./&lt;&gt;?</p>
            </div>
          </div>

          {/* Type scale */}
          <div className="glass-card rounded-2xl overflow-hidden">
            {typography.map((t, i) => (
              <div key={t.name} className={`group flex items-center gap-6 px-6 py-4 transition-colors hover:bg-[#8B5CF6]/[0.03] ${i < typography.length - 1 ? 'border-b border-[#EDE9FE]' : ''}`}>
                <div className="w-20 shrink-0">
                  <span className="text-xs font-bold text-[#8B5CF6] uppercase tracking-wider">{t.name}</span>
                </div>
                <p className="flex-1 text-[#1E1B4B] truncate transition-colors group-hover:text-[#8B5CF6]" style={{ fontSize: `${Math.min(parseFloat(t.size), 2)}rem`, fontWeight: t.weight, letterSpacing: t.tracking }}>
                  Voxium CRM
                </p>
                <div className="hidden md:flex items-center gap-3 shrink-0">
                  <span className="px-2 py-0.5 rounded-md bg-[#F5F3FF] text-[10px] font-mono text-[#64748B]">{t.px}</span>
                  <span className="px-2 py-0.5 rounded-md bg-[#F5F3FF] text-[10px] font-mono text-[#64748B]">w{t.weight}</span>
                  <span className="text-[10px] text-[#94A3B8] w-28 text-right">{t.usage}</span>
                </div>
              </div>
            ))}
          </div>
        </RevealSection>

        {/* ═══ 5. SOMBRAS & ELEVACAO ═══ */}
        <RevealSection>
          <SectionHeader number="5" title="Sombras & Elevacao" subtitle="Sistema de sombras para hierarquia visual e profundidade" />

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
            {shadows.map((s) => (
              <div key={s.name} className="group glass-card rounded-2xl p-6 text-center transition-all duration-300 hover:-translate-y-2" style={{ boxShadow: s.css }}>
                <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-br from-[#8B5CF6]/10 to-[#06B6D4]/10 group-hover:from-[#8B5CF6]/20 group-hover:to-[#06B6D4]/20 transition-colors flex items-center justify-center">
                  <div className="w-4 h-4 rounded-md bg-gradient-to-br from-[#8B5CF6] to-[#06B6D4] opacity-60 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-sm font-bold text-[#1E1B4B]">{s.name}</p>
                <p className="text-[11px] text-[#64748B] mt-1">{s.usage}</p>
              </div>
            ))}
          </div>
        </RevealSection>

        {/* ═══ 6. COMPONENTES ═══ */}
        <RevealSection>
          <SectionHeader number="6" title="Componentes" subtitle="Exemplos de aplicacao da identidade visual em elementos UI" />

          {/* Buttons */}
          <div className="glass-card rounded-2xl p-8 mb-6 glow-border">
            <h3 className="text-xs font-bold text-[#8B5CF6] mb-6 uppercase tracking-[0.2em]">Botoes</h3>
            <div className="flex flex-wrap gap-4 items-center">
              <button className="relative px-6 py-3 bg-[#8B5CF6] text-white text-sm font-semibold rounded-xl hover:bg-[#7C3AED] transition-all duration-200 hover:shadow-[0_0_25px_rgba(139,92,246,0.4)] hover:-translate-y-0.5 active:translate-y-0">
                Primario
              </button>
              <button className="px-6 py-3 bg-[#06B6D4] text-white text-sm font-semibold rounded-xl hover:bg-[#0891B2] transition-all duration-200 hover:shadow-[0_0_25px_rgba(6,182,212,0.4)] hover:-translate-y-0.5">
                Secundario
              </button>
              <button className="px-6 py-3 bg-transparent text-[#8B5CF6] text-sm font-semibold rounded-xl border-2 border-[#8B5CF6] hover:bg-[#8B5CF6] hover:text-white transition-all duration-200 hover:-translate-y-0.5">
                Outline
              </button>
              <button className="px-6 py-3 text-white text-sm font-semibold rounded-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_30px_rgba(139,92,246,0.3)]" style={{ background: 'linear-gradient(135deg, #8B5CF6, #06B6D4)' }}>
                Gradiente
              </button>
              <button className="px-6 py-3 bg-[#F5F3FF] text-[#8B5CF6] text-sm font-semibold rounded-xl hover:bg-[#EDE9FE] transition-all duration-200 hover:-translate-y-0.5">
                Ghost
              </button>
              <button className="px-6 py-3 bg-[#EF4444] text-white text-sm font-semibold rounded-xl hover:bg-[#DC2626] transition-all duration-200 hover:shadow-[0_0_25px_rgba(239,68,68,0.3)] hover:-translate-y-0.5">
                Destructivo
              </button>
            </div>
          </div>

          {/* Badges */}
          <div className="glass-card rounded-2xl p-8 mb-6 glow-border">
            <h3 className="text-xs font-bold text-[#8B5CF6] mb-6 uppercase tracking-[0.2em]">Badges & Tags</h3>
            <div className="flex flex-wrap gap-3 items-center">
              <span className="px-3 py-1.5 text-xs font-semibold bg-[#8B5CF6]/10 text-[#8B5CF6] rounded-full border border-[#8B5CF6]/20">Novo</span>
              <span className="px-3 py-1.5 text-xs font-semibold bg-[#06B6D4]/10 text-[#06B6D4] rounded-full border border-[#06B6D4]/20">Ativo</span>
              <span className="px-3 py-1.5 text-xs font-semibold bg-[#10B981]/10 text-[#10B981] rounded-full border border-[#10B981]/20">Concluido</span>
              <span className="px-3 py-1.5 text-xs font-semibold bg-[#F59E0B]/10 text-[#F59E0B] rounded-full border border-[#F59E0B]/20">Pendente</span>
              <span className="px-3 py-1.5 text-xs font-semibold bg-[#EF4444]/10 text-[#EF4444] rounded-full border border-[#EF4444]/20">Cancelado</span>
              <span className="px-3 py-1.5 text-xs font-semibold text-white rounded-full shadow-lg" style={{ background: 'linear-gradient(135deg, #8B5CF6, #06B6D4)' }}>Premium</span>
            </div>
          </div>

          {/* Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Light card */}
            <div className="group glass-card rounded-2xl p-6 transition-all duration-300 hover:-translate-y-2 hover:shadow-xl glow-border">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#8B5CF6]/10 to-[#06B6D4]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <span className="text-xl gradient-text">✦</span>
              </div>
              <h4 className="text-base font-bold text-[#1E1B4B] mb-2">Card Glass Light</h4>
              <p className="text-sm text-[#64748B] leading-relaxed">Glassmorphism com blur para cards em light mode. Borda animada no hover.</p>
            </div>
            {/* Gradient glass card */}
            <div className="group rounded-2xl p-6 transition-all duration-300 hover:-translate-y-2 hover:shadow-xl relative overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(237,233,254,0.8), rgba(207,250,254,0.5))', backdropFilter: 'blur(20px)', border: '1px solid rgba(196,181,253,0.3)' }}>
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-[60px] opacity-30 bg-[#C084FC] group-hover:opacity-50 transition-opacity" />
              <div className="w-12 h-12 rounded-xl bg-white/60 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform relative z-10">
                <span className="text-xl text-[#06B6D4]">◇</span>
              </div>
              <h4 className="text-base font-bold text-[#1E1B4B] mb-2 relative z-10">Card Frost</h4>
              <p className="text-sm text-[#64748B] leading-relaxed relative z-10">Gradiente sutil com glassmorphism para areas de destaque e features.</p>
            </div>
            {/* Dark card */}
            <div className="group glass-card-dark rounded-2xl p-6 transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_8px_40px_rgba(139,92,246,0.2)] relative overflow-hidden">
              <div className="absolute bottom-0 right-0 w-40 h-40 rounded-full blur-[80px] opacity-20 bg-[#06B6D4] group-hover:opacity-40 transition-opacity" />
              <div className="w-12 h-12 rounded-xl bg-[#8B5CF6]/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform relative z-10">
                <span className="text-xl text-[#67E8F9]">⬡</span>
              </div>
              <h4 className="text-base font-bold text-white mb-2 relative z-10">Card Dark</h4>
              <p className="text-sm text-white/50 leading-relaxed relative z-10">Estilo dark premium para sidebar, dashboards e areas de destaque.</p>
            </div>
          </div>
        </RevealSection>

        {/* ═══ 7. ESPACAMENTO ═══ */}
        <RevealSection>
          <SectionHeader number="7" title="Espacamento & Formas" subtitle="Tokens de espacamento e border radius para layout consistente" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-card rounded-2xl p-6 glow-border">
              <h3 className="text-xs font-bold text-[#8B5CF6] mb-5 uppercase tracking-[0.2em]">Espacamento</h3>
              {[
                { token: 'xs', value: '4px' },
                { token: 'sm', value: '8px' },
                { token: 'md', value: '16px' },
                { token: 'lg', value: '24px' },
                { token: 'xl', value: '32px' },
                { token: '2xl', value: '48px' },
                { token: '3xl', value: '64px' },
              ].map((s) => (
                <div key={s.token} className="flex items-center gap-3 py-2 group">
                  <span className="text-xs font-mono font-bold text-[#1E1B4B] w-8">{s.token}</span>
                  <div className="h-3 rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#06B6D4] transition-all duration-300 group-hover:shadow-[0_0_12px_rgba(139,92,246,0.3)]" style={{ width: s.value }} />
                  <span className="text-xs font-mono text-[#64748B]">{s.value}</span>
                </div>
              ))}
            </div>

            <div className="glass-card rounded-2xl p-6 glow-border">
              <h3 className="text-xs font-bold text-[#8B5CF6] mb-5 uppercase tracking-[0.2em]">Border Radius</h3>
              {[
                { token: 'sm', value: '6px' },
                { token: 'md', value: '8px' },
                { token: 'lg', value: '12px' },
                { token: 'xl', value: '16px' },
                { token: '2xl', value: '24px' },
                { token: 'full', value: '9999px' },
              ].map((r) => (
                <div key={r.token} className="flex items-center gap-3 py-2 group">
                  <span className="text-xs font-mono font-bold text-[#1E1B4B] w-8">{r.token}</span>
                  <div className="w-10 h-10 border-2 border-[#8B5CF6] bg-gradient-to-br from-[#8B5CF6]/5 to-[#06B6D4]/5 shrink-0 transition-all duration-300 group-hover:border-[#06B6D4] group-hover:shadow-[0_0_12px_rgba(139,92,246,0.2)]" style={{ borderRadius: r.value }} />
                  <span className="text-xs font-mono text-[#64748B]">{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        </RevealSection>

        {/* ═══ 8. PRINCIPIOS ═══ */}
        <RevealSection>
          <SectionHeader number="8" title="Principios de Design" subtitle="Valores que guiam todas as decisoes visuais e de UX" />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: '◈', color: '#8B5CF6', title: 'Premium & Moderno', desc: 'Visual sofisticado com gradientes, glassmorphism e profundidade. Cada detalhe transmite inovacao.' },
              { icon: '◎', color: '#06B6D4', title: 'Clareza & Foco', desc: 'Hierarquia clara com espacamento generoso. O usuario encontra o que precisa sem esforco.' },
              { icon: '◆', color: '#C084FC', title: 'Consistencia', desc: 'Tokens de design unificam toda a interface. Mesmos padroes em todas as telas.' },
              { icon: '◇', color: '#67E8F9', title: 'Acessibilidade', desc: 'Contraste WCAG AA em todos os textos. Design inclusivo por padrao.' },
            ].map((p) => (
              <div key={p.title} className="group glass-card rounded-2xl p-6 transition-all duration-300 hover:-translate-y-2 hover:shadow-xl relative overflow-hidden glow-border">
                <div className="absolute top-0 right-0 w-24 h-24 rounded-full blur-[50px] opacity-0 group-hover:opacity-20 transition-opacity" style={{ background: p.color }} />
                <span className="text-3xl block mb-4" style={{ color: p.color }}>{p.icon}</span>
                <h4 className="text-sm font-bold text-[#1E1B4B] mb-2">{p.title}</h4>
                <p className="text-xs text-[#64748B] leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </RevealSection>

        {/* ═══ FOOTER ═══ */}
        <RevealSection>
          <footer className="text-center py-12 relative">
            <div className="h-px w-full bg-gradient-to-r from-transparent via-[#8B5CF6]/20 to-transparent mb-12" />
            <div className="relative inline-block">
              <div className="absolute inset-0 blur-[40px] opacity-20" style={{ background: 'radial-gradient(circle, #8B5CF6, transparent)' }} />
              <Image src="/logo-voxium.png" alt="Voxium" width={80} height={53} className="object-contain mx-auto mb-4 relative z-10 opacity-60 hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-xs text-[#94A3B8]">Voxium Brand Book v1.0 — Abril 2026</p>
            <p className="text-[11px] text-[#CBD5E1] mt-1">Identidade visual derivada do gradiente roxo-ciano da marca.</p>
          </footer>
        </RevealSection>
      </div>
    </div>
  )
}
