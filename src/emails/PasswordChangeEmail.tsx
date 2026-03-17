import {
  Html,
  Body,
  Head,
  Heading,
  Text,
  Button,
  Section,
  Container,
} from '@react-email/components'

interface Props {
  token: string
}

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.voxium.com.br'

export default function PasswordChangeEmail({ token }: Props) {
  const confirmUrl = `${BASE_URL}/api/confirm-password-change?token=${token}`
  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: '#f8fafc', fontFamily: 'sans-serif' }}>
        <Container>
          <Section>
            <Heading>Confirmação de Troca de Senha</Heading>
            <Text>Você solicitou a troca de senha na sua conta Voxium CRM.</Text>
            <Text>Clique no botão abaixo para confirmar. O link expira em 30 minutos.</Text>
            <Button href={confirmUrl}>Confirmar troca de senha</Button>
            <Text style={{ fontSize: 12, color: '#64748b' }}>
              Se você não solicitou essa troca, ignore este email.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
