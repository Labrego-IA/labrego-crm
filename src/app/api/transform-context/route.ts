import { NextRequest, NextResponse } from 'next/server'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY

export async function POST(req: NextRequest) {
  if (!OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'OpenAI API key not configured' },
      { status: 500 }
    )
  }

  try {
    const { text } = await req.json()

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid text parameter' },
        { status: 400 }
      )
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1',
        messages: [
          {
            role: 'system',
            content: `Você é um especialista em redação comercial e propostas de negócios. Sua tarefa é melhorar o texto recebido, tornando-o mais profissional, claro e persuasivo para uso em propostas comerciais.

Regras:
- Mantenha o significado e as informações originais
- Melhore a clareza, gramática e fluidez do texto
- Use tom profissional e persuasivo
- Mantenha o texto em português do Brasil
- Não adicione informações que não estavam no texto original
- Retorne APENAS o texto melhorado, sem explicações ou comentários adicionais`,
          },
          {
            role: 'user',
            content: text,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('OpenAI API error:', response.status, errorData)
      return NextResponse.json(
        { error: 'Erro ao processar texto com IA' },
        { status: 502 }
      )
    }

    const data = await response.json()
    const result = data.choices?.[0]?.message?.content?.trim()

    if (!result) {
      return NextResponse.json(
        { error: 'Resposta vazia da IA' },
        { status: 502 }
      )
    }

    return NextResponse.json({ result })
  } catch (error) {
    console.error('Error in transform-context:', error)
    return NextResponse.json(
      { error: 'Erro interno ao processar texto' },
      { status: 500 }
    )
  }
}
