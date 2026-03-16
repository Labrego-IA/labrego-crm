'use client'

import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useEffect,
  useState,
} from 'react'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from '@/lib/firebaseClient'
import {
  MobileIcon,
  InstagramLogoIcon,
  EnvelopeClosedIcon,
  GlobeIcon,
} from '@radix-ui/react-icons'
import { HeartIcon } from '@radix-ui/react-icons'
import type { ProposalCustomField } from '@/types/proposalCustomField'
import type { ProposalBranding } from '@/types/proposalBranding'
import { DEFAULT_PROPOSAL_BRANDING } from '@/types/proposalBranding'
import type { ProposalStructure } from '@/types/proposalStructure'
import { DEFAULT_PROPOSAL_STRUCTURE } from '@/types/proposalStructure'
import { urlToBase64 } from '@/lib/imageUtils'

export type Item = { description: string; qty: number; price: number }
export type ScheduleEntry = { stage: string; days: number }

export interface ProposalPdfProps {
  nextNumber: number
  client: { name: string; company?: string; phone?: string }
  context: string
  proposalDescription?: string
  items: Item[]
  monthlyFees: { description: string; amount: number }[]
  paymentMethod: string
  schedule: ScheduleEntry[]
  logos: string[]
  subtotalBeforeDiscounts?: number
  subtotalAfterProgressive?: number
  partnerProductValue?: number
  discountPercent: number
  discountValue: number
  progressiveDiscount: number
  total: number
  expectedDays?: number
  visiblePages?: number
  currentPage?: number
  onPageCountChange?: (pages: number) => void
  observations?: string
  customFieldDefs?: ProposalCustomField[]
  customFieldValues?: Record<string, any>
  branding?: ProposalBranding
  structure?: ProposalStructure
}

export interface ProposalPdfHandle {
  generatePdf: (fileName: string) => Promise<void>
}

const HTML_ESCAPE_LOOKUP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, ch => HTML_ESCAPE_LOOKUP[ch] ?? ch)
}

function renderRichTextHtml(text: string): string {
  if (!text) return ''
  const escaped = escapeHtml(text)
  const withBold = escaped
    .replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__([\s\S]+?)__/g, '<strong>$1</strong>')
  return withBold.replace(/\n/g, '<br />')
}

/* =========================
   DIMENSÕES E LAYOUT A4
   ========================= */

const A4_WIDTH_PX = 794
const A4_HEIGHT_PX = 1123

// Margens padronizadas
const PAGE_PADDING_X = 48
const PAGE_PADDING_TOP = 48
const PAGE_PADDING_BOTTOM = 72 // espaço pro rodapé/numeração

// Padding interno dos cards (p-5 => 20px)
const CARD_PADDING_PX = 20

// Cabeçalho "Contexto" / "Descrição" ocupa ~110px
const HEADER_RESERVED = 110

// Área útil de conteúdo (altura disponível) nas páginas de conteúdo
const CONTENT_MAX_HEIGHT =
  A4_HEIGHT_PX - PAGE_PADDING_TOP - PAGE_PADDING_BOTTOM - HEADER_RESERVED

// Tabelas paginadas por linhas (mantém como estava – é confiável)
const ITEMS_ROWS_PER_PAGE = 18
const FEES_ROWS_PER_PAGE = 20
const SCHEDULE_ROWS_PER_PAGE = 22

/* =========================
   HELPERS
   ========================= */

function chunkArray<T>(arr: T[], perPage: number): T[][] {
  if (!arr?.length) return [[]]
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += perPage) {
    out.push(arr.slice(i, i + perPage))
  }
  return out
}

// Cria um medidor off-screen com tipografia equivalente
function createMeasureHost(): HTMLDivElement {
  const host = document.createElement('div')
  host.style.position = 'absolute'
  host.style.left = '-99999px'
  host.style.top = '0'
  const usableWidth =
    A4_WIDTH_PX - PAGE_PADDING_X * 2 - CARD_PADDING_PX * 2
  host.style.width = `${Math.max(usableWidth, 0)}px`
  host.style.visibility = 'hidden'
  host.style.pointerEvents = 'none'
  host.style.background = '#fff'
  host.style.padding = '0'
  host.style.margin = '0'
  host.style.lineHeight = '1.625'
  // tamanho/face aproximados ao Tailwind padrão (16px)
  host.style.fontSize = '15px'
  host.style.fontFamily =
    `ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial`
  document.body.appendChild(host)
  return host
}

// Medir altura de um parágrafo (texto simples com justify)
function measureParagraph(host: HTMLElement, text: string): number {
  const p = document.createElement('div')
  p.innerHTML = renderRichTextHtml(text)
  p.style.whiteSpace = 'normal'
  p.style.textAlign = 'justify'
  p.style.margin = '0 0 10px 0'
  host.appendChild(p)
  const h = p.getBoundingClientRect().height
  host.removeChild(p)
  return h
}

// Quebra o texto do contexto por altura real (parágrafo a parágrafo)
function paginateContextByHeight(context: string): string[] {
  const paragraphs = context
    .split(/\n{2,}/)
    .map(s => s.trim())
    .filter(Boolean)

  if (typeof window === 'undefined') return [context]

  const host = createMeasureHost()
  const pages: string[] = []
  let pageParas: string[] = []
  let used = 0

  for (const para of paragraphs) {
    const h = measureParagraph(host, para)
    // se esse parágrafo sozinho excede a página, quebrar "grosseiramente" por sentenças
    if (h > CONTENT_MAX_HEIGHT) {
      // fecha página atual se houver conteúdo
      if (pageParas.length) {
        pages.push(pageParas.join('\n\n'))
        pageParas = []
        used = 0
      }

      // quebra sentenças
      const sentences = para.split(/(?<=[.!?])\s+/).filter(Boolean)
      let sentencePack: string[] = []

      const measurePack = (pack: string[]) => {
        const h2 = measureParagraph(host, pack.join(' '))
        return h2
      }

      for (const s of sentences) {
        const test = [...sentencePack, s]
        const h2 = measurePack(test)
        if (h2 <= CONTENT_MAX_HEIGHT) {
          sentencePack.push(s)
        } else {
          if (sentencePack.length) {
            pages.push(sentencePack.join(' '))
            sentencePack = [s]
          } else {
            // sentença gigantesca: quebra "forçada" por tamanho médio
            const chunks = s.match(/.{1,600}/g) || [s]
            for (const c of chunks) {
              const test2 = [...sentencePack, c]
              const h3 = measurePack(test2)
              if (h3 <= CONTENT_MAX_HEIGHT) {
                sentencePack.push(c)
              } else {
                if (sentencePack.length) pages.push(sentencePack.join(' '))
                sentencePack = [c]
              }
            }
          }
        }
      }
      if (sentencePack.length) pages.push(sentencePack.join(' '))
      used = 0
      continue
    }

    // cabe na página atual?
    if (used + h <= CONTENT_MAX_HEIGHT) {
      pageParas.push(para)
      used += h
    } else {
      // fecha a página e inicia outra
      pages.push(pageParas.join('\n\n'))
      pageParas = [para]
      used = h
    }
  }

  if (pageParas.length) pages.push(pageParas.join('\n\n'))

  document.body.removeChild(host)
  return pages.length ? pages : ['']
}

/* =========================
   COMPONENTE
   ========================= */

export const ProposalPdf = forwardRef<ProposalPdfHandle, ProposalPdfProps>(
  (
    {
      nextNumber,
      client,
      context,
      proposalDescription,
      items,
      monthlyFees,
      paymentMethod,
      schedule,
      logos,
      subtotalBeforeDiscounts,
      subtotalAfterProgressive,
      partnerProductValue,
      discountPercent,
      discountValue,
      progressiveDiscount,
      total,
      expectedDays,
      visiblePages,
      currentPage,
      onPageCountChange,
      observations,
      customFieldDefs,
      customFieldValues,
      branding,
      structure,
    },
    ref
  ) => {
    const wrapperRef = useRef<HTMLDivElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const [scale, setScale] = useState(1)

    // Branding (usa defaults se não fornecido)
    const b = { ...DEFAULT_PROPOSAL_BRANDING, ...branding }

    // Pré-converte imagens de branding para base64 (evita CORS no html2canvas)
    const [logoBase64, setLogoBase64] = useState<string | null>(null)
    const [watermarkBase64, setWatermarkBase64] = useState<string | null>(null)

    useEffect(() => {
      let cancelled = false
      if (b.logoUrl) {
        urlToBase64(b.logoUrl).then(data => {
          if (!cancelled) setLogoBase64(data)
        })
      } else {
        setLogoBase64(null)
      }
      if (b.watermarkUrl) {
        urlToBase64(b.watermarkUrl).then(data => {
          if (!cancelled) setWatermarkBase64(data)
        })
      } else {
        setWatermarkBase64(null)
      }
      return () => { cancelled = true }
    }, [b.logoUrl, b.watermarkUrl])

    // URLs resolvidas: usa base64 se disponível, senão fallback para URL original
    const resolvedLogoUrl = logoBase64 || b.logoUrl
    const resolvedWatermarkUrl = watermarkBase64 || b.watermarkUrl

    // Structure (quais seções estão ativas)
    const str = structure ?? DEFAULT_PROPOSAL_STRUCTURE
    const isSectionEnabled = (key: string): boolean => {
      const sec = str.sections.find(s => s.key === key)
      return sec ? sec.enabled : true
    }
    const showPresentation = b.showPresentationPage && isSectionEnabled('presentation')
    const showLogos = b.showLogosPage && isSectionEnabled('logos')
    const showContext = isSectionEnabled('context')
    const showDescription = isSectionEnabled('modules') // reuse the 'modules' key for backwards compat
    const showItems = isSectionEnabled('items')
    const showFees = isSectionEnabled('fees')
    const showSchedule = isSectionEnabled('schedule')

    // Paginação reativa por ALTURA REAL
    const [contextPages, setContextPages] = useState<string[]>([''])
    const [descriptionPages, setDescriptionPages] = useState<string[]>([''])

    // Paginadores de tabela (por linhas)
    const itemsPages = chunkArray(items, ITEMS_ROWS_PER_PAGE)
    const feesPages = monthlyFees.length ? chunkArray(monthlyFees, FEES_ROWS_PER_PAGE) : []
    const schedulePages = chunkArray(schedule, SCHEDULE_ROWS_PER_PAGE)

    // Recalcula paginações por altura quando textos mudam
    useEffect(() => {
      setContextPages(paginateContextByHeight(context || ''))
      setDescriptionPages(paginateContextByHeight(proposalDescription || ''))
    }, [context, proposalDescription])

    // Ordenação das páginas (condicional: seções podem ser ocultas)
    const basePagesBeforeContent = 1 + (showPresentation ? 1 : 0) + (showLogos ? 1 : 0)
    const contextPageCount = showContext ? contextPages.length : 0
    const infoAndFirstContextPageNum = showContext ? basePagesBeforeContent + 1 : basePagesBeforeContent
    const extraContextStart = showContext ? infoAndFirstContextPageNum + 1 : infoAndFirstContextPageNum
    const descriptionStartPage = extraContextStart + Math.max(0, contextPageCount - 1)
    const descriptionPageCount = showDescription && proposalDescription ? descriptionPages.length : 0
    const itemsStartPage = descriptionStartPage + descriptionPageCount
    const feesStartPage = itemsStartPage + (showItems ? itemsPages.length : 0)
    const scheduleStartPage = feesStartPage + (showFees ? (feesPages.length || 0) : 0)
    const hasScheduleContent = showSchedule && schedule.length > 0
    const closingPageNum = scheduleStartPage + (hasScheduleContent ? schedulePages.length : 0)
    const hasCustomFieldValues = !!(
      customFieldDefs?.length &&
      customFieldValues &&
      Object.values(customFieldValues).some(v => v !== undefined && v !== '' && v !== false)
    )
    const hasClosingContent = !!observations || !!paymentMethod || hasCustomFieldValues
    const lastPageNumber = hasClosingContent ? closingPageNum : (closingPageNum - 1)
    const safeLastPageNumber = Number.isFinite(lastPageNumber) && lastPageNumber > 0 ? lastPageNumber : 1
    const maxPages = visiblePages ?? safeLastPageNumber
    const showPage = currentPage
    const subtotalFromItems = items.reduce((sum, x) => sum + x.qty * x.price, 0)
    const subtotalAfterProgressiveValue =
      typeof subtotalAfterProgressive === 'number'
        ? subtotalAfterProgressive
        : subtotalFromItems
    const partnerValue =
      typeof partnerProductValue === 'number' && Number.isFinite(partnerProductValue)
        ? Math.max(partnerProductValue, 0)
        : 0
    const subtotalBeforeDiscountsValue =
      typeof subtotalBeforeDiscounts === 'number'
        ? subtotalBeforeDiscounts + partnerValue
        : subtotalAfterProgressiveValue + progressiveDiscount
    const totalDiscountValue = Math.max(
      Number(((subtotalBeforeDiscountsValue ?? 0) - (total ?? 0)).toFixed(2)),
      0
    )
    const todayStr = new Date().toLocaleDateString('pt-BR')

    useEffect(() => {
      if (!onPageCountChange) return
      onPageCountChange(safeLastPageNumber)
    }, [onPageCountChange, safeLastPageNumber])

    // Escala responsiva
    useEffect(() => {
      const updateScale = () => {
        const parentWidth = wrapperRef.current?.clientWidth
        if (!parentWidth) return
        const s = parentWidth < A4_WIDTH_PX ? parentWidth / A4_WIDTH_PX : 1
        setScale(s)
      }
      updateScale()
      window.addEventListener('resize', updateScale)
      return () => window.removeEventListener('resize', updateScale)
    }, [])

    // PDF
    useImperativeHandle(ref, () => ({
      async generatePdf(fileName) {
        if (!containerRef.current) return

        const clone = containerRef.current.cloneNode(true) as HTMLElement
        clone.style.position = 'absolute'
        clone.style.top = '-9999px'
        clone.style.left = '-9999px'
        clone.style.transform = 'none'
        clone.style.width = `${A4_WIDTH_PX}px`
        document.body.appendChild(clone)

        // Embeda imagens remotas (usa API proxy para evitar problemas de CORS)
        const images = Array.from(clone.querySelectorAll<HTMLImageElement>('img'))
        await Promise.all(
          images.map(async img => {
            if (!img.src || img.src.startsWith('data:')) return
            const useProxyFirst = img.src.includes('firebasestorage.googleapis.com')

            if (!useProxyFirst) {
              try {
                const res = await fetch(img.src, { cache: 'no-store' })
                const blob = await res.blob()
                const reader = new FileReader()
                const dataUrl: string = await new Promise(resolve => {
                  reader.onloadend = () => resolve(reader.result as string)
                  reader.readAsDataURL(blob)
                })
                img.src = dataUrl
                return
              } catch {
                // Fallback para proxy abaixo
              }
            }

            try {
              const proxyRes = await fetch(`/api/image-proxy?url=${encodeURIComponent(img.src)}`)
              if (proxyRes.ok) {
                const { dataUrl } = await proxyRes.json()
                if (dataUrl) {
                  img.src = dataUrl
                }
              }
            } catch (proxyErr) {
              console.error('Erro ao carregar imagem via proxy', img.src, proxyErr)
            }
          })
        )

        const pages = Array.from(clone.querySelectorAll<HTMLElement>('.pdf-page'))
        pages.forEach(p => (p.style.display = 'block'))

        const pdf = new jsPDF({ orientation: 'p', unit: 'px', format: 'a4' })
        for (let i = 0; i < pages.length; i++) {
          const page = pages[i]
          page.style.width = `${A4_WIDTH_PX}px`
          page.style.height = `${A4_HEIGHT_PX}px`
          const canvas = await html2canvas(page, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            x: 0,
            y: 0,
            width: A4_WIDTH_PX,
            height: A4_HEIGHT_PX,
            windowWidth: A4_WIDTH_PX,
            windowHeight: A4_HEIGHT_PX,
            scrollX: 0,
            scrollY: 0,
            imageTimeout: 0,
          })
          const imgData = canvas.toDataURL('image/png')
          const pdfW = pdf.internal.pageSize.getWidth()
          const imgH = (canvas.height * pdfW) / canvas.width
          if (i > 0) pdf.addPage()
          pdf.addImage(imgData, 'PNG', 0, 0, pdfW, imgH)
        }

        const blob = pdf.output('blob')
        const sRef = storageRef(storage, `proposals/${fileName}`)
        await uploadBytes(sRef, blob)
        await getDownloadURL(sRef)
        document.body.removeChild(clone)
      },
    }))

    const formatBRL = (v: number) =>
      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

    // Container de página com margens fixas e numeração
    const PageContainer: React.FC<
      React.PropsWithChildren<{ pageNumber: number; className?: string; style?: React.CSSProperties }>
    > = ({ pageNumber, className, style, children }) => (
      <div
        className={`pdf-page relative bg-white ${className || ''}`}
        data-page={pageNumber}
        style={{
          width: `${A4_WIDTH_PX}px`,
          height: `${A4_HEIGHT_PX}px`,
          paddingLeft: PAGE_PADDING_X,
          paddingRight: PAGE_PADDING_X,
          paddingTop: PAGE_PADDING_TOP,
          paddingBottom: PAGE_PADDING_BOTTOM,
          display: showPage && showPage !== pageNumber ? 'none' : undefined,
          overflow: 'hidden',
          ...style,
        }}
      >
        {children}
        <div className="absolute bottom-4 left-0 right-0 text-center text-[11px] text-neutral-500">
          Página {pageNumber}
        </div>
      </div>
    )

    /* ========= RENDER ========= */

    return (
      <div ref={wrapperRef} style={{ width: '100%', overflowX: 'hidden' }}>
        <div
          ref={containerRef}
          style={{
            width: `${A4_WIDTH_PX}px`,
            margin: '0 auto',
            backgroundColor: '#fff',
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
          {/* 1) CAPA */}
          {maxPages >= 1 && (
            <PageContainer pageNumber={1} className="text-white" style={{ backgroundColor: b.primaryColor }}>
              <header className="flex flex-col items-center text-center space-y-4 mt-16">
                <div className="w-14 h-1 bg-white/70 rounded-full mb-2" />
                <h1 className="text-5xl font-extrabold tracking-tight">Proposta Comercial</h1>
                {b.tagline && <p className="text-xl opacity-90">{b.tagline}</p>}
              </header>

              {b.watermarkUrl && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <img
                    src={resolvedWatermarkUrl}
                    alt={b.companyName || 'Watermark'}
                    crossOrigin="anonymous"
                    className="h-28 w-auto opacity-25"
                    style={{ filter: 'grayscale(100%)' }}
                  />
                </div>
              )}

              <footer className="absolute bottom-16 left-[48px] right-[48px] text-base">
                <div className="grid grid-cols-1 gap-y-2">
                  {b.phone && (
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <MobileIcon width={20} height={20} className="flex-shrink-0" />
                      <span>{b.phone}</span>
                    </div>
                  )}
                  {b.email && (
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <EnvelopeClosedIcon width={20} height={20} className="flex-shrink-0" />
                      <span>{b.email}</span>
                    </div>
                  )}
                  {b.website && (
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <GlobeIcon width={20} height={20} className="flex-shrink-0" />
                      <span>{b.website}</span>
                    </div>
                  )}
                  {b.instagram && (
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <InstagramLogoIcon width={20} height={20} className="flex-shrink-0" />
                      <span>{b.instagram}</span>
                    </div>
                  )}
                </div>
              </footer>
            </PageContainer>
          )}

          {/* 2) APRESENTAÇÃO (condicional) */}
          {showPresentation && maxPages >= 2 && (
            <PageContainer pageNumber={2}>
              <div className="w-10 h-1 rounded-full mb-3" style={{ backgroundColor: b.primaryColor }} />
              <h2 className="text-3xl font-extrabold mb-8" style={{ color: b.primaryColor }}>Apresentação</h2>

              <div className="space-y-8 leading-relaxed">
                {b.presentationText && (
                  <div className="max-w-prose space-y-4 text-justify">
                    <p className="text-[15px] whitespace-pre-line">{b.presentationText}</p>
                  </div>
                )}

                {b.missionText && (
                  <div className="border-l-4 p-5 rounded-lg" style={{ backgroundColor: `${b.primaryColor}15`, borderColor: b.primaryColor }}>
                    <h3 className="text-xl font-semibold mb-2" style={{ color: b.primaryColor }}>Nossa missão</h3>
                    <p className="text-[15px]">{b.missionText}</p>
                  </div>
                )}

                <div className="bg-gray-50 p-5 rounded-lg ring-1 ring-gray-200">
                  <h3 className="text-xl font-semibold mb-2" style={{ color: b.primaryColor }}>Nesta proposta:</h3>
                  <ul className="list-disc list-inside space-y-1 text-[15px]">
                    <li>Contexto e objetivos</li>
                    <li>Descrição da proposta</li>
                    <li>Investimento</li>
                    <li>Forma de pagamento</li>
                  </ul>
                </div>
              </div>

              <div className="flex items-center space-x-3 mt-10">
                <HeartIcon className="w-6 h-6" style={{ color: b.primaryColor }} />
                <p className="text-[15px]">Obrigado pela confiança.</p>
              </div>

              {b.logoUrl && (
                <img
                  src={resolvedLogoUrl}
                  alt={b.companyName || 'Logo'}
                  crossOrigin="anonymous"
                  className="absolute bottom-6 right-6 h-12 w-auto opacity-20"
                />
              )}
            </PageContainer>
          )}

          {/* 3) LOGOS (condicional) */}
          {showLogos && (() => {
            const logosPageNum = showPresentation ? 3 : 2
            return maxPages >= logosPageNum && (
              <PageContainer pageNumber={logosPageNum}>
                <div className="flex flex-col items-center mb-14">
                  <div className="w-10 h-1 rounded-full mb-3" style={{ backgroundColor: b.primaryColor }} />
                  <h2 className="text-3xl font-bold text-center" style={{ color: b.primaryColor }}>
                    Empresas que confiaram na nossa entrega
                  </h2>
                </div>

                <div className="flex justify-center">
                  <div
                    className="grid w-full max-w-5xl gap-8 justify-items-center"
                    style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}
                  >
                    {(logos as string[]).map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        alt={`Logo ${i + 1}`}
                        crossOrigin="anonymous"
                        className="h-28 w-auto object-contain opacity-90 grayscale hover:grayscale-0 transition"
                      />
                    ))}
                  </div>
                </div>

                {b.logoUrl && (
                  <img
                    src={resolvedLogoUrl}
                    alt={b.companyName || 'Logo'}
                    crossOrigin="anonymous"
                    className="absolute bottom-6 right-6 h-12 w-auto opacity-20"
                  />
                )}
              </PageContainer>
            )
          })()}

          {/* 4) INFORMAÇÕES + CONTEXTO (primeira página de contexto) */}
          {showContext && maxPages >= infoAndFirstContextPageNum && (
            <PageContainer pageNumber={infoAndFirstContextPageNum}>
              <div className="w-12 h-1 rounded-full mb-3" style={{ backgroundColor: b.primaryColor }} />
              <h2 className="text-3xl font-bold mb-6" style={{ color: b.primaryColor }}>Proposta Comercial</h2>

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-3 text-[15px] mb-6">
                <div className="flex">
                  <dt className="w-36 font-semibold">Nº Proposta:</dt>
                  <dd>{String(nextNumber).padStart(4, '0')}</dd>
                </div>
                <div className="flex">
                  <dt className="w-36 font-semibold">Cliente:</dt>
                  <dd>{client.name}</dd>
                </div>
                <div className="flex">
                  <dt className="w-36 font-semibold">Empresa:</dt>
                  <dd>{client.company || '—'}</dd>
                </div>
                <div className="flex">
                  <dt className="w-36 font-semibold">Telefone:</dt>
                  <dd>{client.phone || '—'}</dd>
                </div>
              </dl>

              <div className="border-l-4 rounded-lg p-5" style={{ backgroundColor: `${b.primaryColor}15`, borderColor: b.primaryColor }}>
                <h3 className="text-lg font-semibold mb-2" style={{ color: b.primaryColor }}>Contexto</h3>
                <p
                  className="text-[15px] leading-relaxed text-justify"
                  dangerouslySetInnerHTML={{
                    __html: renderRichTextHtml(contextPages[0] || ''),
                  }}
                />
              </div>

              {b.logoUrl && (
                <img
                  src={resolvedLogoUrl}
                  alt={b.companyName || 'Logo'}
                  crossOrigin="anonymous"
                  className="absolute bottom-6 right-6 h-12 w-auto opacity-20"
                />
              )}
            </PageContainer>
          )}

          {/* CONTEXTO extra (páginas seguintes) */}
          {showContext && contextPages.slice(1).map((ctx, idx) => {
            const pageNum = extraContextStart + idx
            if (pageNum > (visiblePages ?? Infinity)) return null
            return (
              <PageContainer key={`ctx-${idx}`} pageNumber={pageNum}>
                <div className="w-12 h-1 rounded-full mb-3" style={{ backgroundColor: b.primaryColor }} />
                <h2 className="text-3xl font-bold mb-6" style={{ color: b.primaryColor }}>Contexto (cont.)</h2>
                <div className="rounded-lg p-1">
                  <p
                    className="text-[15px] leading-relaxed text-justify"
                    dangerouslySetInnerHTML={{
                      __html: renderRichTextHtml(ctx),
                    }}
                  />
                </div>
                {b.logoUrl && (
                  <img
                    src={resolvedLogoUrl}
                    alt={b.companyName || 'Logo'}
                    crossOrigin="anonymous"
                    className="absolute bottom-6 right-6 h-12 w-auto opacity-20"
                  />
                )}
              </PageContainer>
            )
          })}

          {/* DESCRIÇÃO DA PROPOSTA paginada por ALTURA */}
          {showDescription && proposalDescription && descriptionPages.map((desc, idx) => {
            const pageNum = descriptionStartPage + idx
            if (pageNum > (visiblePages ?? Infinity)) return null
            return (
              <PageContainer key={`desc-${idx}`} pageNumber={pageNum}>
                <div className="w-12 h-1 rounded-full mb-3" style={{ backgroundColor: b.primaryColor }} />
                <h2 className="text-3xl font-bold mb-5" style={{ color: b.primaryColor }}>
                  Descrição da Proposta{idx ? ' (cont.)' : ''}
                </h2>
                <div className="bg-gray-50 border-l-4 border-gray-300 rounded-lg p-5">
                  <p
                    className="text-[15px] leading-relaxed text-justify"
                    dangerouslySetInnerHTML={{
                      __html: renderRichTextHtml(desc),
                    }}
                  />
                </div>
                {b.logoUrl && (
                  <img
                    src={resolvedLogoUrl}
                    alt={b.companyName || 'Logo'}
                    crossOrigin="anonymous"
                    className="absolute bottom-6 right-6 h-12 w-auto opacity-20"
                  />
                )}
              </PageContainer>
            )
          })}

          {/* ITENS (paginado por linhas) */}
          {showItems && itemsPages.map((pageItems, idx) => {
            const pageNum = itemsStartPage + idx
            if (pageNum > (visiblePages ?? Infinity)) return null
            const isFirst = idx === 0
            return (
              <PageContainer key={`items-${idx}`} pageNumber={pageNum}>
                <div className="mb-8">
                  <div className="w-12 h-1 rounded-full mb-3" style={{ backgroundColor: b.primaryColor }} />
                  <h2 className="text-3xl font-bold" style={{ color: b.primaryColor }}>
                    Itens da Proposta{!isFirst ? ' (cont.)' : ''}
                  </h2>
                </div>

                <table className="w-full text-[15px] border-collapse mb-6 shadow-sm ring-1 ring-gray-200 rounded-lg overflow-hidden">
                  <thead className="text-white text-left" style={{ backgroundColor: b.primaryColor }}>
                    <tr>
                      <th className="py-3 px-4">Descrição</th>
                      <th className="py-3 px-4 text-right">Qtd</th>
                      <th className="py-3 px-4 text-right">Preço</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white text-neutral-800">
                    {pageItems.map((it, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="py-3 px-4">{it.description}</td>
                        <td className="py-3 px-4 text-right">{it.qty}</td>
                        <td className="py-3 px-4 text-right">{formatBRL(it.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {isFirst && (
                  <div className="text-right text-[15px] space-y-1">
                    <div>
                      <span className="font-semibold text-neutral-700 mr-2">Subtotal</span>
                      <span className="font-semibold text-neutral-800">
                        {formatBRL(subtotalBeforeDiscountsValue)}
                      </span>
                    </div>
                    {progressiveDiscount > 0 && (
                      <div>
                        <span className="font-semibold text-neutral-700 mr-2">
                          Desconto progressivo
                        </span>
                        <span className="font-semibold text-red-600">
                          -{formatBRL(progressiveDiscount)}
                        </span>
                      </div>
                    )}
                    {discountValue > 0 && (
                      <div>
                        <span className="font-semibold text-neutral-700 mr-2">
                          Desconto ({discountPercent}%)
                        </span>
                        <span className="font-semibold text-red-600">
                          -{formatBRL(discountValue)}
                        </span>
                      </div>
                    )}
                    {totalDiscountValue > 0 && (
                      <div>
                        <span className="font-semibold text-neutral-700 mr-2">
                          Subtotal de desconto
                        </span>
                        <span className="font-semibold text-red-600">
                          -{formatBRL(totalDiscountValue)}
                        </span>
                      </div>
                    )}
                    <div className="pt-1">
                      <span className="font-bold text-lg mr-2">Total</span>
                      <span className="font-bold text-lg" style={{ color: b.primaryColor }}>{formatBRL(total)}</span>
                    </div>
                  </div>
                )}

                {b.logoUrl && (
                  <img
                    src={resolvedLogoUrl}
                    alt={b.companyName || 'Logo'}
                    crossOrigin="anonymous"
                    className="absolute bottom-6 right-6 h-12 w-auto opacity-20"
                  />
                )}
              </PageContainer>
            )
          })}

          {/* MENSALIDADES (paginado por linhas) */}
          {showFees && feesPages.map((pageFees, idx) => {
            const pageNum = feesStartPage + idx
            if (pageNum > (visiblePages ?? Infinity)) return null
            return (
              <PageContainer key={`fees-${idx}`} pageNumber={pageNum}>
                <div className="mb-8">
                  <div className="w-12 h-1 rounded-full mb-3" style={{ backgroundColor: b.primaryColor }} />
                  <h2 className="text-3xl font-bold" style={{ color: b.primaryColor }}>
                    Mensalidade{idx ? ' (cont.)' : ''}
                  </h2>
                </div>

                <table className="w-full text-[15px] border-collapse shadow-sm ring-1 ring-gray-200 rounded-lg overflow-hidden">
                  <thead className="text-white text-left" style={{ backgroundColor: b.primaryColor }}>
                    <tr>
                      <th className="py-3 px-4">Descrição</th>
                      <th className="py-3 px-4 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white text-neutral-800">
                    {pageFees.map((m, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="py-3 px-4">{m.description}</td>
                        <td className="py-3 px-4 text-right">{formatBRL(m.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {b.logoUrl && (
                  <img
                    src={resolvedLogoUrl}
                    alt={b.companyName || 'Logo'}
                    crossOrigin="anonymous"
                    className="absolute bottom-6 right-6 h-12 w-auto opacity-20"
                  />
                )}
              </PageContainer>
            )
          })}

          {/* CRONOGRAMA (paginado por linhas) — só renderiza se tiver conteúdo */}
          {hasScheduleContent && schedulePages.map((pageSch, idx) => {
            const pageNum = scheduleStartPage + idx
            if (pageNum > (visiblePages ?? Infinity)) return null
            const isFirst = idx === 0
            return (
              <PageContainer key={`sched-${idx}`} pageNumber={pageNum}>
                <div className="mb-8">
                  <div className="w-12 h-1 rounded-full mb-3" style={{ backgroundColor: b.primaryColor }} />
                  <h2 className="text-3xl font-bold" style={{ color: b.primaryColor }}>Cronograma{!isFirst ? ' (cont.)' : ''}</h2>
                </div>

                <table className="w-full text-[15px] border-collapse mb-6 shadow-sm ring-1 ring-gray-200 rounded-lg overflow-hidden">
                  <thead className="text-white text-left" style={{ backgroundColor: b.primaryColor }}>
                    <tr>
                      <th className="py-3 px-4">Etapa</th>
                      <th className="py-3 px-4 text-center">Horas</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white text-neutral-800">
                    {pageSch.map((s, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="py-3 px-4">{s.stage}</td>
                        <td className="py-3 px-4 text-center">{s.days}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {isFirst && typeof expectedDays === 'number' && (
                  <div className="mt-4 rounded-xl p-5" style={{ backgroundColor: `${b.primaryColor}0D`, border: `1px solid ${b.primaryColor}33` }}>
                    <div className="text-xs font-semibold mb-1 tracking-wide" style={{ color: b.primaryColor }}>PRAZO ESTIMADO</div>
                    <div className="text-[15px] text-neutral-800">
                      Tempo em dias úteis:&nbsp;<strong style={{ color: b.primaryColor }}>{expectedDays}</strong>.
                      Inicia após a confirmação do pagamento de entrada.
                    </div>
                  </div>
                )}

                {b.logoUrl && (
                  <img
                    src={resolvedLogoUrl}
                    alt={b.companyName || 'Logo'}
                    crossOrigin="anonymous"
                    className="absolute bottom-6 right-6 h-12 w-auto opacity-20"
                  />
                )}
              </PageContainer>
            )
          })}

          {/* PÁGINA FINAL — Observações + Pagamento + Validade */}
          {hasClosingContent && maxPages >= closingPageNum && (
            <PageContainer pageNumber={closingPageNum}>
              <div className="w-12 h-1 rounded-full mb-3" style={{ backgroundColor: b.primaryColor }} />

              {observations && (
                <div className="mb-6">
                  <h2 className="text-3xl font-bold mb-4" style={{ color: b.primaryColor }}>Observações</h2>
                  <div className="bg-gray-50 border-l-4 border-gray-300 rounded-lg p-5">
                    <p className="text-[15px] leading-relaxed whitespace-pre-line text-neutral-800">{observations}</p>
                  </div>
                </div>
              )}

              {/* Campos personalizados */}
              {hasCustomFieldValues && customFieldDefs && customFieldValues && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-3 tracking-tight" style={{ color: b.primaryColor }}>Informações Adicionais</h3>
                  <div className="bg-gray-50 border-l-4 border-gray-300 rounded-lg p-5 space-y-2">
                    {customFieldDefs
                      .filter(f => {
                        const val = customFieldValues[f.key]
                        return val !== undefined && val !== '' && val !== false
                      })
                      .map(f => {
                        const val = customFieldValues[f.key]
                        let displayVal: string
                        if (f.type === 'checkbox') {
                          displayVal = val ? 'Sim' : 'Não'
                        } else if (f.type === 'number' && typeof val === 'number') {
                          displayVal = String(val)
                        } else {
                          displayVal = String(val ?? '')
                        }
                        return (
                          <div key={f.id} className="flex gap-2 text-[15px]">
                            <span className="font-semibold text-neutral-700 shrink-0">{f.label}:</span>
                            <span className="text-neutral-800 whitespace-pre-line">{displayVal}</span>
                          </div>
                        )
                      })}
                  </div>
                </div>
              )}

              {paymentMethod && (
                <div className="bg-gray-50 border-l-4 border-gray-300 rounded-xl p-5 shadow-sm ring-1 ring-gray-200 mb-6">
                  <h3 className="text-lg font-semibold mb-2 tracking-tight" style={{ color: b.primaryColor }}>Forma de pagamento</h3>
                  <p className="text-[15px] leading-relaxed whitespace-pre-line text-neutral-800">{paymentMethod}</p>
                </div>
              )}

              <p className="mt-6 text-xs text-neutral-600 text-right">
                Proposta válida por {b.validityDays} dias a partir de {todayStr}.
              </p>

              {b.logoUrl && (
                <img
                  src={resolvedLogoUrl}
                  alt={b.companyName || 'Logo'}
                  crossOrigin="anonymous"
                  className="absolute bottom-6 right-6 h-12 w-auto opacity-20"
                />
              )}
            </PageContainer>
          )}
        </div>
      </div>
    )
  }
)

ProposalPdf.displayName = 'ProposalPdf'
