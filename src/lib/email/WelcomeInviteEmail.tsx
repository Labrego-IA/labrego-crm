import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Hr,
  Preview,
} from '@react-email/components'
import * as React from 'react'

interface WelcomeInviteEmailProps {
  displayName: string
  email: string
  password: string
  inviterName: string
  orgName: string
  role: string
  loginUrl?: string
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  manager: 'Gerente',
  seller: 'Vendedor',
  viewer: 'Visualizador',
}

export default function WelcomeInviteEmail({
  displayName,
  email,
  password,
  inviterName,
  orgName,
  role,
  loginUrl = 'https://app.labregocrm.com/login',
}: WelcomeInviteEmailProps) {
  const roleLabel = ROLE_LABELS[role] || role

  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>
        Voce foi convidado(a) para o {orgName} no Labrego CRM
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={headerSection}>
            <Text style={logo}>Labrego CRM</Text>
          </Section>

          <Section style={contentSection}>
            <Text style={heading}>Bem-vindo(a), {displayName}!</Text>

            <Text style={paragraph}>
              <strong>{inviterName}</strong> convidou voce para fazer parte da
              organizacao <strong>{orgName}</strong> com o cargo de{' '}
              <strong>{roleLabel}</strong>.
            </Text>

            <Text style={paragraph}>
              Uma conta foi criada automaticamente para voce. Use as credenciais
              abaixo para acessar o sistema:
            </Text>

            <Section style={credentialsBox}>
              <Text style={credentialLabel}>Email:</Text>
              <Text style={credentialValue}>{email}</Text>
              <Text style={credentialLabel}>Senha temporaria:</Text>
              <Text style={credentialValue}>{password}</Text>
            </Section>

            <Text style={warningText}>
              Recomendamos que voce altere sua senha apos o primeiro acesso.
            </Text>

            <Text style={paragraph}>
              Ao fazer login, voce recebera uma notificacao para aceitar o
              convite de parceria. Apos aceitar, tera acesso as funcionalidades
              do sistema conforme as permissoes definidas para o seu cargo.
            </Text>
          </Section>

          <Hr style={hr} />

          <Section style={footerSection}>
            <Text style={footer}>
              Este email foi enviado automaticamente pelo Labrego CRM. Se voce
              nao esperava receber este convite, pode ignorar esta mensagem.
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

const credentialsBox: React.CSSProperties = {
  backgroundColor: '#f7fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '16px 20px',
  margin: '16px 0',
}

const credentialLabel: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: '600',
  color: '#718096',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  margin: '0 0 2px',
}

const credentialValue: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: '500',
  color: '#1a202c',
  margin: '0 0 12px',
  fontFamily: 'monospace',
}

const warningText: React.CSSProperties = {
  fontSize: '13px',
  color: '#e53e3e',
  fontWeight: '500',
  margin: '0 0 16px',
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
