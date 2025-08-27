# 🤖 Bot Binance - Painel Futurístico

Sistema de trading automatizado com interface futurística para análise e execução de trades na Binance.

## 🚀 Funcionalidades

- ✅ **Análise Wyckoff** - Identificação de padrões de acumulação/distribuição
- ✅ **Delta Flow Analysis** - Análise do fluxo de ordens
- ✅ **GEX Analysis** - Gamma Exposure para suporte/resistência
- ✅ **ATR Risk Management** - Gestão de risco dinâmica
- ✅ **Interface Futurística** - Design moderno e responsivo
- ✅ **Monitoramento em Tempo Real** - Carrossel de ativos e indicadores
- ✅ **Validação de Saldo** - Verificação automática via API Binance
- ✅ **Notificações WhatsApp** - Alertas de trades

## 🛠️ Tecnologias

- **Backend**: Node.js, Express, Socket.IO
- **Frontend**: HTML5, CSS3, JavaScript, Chart.js
- **API**: Binance (ccxt), Twilio
- **Deploy**: Vercel Ready

## 📦 Instalação Local

```bash
# Clone o repositório
git clone <seu-repositorio>
cd bot

# Instale as dependências
npm install

# Configure as variáveis de ambiente
cp .env.example .env
# Edite o arquivo .env com suas chaves

# Execute o projeto
npm start
```

## 🌐 Deploy no Vercel

### Método 1: Via GitHub (Recomendado)

1. **Suba o código para o GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/seu-usuario/seu-repo.git
   git push -u origin main
   ```

2. **Deploy no Vercel**:
   - Acesse [vercel.com](https://vercel.com)
   - Conecte sua conta GitHub
   - Clique em "New Project"
   - Selecione seu repositório
   - Configure as variáveis de ambiente:
     - `BINANCE_API_KEY`
     - `BINANCE_API_SECRET`
     - `TWILIO_ACCOUNT_SID`
     - `TWILIO_AUTH_TOKEN`
     - `TWILIO_WHATSAPP`
     - `MEU_WHATSAPP`
     - `CAPITAL_INICIAL`
   - Clique em "Deploy"

### Método 2: Via Vercel CLI

```bash
# Instale o Vercel CLI
npm i -g vercel

# Faça login
vercel login

# Deploy
vercel

# Configure as variáveis de ambiente
vercel env add BINANCE_API_KEY
vercel env add BINANCE_API_SECRET
# ... adicione todas as variáveis

# Redeploy com as variáveis
vercel --prod
```

## ⚙️ Configuração

### Variáveis de Ambiente

```env
# API Binance
BINANCE_API_KEY=sua_api_key_aqui
BINANCE_API_SECRET=seu_api_secret_aqui

# Twilio (WhatsApp)
TWILIO_ACCOUNT_SID=seu_account_sid
TWILIO_AUTH_TOKEN=seu_auth_token
TWILIO_WHATSAPP=whatsapp:+14155238886
MEU_WHATSAPP=whatsapp:+5511999999999

# Configurações do Bot
CAPITAL_INICIAL=500
```

### Configuração da API Binance

1. Acesse [Binance API Management](https://www.binance.com/en/my/settings/api-management)
2. Crie uma nova API Key
3. Configure as permissões:
   - ✅ Enable Reading
   - ✅ Enable Spot & Margin Trading
   - ❌ Enable Withdrawals (não necessário)
4. Adicione seu IP à whitelist (opcional, mas recomendado)

## 🎮 Como Usar

1. **Acesse a interface** (local: http://localhost:3000)
2. **Configure a API**:
   - Clique no ícone ⚙️
   - Insira suas chaves da Binance
   - Defina o capital inicial (mínimo $20)
   - Escolha o nível de risco
3. **Inicie o bot**:
   - Clique em "▶️ Iniciar Bot"
   - Aguarde a validação do saldo
   - Monitore as operações em tempo real

## 📊 Interface

- **Carrossel de Ativos**: Mostra pares sendo analisados
- **Estatísticas**: Capital, trades, posições, lucro
- **Gráfico de Performance**: Evolução do capital
- **Força das Posições**: Indicadores visuais
- **TestSprite**: Visualização animada de trades
- **Fluxo do Sistema**: Diagrama do processo

## 🔒 Segurança

- ✅ Validação de saldo em tempo real
- ✅ Verificação de chaves API
- ✅ Gestão de risco com ATR
- ✅ Stop-loss automático
- ✅ Monitoramento de erros

## 📱 Suporte

- **Responsivo**: Funciona em desktop, tablet e mobile
- **Tema**: Modo escuro/claro
- **Notificações**: Feedback visual em tempo real
- **Validações**: Mensagens claras de erro/sucesso

## 🚨 Aviso Legal

Este sistema é para fins educacionais e de demonstração. Trading de criptomoedas envolve riscos significativos. Use apenas capital que você pode perder. Sempre teste em ambiente de sandbox antes de usar com dinheiro real.

## 📄 Licença

MIT License - veja o arquivo LICENSE para detalhes.

---

**Desenvolvido com ❤️ para traders que buscam automação e tecnologia de ponta!**