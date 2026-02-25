'use client'

import { useState, useMemo, useCallback } from 'react'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import {
  type EmailBlockData,
  type BlockType,
  createDefaultBlock,
  blocksToHtml,
  replaceVariables,
} from '@/types/emailTemplate'
import {
  Bars3Icon,
  TrashIcon,
  DocumentDuplicateIcon,
  PencilIcon,
  DevicePhoneMobileIcon,
  ComputerDesktopIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  CodeBracketIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline'

/* ======================== Constants ======================== */

const BLOCK_PALETTE: { type: BlockType; label: string; desc: string }[] = [
  { type: 'text', label: 'Texto', desc: 'Parágrafo de texto' },
  { type: 'image', label: 'Imagem', desc: 'Imagem com URL' },
  { type: 'button', label: 'Botão', desc: 'CTA com link' },
  { type: 'divider', label: 'Divisor', desc: 'Linha horizontal' },
  { type: 'spacer', label: 'Espaçador', desc: 'Espaço em branco' },
  { type: 'columns', label: 'Colunas', desc: 'Layout 2 ou 3 cols' },
]

const VARIABLES = [
  { key: 'nome', label: 'Nome' },
  { key: 'empresa', label: 'Empresa' },
  { key: 'email', label: 'Email' },
  { key: 'funil', label: 'Funil' },
  { key: 'responsavel', label: 'Responsável' },
]

const SAMPLE_VARS: Record<string, string> = {
  nome: 'João Silva',
  empresa: 'Acme Corp',
  email: 'joao@acme.com',
  funil: 'Vendas B2B',
  responsavel: 'Maria Santos',
}

/* ======================== Main Component ======================== */

interface EmailEditorProps {
  initialBlocks?: EmailBlockData[]
  initialSubject?: string
  onSave?: (blocks: EmailBlockData[], html: string, subject: string) => void
  onBack?: () => void
}

export default function EmailEditor({ initialBlocks, initialSubject, onSave, onBack }: EmailEditorProps) {
  const [blocks, setBlocks] = useState<EmailBlockData[]>(initialBlocks || [])
  const [subject, setSubject] = useState(initialSubject || '')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'edit' | 'desktop' | 'mobile'>('edit')
  const [showHtml, setShowHtml] = useState(false)

  const selectedBlock = useMemo(() => blocks.find((b) => b.id === selectedId) || null, [blocks, selectedId])
  const rawHtml = useMemo(() => blocksToHtml(blocks), [blocks])
  const previewHtml = useMemo(() => replaceVariables(rawHtml, SAMPLE_VARS), [rawHtml])

  const addBlock = useCallback((type: BlockType) => {
    const newBlock = createDefaultBlock(type)
    setBlocks((prev) => [...prev, newBlock])
    setSelectedId(newBlock.id)
  }, [])

  const removeBlock = useCallback((id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id))
    setSelectedId((prev) => (prev === id ? null : prev))
  }, [])

  const duplicateBlock = useCallback((id: string) => {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id)
      if (idx === -1) return prev
      const copy = { ...prev[idx], id: `block_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` }
      return [...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)]
    })
  }, [])

  const moveBlock = useCallback((id: string, dir: 'up' | 'down') => {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id)
      if (idx === -1) return prev
      if (dir === 'up' && idx === 0) return prev
      if (dir === 'down' && idx === prev.length - 1) return prev
      const items = [...prev]
      const swap = dir === 'up' ? idx - 1 : idx + 1
      ;[items[idx], items[swap]] = [items[swap], items[idx]]
      return items
    })
  }, [])

  const updateBlock = useCallback((id: string, updates: Partial<EmailBlockData>) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...updates } : b)))
  }, [])

  const insertVariable = useCallback(
    (varKey: string) => {
      if (!selectedBlock || selectedBlock.type !== 'text') return
      updateBlock(selectedBlock.id, { content: (selectedBlock.content || '') + `{{${varKey}}}` })
    },
    [selectedBlock, updateBlock],
  )

  const handleDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) return
    setBlocks((prev) => {
      const items = [...prev]
      const [moved] = items.splice(result.source.index, 1)
      items.splice(result.destination!.index, 0, moved)
      return items
    })
  }, [])

  /* ======================== Render ======================== */

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 bg-white shrink-0">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="rounded-lg p-1.5 hover:bg-slate-100 transition-colors">
              <ArrowLeftIcon className="h-5 w-5 text-slate-600" />
            </button>
          )}
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Assunto do email"
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm w-64 focus:ring-2 focus:ring-primary-300 focus:border-primary-400 outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-slate-200 overflow-hidden">
            {([
              { mode: 'edit' as const, Icon: PencilIcon, tip: 'Editar' },
              { mode: 'desktop' as const, Icon: ComputerDesktopIcon, tip: 'Desktop' },
              { mode: 'mobile' as const, Icon: DevicePhoneMobileIcon, tip: 'Mobile' },
            ]).map(({ mode, Icon }) => (
              <button
                key={mode}
                onClick={() => { setViewMode(mode); setShowHtml(false) }}
                className={`px-2.5 py-1.5 ${viewMode === mode && !showHtml ? 'bg-primary-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                title={mode}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
          <button
            onClick={() => { setShowHtml(!showHtml); setViewMode('edit') }}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              showHtml ? 'bg-slate-800 text-white border-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <CodeBracketIcon className="h-3.5 w-3.5" />
            HTML
          </button>
          {onSave && (
            <button
              onClick={() => onSave(blocks, rawHtml, subject)}
              className="bg-primary-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
            >
              Salvar
            </button>
          )}
        </div>
      </div>

      {/* Preview modes */}
      {viewMode !== 'edit' && !showHtml && (
        <div className="flex-1 bg-slate-100 flex items-start justify-center p-6 overflow-y-auto">
          <div
            className="bg-white rounded-lg shadow-lg border border-slate-200 overflow-hidden transition-all"
            style={{ width: viewMode === 'mobile' ? 375 : 700 }}
          >
            <iframe
              srcDoc={previewHtml}
              title="Preview"
              sandbox="allow-same-origin"
              className="w-full border-0"
              style={{ height: 600 }}
            />
          </div>
        </div>
      )}

      {/* HTML view */}
      {showHtml && (
        <div className="flex-1 p-4 overflow-auto bg-slate-50">
          <pre className="text-xs whitespace-pre-wrap text-slate-700 font-mono bg-white p-4 rounded-lg border border-slate-200">{rawHtml}</pre>
        </div>
      )}

      {/* Edit mode */}
      {viewMode === 'edit' && !showHtml && (
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Block palette */}
          <div className="w-48 border-r border-slate-200 bg-white p-3 overflow-y-auto shrink-0">
            <p className="text-[10px] font-bold text-slate-400 tracking-wider mb-2">BLOCOS</p>
            <div className="space-y-1">
              {BLOCK_PALETTE.map((bp) => (
                <button
                  key={bp.type}
                  onClick={() => addBlock(bp.type)}
                  className="w-full text-left rounded-lg border border-slate-200 p-2 hover:border-primary-300 hover:bg-primary-50 transition-colors"
                >
                  <p className="text-sm font-medium text-slate-700">{bp.label}</p>
                  <p className="text-[10px] text-slate-400">{bp.desc}</p>
                </button>
              ))}
            </div>

            <p className="text-[10px] font-bold text-slate-400 tracking-wider mt-4 mb-2">VARIÁVEIS</p>
            <div className="space-y-1">
              {VARIABLES.map((v) => (
                <button
                  key={v.key}
                  onClick={() => insertVariable(v.key)}
                  disabled={!selectedBlock || selectedBlock.type !== 'text'}
                  className="w-full text-left rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-600 hover:border-primary-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  {`{{${v.key}}}`} <span className="text-slate-400">— {v.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Center: Canvas */}
          <div className="flex-1 bg-slate-100 overflow-y-auto p-6">
            <div className="max-w-[620px] mx-auto bg-white rounded-lg shadow-sm border border-slate-200 min-h-[400px]">
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="canvas">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="min-h-[200px]">
                      {blocks.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                          <p className="text-sm">Clique em um bloco à esquerda para começar</p>
                          <p className="text-xs mt-1">Arraste os blocos para reordená-los</p>
                        </div>
                      )}
                      {blocks.map((block, index) => (
                        <Draggable key={block.id} draggableId={block.id} index={index}>
                          {(dragProvided, snapshot) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              className={`relative group transition-shadow ${snapshot.isDragging ? 'shadow-lg z-10' : ''} ${
                                selectedId === block.id ? 'ring-2 ring-primary-400' : 'hover:ring-1 hover:ring-slate-300'
                              }`}
                              onClick={() => setSelectedId(block.id)}
                            >
                              {/* Drag handle */}
                              <div
                                {...dragProvided.dragHandleProps}
                                aria-label="Reordenar bloco"
                                className="absolute -left-7 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
                              >
                                <Bars3Icon className="h-4 w-4 text-slate-400" />
                              </div>
                              {/* Action buttons */}
                              <div className="absolute -right-7 top-0 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-0.5">
                                <button onClick={(e) => { e.stopPropagation(); moveBlock(block.id, 'up') }} className="p-0.5 hover:bg-slate-200 rounded"><ChevronUpIcon className="h-3.5 w-3.5 text-slate-500" /></button>
                                <button onClick={(e) => { e.stopPropagation(); moveBlock(block.id, 'down') }} className="p-0.5 hover:bg-slate-200 rounded"><ChevronDownIcon className="h-3.5 w-3.5 text-slate-500" /></button>
                                <button onClick={(e) => { e.stopPropagation(); duplicateBlock(block.id) }} className="p-0.5 hover:bg-slate-200 rounded"><DocumentDuplicateIcon className="h-3.5 w-3.5 text-slate-500" /></button>
                                <button onClick={(e) => { e.stopPropagation(); removeBlock(block.id) }} className="p-0.5 hover:bg-red-100 rounded"><TrashIcon className="h-3.5 w-3.5 text-red-500" /></button>
                              </div>
                              <BlockPreview block={block} />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </div>
          </div>

          {/* Right: Properties */}
          <div className="w-64 border-l border-slate-200 bg-white p-3 overflow-y-auto shrink-0">
            {selectedBlock ? (
              <BlockProperties
                block={selectedBlock}
                onChange={(updates) => updateBlock(selectedBlock.id, updates)}
                onRemove={() => removeBlock(selectedBlock.id)}
              />
            ) : (
              <div className="text-center py-10">
                <p className="text-sm text-slate-400">Selecione um bloco</p>
                <p className="text-xs text-slate-300 mt-1">para editar propriedades</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ======================== Block Preview ======================== */

function BlockPreview({ block }: { block: EmailBlockData }) {
  const style: React.CSSProperties = {
    padding: `${block.paddingTop ?? 12}px ${block.paddingRight ?? 16}px ${block.paddingBottom ?? 12}px ${block.paddingLeft ?? 16}px`,
    backgroundColor: block.backgroundColor || undefined,
    textAlign: (block.align || 'left') as React.CSSProperties['textAlign'],
  }

  switch (block.type) {
    case 'text':
      return (
        <div style={{ ...style, fontSize: block.fontSize || 16, color: block.color || '#333', fontWeight: block.fontWeight || 'normal', lineHeight: block.lineHeight || 1.5 }}>
          {block.content || 'Digite seu texto...'}
        </div>
      )
    case 'image':
      return (
        <div style={style}>
          {block.src ? (
            <img src={block.src} alt={block.alt || ''} style={{ maxWidth: block.imageWidth || 600, width: '100%', height: 'auto', display: 'block', margin: block.align === 'center' ? '0 auto' : undefined }} />
          ) : (
            <div className="bg-slate-100 rounded-lg flex items-center justify-center h-32 text-sm text-slate-400">
              Adicione URL da imagem →
            </div>
          )}
        </div>
      )
    case 'button':
      return (
        <div style={style}>
          <span
            style={{
              display: 'inline-block',
              padding: '12px 24px',
              backgroundColor: block.buttonColor || '#13DEFC',
              color: block.buttonTextColor || '#fff',
              borderRadius: block.buttonRadius || 6,
              fontWeight: 'bold',
              fontSize: 16,
            }}
          >
            {block.buttonText || 'Clique aqui'}
          </span>
        </div>
      )
    case 'divider':
      return (
        <div style={style}>
          <hr style={{ border: 'none', borderTop: `${block.dividerThickness || 1}px solid ${block.dividerColor || '#E2E8F0'}`, margin: 0 }} />
        </div>
      )
    case 'spacer':
      return (
        <div style={{ height: block.spacerHeight || 24, backgroundColor: block.backgroundColor || 'transparent', position: 'relative' }}>
          <span className="absolute inset-0 border border-dashed border-slate-200 rounded" />
        </div>
      )
    case 'columns':
      return (
        <div style={style}>
          <div className="flex gap-2">
            {(block.columns || [[], []]).map((col, i) => (
              <div key={i} className="flex-1 min-h-[60px] border border-dashed border-slate-200 rounded p-2 text-center text-xs text-slate-400">
                Coluna {i + 1} ({col.length} {col.length === 1 ? 'bloco' : 'blocos'})
              </div>
            ))}
          </div>
        </div>
      )
    default:
      return null
  }
}

/* ======================== Block Properties Panel ======================== */

const TYPE_LABELS: Record<BlockType, string> = {
  text: 'Texto',
  image: 'Imagem',
  button: 'Botão',
  divider: 'Divisor',
  spacer: 'Espaçador',
  columns: 'Colunas',
}

const inputCls = 'mt-1 block w-full rounded-md border border-slate-200 px-2 py-1 text-sm focus:ring-1 focus:ring-primary-300 focus:border-primary-400 outline-none'
const labelCls = 'text-[11px] text-slate-500'

function BlockProperties({
  block,
  onChange,
  onRemove,
}: {
  block: EmailBlockData
  onChange: (updates: Partial<EmailBlockData>) => void
  onRemove: () => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-slate-500">{TYPE_LABELS[block.type]}</p>
        <button onClick={onRemove} className="text-xs text-red-500 hover:text-red-700">Remover</button>
      </div>

      {/* Text properties */}
      {block.type === 'text' && (
        <>
          <label className="block">
            <span className={labelCls}>Conteúdo</span>
            <textarea
              value={block.content || ''}
              onChange={(e) => onChange({ content: e.target.value })}
              rows={4}
              className={inputCls}
            />
            <span className="text-[10px] text-slate-400">Use {'{{variavel}}'} para conteúdo dinâmico</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className={labelCls}>Tamanho</span>
              <input type="number" value={block.fontSize || 16} onChange={(e) => onChange({ fontSize: +e.target.value })} className={inputCls} min={8} max={72} />
            </label>
            <label className="block">
              <span className={labelCls}>Cor</span>
              <input type="color" value={block.color || '#333333'} onChange={(e) => onChange({ color: e.target.value })} className="mt-1 block w-full h-8 rounded-md border border-slate-200 cursor-pointer" />
            </label>
          </div>
          <label className="block">
            <span className={labelCls}>Peso</span>
            <select value={block.fontWeight || 'normal'} onChange={(e) => onChange({ fontWeight: e.target.value })} className={inputCls}>
              <option value="normal">Normal</option>
              <option value="bold">Negrito</option>
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>Altura da linha</span>
            <input type="number" value={block.lineHeight || 1.5} onChange={(e) => onChange({ lineHeight: +e.target.value })} className={inputCls} min={1} max={3} step={0.1} />
          </label>
        </>
      )}

      {/* Image properties */}
      {block.type === 'image' && (
        <>
          <label className="block">
            <span className={labelCls}>URL da imagem</span>
            <input type="text" value={block.src || ''} onChange={(e) => onChange({ src: e.target.value })} placeholder="https://..." className={inputCls} />
          </label>
          <label className="block">
            <span className={labelCls}>Texto alternativo</span>
            <input type="text" value={block.alt || ''} onChange={(e) => onChange({ alt: e.target.value })} className={inputCls} />
          </label>
          <label className="block">
            <span className={labelCls}>Largura (px)</span>
            <input type="number" value={block.imageWidth || 600} onChange={(e) => onChange({ imageWidth: +e.target.value })} className={inputCls} min={50} max={600} />
          </label>
        </>
      )}

      {/* Button properties */}
      {block.type === 'button' && (
        <>
          <label className="block">
            <span className={labelCls}>Texto do botão</span>
            <input type="text" value={block.buttonText || ''} onChange={(e) => onChange({ buttonText: e.target.value })} className={inputCls} />
          </label>
          <label className="block">
            <span className={labelCls}>URL do link</span>
            <input type="text" value={block.buttonUrl || ''} onChange={(e) => onChange({ buttonUrl: e.target.value })} placeholder="https://..." className={inputCls} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className={labelCls}>Cor fundo</span>
              <input type="color" value={block.buttonColor || '#13DEFC'} onChange={(e) => onChange({ buttonColor: e.target.value })} className="mt-1 block w-full h-8 rounded-md border border-slate-200 cursor-pointer" />
            </label>
            <label className="block">
              <span className={labelCls}>Cor texto</span>
              <input type="color" value={block.buttonTextColor || '#FFFFFF'} onChange={(e) => onChange({ buttonTextColor: e.target.value })} className="mt-1 block w-full h-8 rounded-md border border-slate-200 cursor-pointer" />
            </label>
          </div>
          <label className="block">
            <span className={labelCls}>Border radius</span>
            <input type="number" value={block.buttonRadius || 6} onChange={(e) => onChange({ buttonRadius: +e.target.value })} className={inputCls} min={0} max={50} />
          </label>
        </>
      )}

      {/* Divider properties */}
      {block.type === 'divider' && (
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className={labelCls}>Cor</span>
            <input type="color" value={block.dividerColor || '#E2E8F0'} onChange={(e) => onChange({ dividerColor: e.target.value })} className="mt-1 block w-full h-8 rounded-md border border-slate-200 cursor-pointer" />
          </label>
          <label className="block">
            <span className={labelCls}>Espessura</span>
            <input type="number" value={block.dividerThickness || 1} onChange={(e) => onChange({ dividerThickness: +e.target.value })} className={inputCls} min={1} max={10} />
          </label>
        </div>
      )}

      {/* Spacer properties */}
      {block.type === 'spacer' && (
        <label className="block">
          <span className={labelCls}>Altura (px)</span>
          <input type="number" value={block.spacerHeight || 24} onChange={(e) => onChange({ spacerHeight: +e.target.value })} className={inputCls} min={4} max={200} />
        </label>
      )}

      {/* Columns properties */}
      {block.type === 'columns' && (
        <label className="block">
          <span className={labelCls}>Número de colunas</span>
          <div className="flex gap-2 mt-1">
            <button
              onClick={() => onChange({ columnCount: 2, columns: [[], []] })}
              className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${(block.columnCount || 2) === 2 ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              2 colunas
            </button>
            <button
              onClick={() => onChange({ columnCount: 3, columns: [[], [], []] })}
              className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${block.columnCount === 3 ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              3 colunas
            </button>
          </div>
        </label>
      )}

      {/* Common style properties */}
      <hr className="border-slate-100" />
      <p className="text-[10px] font-bold text-slate-400 tracking-wider">ESTILO</p>

      <label className="block">
        <span className={labelCls}>Alinhamento</span>
        <div className="flex gap-1 mt-1">
          {(['left', 'center', 'right'] as const).map((a) => (
            <button
              key={a}
              onClick={() => onChange({ align: a })}
              className={`flex-1 py-1 rounded text-xs font-medium transition-colors ${
                (block.align || 'left') === a ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {a === 'left' ? 'Esq.' : a === 'center' ? 'Centro' : 'Dir.'}
            </button>
          ))}
        </div>
      </label>

      <label className="block">
        <span className={labelCls}>Cor de fundo</span>
        <div className="flex items-center gap-2 mt-1">
          <input
            type="color"
            value={block.backgroundColor || '#ffffff'}
            onChange={(e) => onChange({ backgroundColor: e.target.value })}
            className="w-8 h-8 rounded border border-slate-200 cursor-pointer"
          />
          <button onClick={() => onChange({ backgroundColor: '' })} className="text-[10px] text-slate-500 hover:text-slate-700">
            Limpar
          </button>
        </div>
      </label>

      <div className="grid grid-cols-2 gap-2">
        {([
          { key: 'paddingTop' as const, label: 'Pad. Sup.' },
          { key: 'paddingBottom' as const, label: 'Pad. Inf.' },
          { key: 'paddingLeft' as const, label: 'Pad. Esq.' },
          { key: 'paddingRight' as const, label: 'Pad. Dir.' },
        ]).map(({ key, label }) => (
          <label key={key} className="block">
            <span className={labelCls}>{label}</span>
            <input
              type="number"
              value={block[key] ?? (key.includes('Left') || key.includes('Right') ? 16 : 12)}
              onChange={(e) => onChange({ [key]: +e.target.value })}
              className={inputCls}
              min={0}
              max={100}
            />
          </label>
        ))}
      </div>
    </div>
  )
}
