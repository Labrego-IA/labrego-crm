const { google } = require('googleapis');
const http = require('http');
const url = require('url');

require('dotenv').config();

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3333/oauth2callback';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Erro: GOOGLE_OAUTH_CLIENT_ID e GOOGLE_OAUTH_CLIENT_SECRET devem estar no .env');
  process.exit(1);
}
const SCOPES = ['https://www.googleapis.com/auth/calendar'];

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  prompt: 'consent'
});

console.log('\n🔐 Abra este link no navegador:\n');
console.log(authUrl);
console.log('\n⏳ Aguardando autorização...\n');

const server = http.createServer(async (req, res) => {
  const queryParams = url.parse(req.url, true).query;
  
  if (queryParams.code) {
    res.end('✅ Autorizado! Pode fechar esta janela.');
    
    try {
      const { tokens } = await oauth2Client.getToken(queryParams.code);
      console.log('\n✅ Tokens obtidos com sucesso!\n');
      console.log('Adicione ao seu .env:\n');
      console.log(`GOOGLE_OAUTH_CLIENT_ID=${CLIENT_ID}`);
      console.log(`GOOGLE_OAUTH_CLIENT_SECRET=${CLIENT_SECRET}`);
      console.log(`GOOGLE_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}`);
      console.log('\n');
      server.close();
      process.exit(0);
    } catch (error) {
      console.error('Erro ao obter tokens:', error);
      server.close();
      process.exit(1);
    }
  }
}).listen(3333);
