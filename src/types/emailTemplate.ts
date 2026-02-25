/**
 * Email template types for the drag-and-drop email editor.
 * Includes block definitions, HTML generation, and variable replacement.
 */

export type BlockType = 'text' | 'image' | 'button' | 'divider' | 'spacer' | 'columns'

export interface EmailBlockData {
  id: string
  type: BlockType
  // Text
  content?: string
  fontSize?: number
  color?: string
  fontWeight?: string
  lineHeight?: number
  // Image
  src?: string
  alt?: string
  imageWidth?: number
  // Button
  buttonText?: string
  buttonUrl?: string
  buttonColor?: string
  buttonTextColor?: string
  buttonRadius?: number
  // Divider
  dividerColor?: string
  dividerThickness?: number
  // Spacer
  spacerHeight?: number
  // Columns
  columnCount?: 2 | 3
  columns?: EmailBlockData[][]
  // Common styling
  align?: 'left' | 'center' | 'right'
  paddingTop?: number
  paddingRight?: number
  paddingBottom?: number
  paddingLeft?: number
  backgroundColor?: string
}

export type TemplateCategory = 'boas-vindas' | 'follow-up' | 'promocional' | 'informativo' | 'reengajamento'

export const TEMPLATE_CATEGORIES: { value: TemplateCategory; label: string }[] = [
  { value: 'boas-vindas', label: 'Boas-vindas' },
  { value: 'follow-up', label: 'Follow-up' },
  { value: 'promocional', label: 'Promocional' },
  { value: 'informativo', label: 'Informativo' },
  { value: 'reengajamento', label: 'Reengajamento' },
]

export interface EmailTemplate {
  id: string
  orgId: string
  name: string
  subject: string
  blocks: EmailBlockData[]
  previewText?: string
  category?: TemplateCategory
  isSystem?: boolean
  createdAt: string
  updatedAt: string
  createdBy: string
  createdByName: string
}

export function createDefaultBlock(type: BlockType): EmailBlockData {
  const id = `block_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const base = { id, type, paddingTop: 12, paddingRight: 16, paddingBottom: 12, paddingLeft: 16, backgroundColor: '', align: 'left' as const }

  switch (type) {
    case 'text':
      return { ...base, content: 'Digite seu texto aqui...', fontSize: 16, color: '#333333', fontWeight: 'normal', lineHeight: 1.5 }
    case 'image':
      return { ...base, src: '', alt: 'Imagem', imageWidth: 600, align: 'center' }
    case 'button':
      return { ...base, buttonText: 'Clique aqui', buttonUrl: 'https://', buttonColor: '#13DEFC', buttonTextColor: '#FFFFFF', buttonRadius: 6, align: 'center' }
    case 'divider':
      return { ...base, dividerColor: '#E2E8F0', dividerThickness: 1, paddingTop: 16, paddingBottom: 16 }
    case 'spacer':
      return { ...base, spacerHeight: 24, paddingTop: 0, paddingBottom: 0 }
    case 'columns':
      return { ...base, columnCount: 2, columns: [[], []], paddingTop: 0, paddingBottom: 0 }
  }
}

/* ======================== HTML Generation ======================== */

function pad(b: EmailBlockData): string {
  return `padding:${b.paddingTop ?? 12}px ${b.paddingRight ?? 16}px ${b.paddingBottom ?? 12}px ${b.paddingLeft ?? 16}px;`
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function sanitizeColor(c: string): string {
  if (!c) return ''
  // Allow hex colors, named colors, rgb/rgba
  if (/^#[0-9a-fA-F]{3,8}$/.test(c)) return c
  if (/^(rgb|rgba)\(\s*[\d\s,./%]+\)$/.test(c)) return c
  if (/^[a-zA-Z]{1,20}$/.test(c)) return c
  return ''
}

function blockToRow(block: EmailBlockData): string {
  const bgColor = sanitizeColor(block.backgroundColor || '')
  const bg = bgColor ? `background-color:${bgColor};` : ''
  const p = pad(block)
  const a = block.align || 'left'

  switch (block.type) {
    case 'text':
      return `<tr><td style="${p}${bg}text-align:${a};font-size:${block.fontSize || 16}px;color:${sanitizeColor(block.color || '') || '#333333'};font-weight:${block.fontWeight || 'normal'};line-height:${block.lineHeight || 1.5};">${esc(block.content || '')}</td></tr>`
    case 'image':
      return `<tr><td style="${p}${bg}text-align:${a};"><img src="${esc(block.src || '')}" alt="${esc(block.alt || '')}" width="${block.imageWidth || 600}" style="max-width:100%;height:auto;display:block;${a === 'center' ? 'margin:0 auto;' : ''}" /></td></tr>`
    case 'button': {
      const btnColor = sanitizeColor(block.buttonColor || '') || '#13DEFC'
      const btnTextColor = sanitizeColor(block.buttonTextColor || '') || '#FFFFFF'
      const bs = `display:inline-block;padding:12px 24px;background-color:${btnColor};color:${btnTextColor};text-decoration:none;border-radius:${block.buttonRadius || 6}px;font-weight:bold;font-size:16px;`
      return `<tr><td style="${p}${bg}text-align:${a};"><a href="${esc(block.buttonUrl || '#')}" style="${bs}">${esc(block.buttonText || 'Clique aqui')}</a></td></tr>`
    }
    case 'divider':
      return `<tr><td style="${p}${bg}"><hr style="border:none;border-top:${block.dividerThickness || 1}px solid ${sanitizeColor(block.dividerColor || '') || '#E2E8F0'};margin:0;" /></td></tr>`
    case 'spacer':
      return `<tr><td style="${bg}height:${block.spacerHeight || 24}px;font-size:1px;line-height:1px;">&nbsp;</td></tr>`
    case 'columns': {
      const cols = block.columns || [[], []]
      const w = Math.floor(100 / cols.length)
      const cells = cols.map(col => {
        const rows = col.map(blockToRow).join('\n')
        return `<td width="${w}%" valign="top" style="padding:4px;"><table width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table></td>`
      }).join('\n')
      return `<tr><td style="${p}${bg}"><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${cells}</tr></table></td></tr>`
    }
    default:
      return ''
  }
}

export function blocksToHtml(blocks: EmailBlockData[]): string {
  const rows = blocks.map(blockToRow).join('\n')
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f5f9;">
<tr><td align="center" style="padding:24px 0;">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;">
${rows}
</table>
</td></tr>
</table>
</body>
</html>`
}

export function replaceVariables(html: string, vars: Record<string, string>): string {
  let result = html
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), esc(value))
  }
  return result
}
