import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Hr,
  Preview,
  Link,
  Button,
} from '@react-email/components'
import * as React from 'react'

interface BoletoInvoiceEmailProps {
  customerName: string
  planName: string
  amount: string
  boletoNumber?: string
  expirationDate?: string
  hostedVoucherUrl?: string
  hostedInvoiceUrl?: string
}

export default function BoletoInvoiceEmail({
  customerName,
  planName,
  amount,
  boletoNumber,
  expirationDate,
  hostedVoucherUrl,
  hostedInvoiceUrl,
}: BoletoInvoiceEmailProps) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>
        Seu boleto para o plano {planName} esta disponivel - R$ {amount}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={headerSection}>
            <Text style={logo}>Labrego CRM</Text>
          </Section>

          <Section style={contentSection}>
            <Text style={heading}>Boleto disponivel!</Text>

            <Text style={paragraph}>
              Ola{customerName ? `, ${customerName}` : ''}! Seu boleto para a
              assinatura do plano <strong>{planName}</strong> foi gerado com
              sucesso.
            </Text>

            <Section style={detailsBox}>
              <Text style={detailLabel}>Plano:</Text>
              <Text style={detailValue}>{planName}</Text>

              <Text style={detailLabel}>Valor:</Text>
              <Text style={detailValue}>R$ {amount}</Text>

              {expirationDate && (
                <>
                  <Text style={detailLabel}>Vencimento:</Text>
                  <Text style={detailValue}>{expirationDate}</Text>
                </>
              )}

              {boletoNumber && (
                <>
                  <Text style={detailLabel}>Codigo de barras:</Text>
                  <Text style={barcodeValue}>{boletoNumber}</Text>
                </>
              )}
            </Section>

            {hostedVoucherUrl && (
              <Section style={buttonSection}>
                <Button style={primaryButton} href={hostedVoucherUrl}>
                  Visualizar Boleto (PDF)
                </Button>
              </Section>
            )}

            {hostedInvoiceUrl && (
              <Section style={buttonSection}>
                <Button style={secondaryButton} href={hostedInvoiceUrl}>
                  Ver Fatura Completa
                </Button>
              </Section>
            )}

            <Text style={warningText}>
              Atencao: O boleto pode levar ate 3 dias uteis para ser compensado
              apos o pagamento. Seu plano sera ativado automaticamente apos a
              confirmacao.
            </Text>

            <Text style={paragraph}>
              Voce pode copiar o codigo de barras acima e pagar pelo aplicativo
              do seu banco, internet banking ou em qualquer casa loterica.
            </Text>
          </Section>

          <Hr style={hr} />

          <Section style={footerSection}>
            <Text style={footer}>
              Este email foi enviado automaticamente pelo Labrego CRM. Se voce
              nao solicitou esta assinatura, entre em contato com nosso suporte.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

const main: React.CSSProperties = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
}

const container: React.CSSProperties = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  maxWidth: '560px',
  borderRadius: '8px',
  overflow: 'hidden',
  border: '1px solid #e2e8f0',
}

const headerSection: React.CSSProperties = {
  backgroundColor: '#4f46e5',
  padding: '24px 32px',
}

const logo: React.CSSProperties = {
  color: '#ffffff',
  fontSize: '20px',
  fontWeight: '700',
  margin: '0',
}

const contentSection: React.CSSProperties = {
  padding: '32px',
}

const heading: React.CSSProperties = {
  fontSize: '22px',
  fontWeight: '600',
  color: '#1a202c',
  margin: '0 0 16px',
}

const paragraph: React.CSSProperties = {
  fontSize: '14px',
  lineHeight: '24px',
  color: '#4a5568',
  margin: '0 0 16px',
}

const detailsBox: React.CSSProperties = {
  backgroundColor: '#f7fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '16px 20px',
  margin: '16px 0',
}

const detailLabel: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: '600',
  color: '#718096',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  margin: '0 0 2px',
}

const detailValue: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: '500',
  color: '#1a202c',
  margin: '0 0 12px',
}

const barcodeValue: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: '500',
  color: '#1a202c',
  margin: '0 0 12px',
  fontFamily: 'monospace',
  wordBreak: 'break-all' as const,
  lineHeight: '20px',
}

const buttonSection: React.CSSProperties = {
  textAlign: 'center' as const,
  margin: '8px 0',
}

const primaryButton: React.CSSProperties = {
  backgroundColor: '#4f46e5',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: '600',
  padding: '12px 24px',
  borderRadius: '6px',
  textDecoration: 'none',
  display: 'inline-block',
}

const secondaryButton: React.CSSProperties = {
  backgroundColor: '#ffffff',
  color: '#4f46e5',
  fontSize: '14px',
  fontWeight: '600',
  padding: '10px 24px',
  borderRadius: '6px',
  textDecoration: 'none',
  display: 'inline-block',
  border: '2px solid #4f46e5',
}

const warningText: React.CSSProperties = {
  fontSize: '13px',
  color: '#d69e2e',
  fontWeight: '500',
  margin: '16px 0',
  backgroundColor: '#fffff0',
  border: '1px solid #fefcbf',
  borderRadius: '6px',
  padding: '12px 16px',
}

const hr: React.CSSProperties = {
  borderColor: '#e2e8f0',
  margin: '0',
}

const footerSection: React.CSSProperties = {
  padding: '20px 32px',
}

const footer: React.CSSProperties = {
  fontSize: '12px',
  color: '#a0aec0',
  lineHeight: '20px',
  margin: '0',
}
