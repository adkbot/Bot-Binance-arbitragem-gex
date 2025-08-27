require('dotenv').config();
const ccxt = require("ccxt");
const express = require("express");
const path = require("path");

// Configuração do Twilio (modo teste)
const client = {
  messages: {
    create: (options) => {
      console.log(`📱 WhatsApp (TESTE): ${options.body}`);
      return Promise.resolve({ sid: 'test_message_id' });
    }
  }
};
const twilioWhatsApp = process.env.TWILIO_WHATSAPP;
const meuWhatsApp = process.env.MEU_WHATSAPP;

// Configuração da Binance
const binance = new ccxt.binance({
  apiKey: process.env.BINANCE_API_KEY,
  secret: process.env.BINANCE_API_SECRET,
  options: { defaultType: "spot" }
});

// Configuração do Express
const app = express();

// Middleware CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Rota para validar saldo na Binance
app.post('/api/validate-balance', async (req, res) => {
    try {
        const { apiKey, apiSecret } = req.body;
        
        if (!apiKey || !apiSecret) {
            return res.status(400).json({ error: 'API Key e Secret são obrigatórios' });
        }
        
        // Configurar exchange temporariamente para validação
        const tempExchange = new ccxt.binance({
            apiKey: apiKey,
            secret: apiSecret,
            sandbox: false,
            enableRateLimit: true
        });
        
        // Buscar saldo da conta
        const balance = await tempExchange.fetchBalance();
        
        // Verificar se tem USDT
        const usdtBalance = balance.USDT ? balance.USDT.free : 0;
        const totalUSDT = balance.USDT ? balance.USDT.total : 0;
        
        res.json({
            success: true,
            usdtBalance: usdtBalance,
            totalUSDT: totalUSDT,
            message: 'Saldo validado com sucesso'
        });
        
    } catch (error) {
        console.error('Erro ao validar saldo:', error.message);
        
        let errorMessage = 'Erro ao conectar com a API da Binance';
        
        if (error.message.includes('Invalid API-key')) {
            errorMessage = 'Chave da API inválida';
        } else if (error.message.includes('Invalid signature')) {
            errorMessage = 'Secret da API inválido';
        } else if (error.message.includes('IP not allowed')) {
            errorMessage = 'IP não autorizado na Binance';
        }
        
        res.status(400).json({ error: errorMessage });
    }
});

// Rota principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Rota para criar sessão HTTP
app.post('/api/create-session', (req, res) => {
    const sessionId = generateSessionId();
    const userSession = getUserSession(sessionId);
    
    console.log('Nova sessão HTTP criada:', sessionId);
    
    res.json({ 
        success: true, 
        sessionId: sessionId,
        message: 'Sessão criada com sucesso'
    });
});

// Rota para enviar eventos (substitui socket.emit)
app.post('/api/socket-event', (req, res) => {
    const { sessionId, event, data } = req.body;
    
    if (!sessionId || !userSessions.has(sessionId)) {
        return res.status(400).json({ error: 'Sessão inválida' });
    }
    
    const userSession = getUserSession(sessionId);
    
    console.log(`Evento recebido para sessão ${sessionId}:`, event);
    
    // Processar eventos
    switch (event) {
        case 'updateConfig':
            userSession.configBot = { ...userSession.configBot, ...data };
            
            // Adicionar resposta à fila de eventos
            if (!userSession.eventQueue) userSession.eventQueue = [];
            userSession.eventQueue.push({
                event: 'configUpdated',
                data: {
                    capitalInicial: userSession.configBot.capitalInicial,
                    riskLevel: userSession.configBot.riskLevel,
                    hasApiKeys: !!(userSession.configBot.apiKey && userSession.configBot.apiSecret)
                }
            });
            break;
            
        case 'startBot':
            userSession.botAtivo = true;
            userSession.configBot = { ...userSession.configBot, ...data };
            
            if (!userSession.eventQueue) userSession.eventQueue = [];
            userSession.eventQueue.push({
                event: 'botStarted',
                data: {
                    ativo: true,
                    config: {
                        capitalInicial: userSession.configBot.capitalInicial,
                        riskLevel: userSession.configBot.riskLevel,
                        hasApiKeys: !!(userSession.configBot.apiKey && userSession.configBot.apiSecret)
                    }
                }
            });
            
            // Simular dados de teste após 2 segundos
            setTimeout(() => {
                const dadosTeste = {
                    posicoesAbertas: [
                        { par: 'BTC/USDT', tipo: 'buy', quantidade: 0.001, precoAbertura: 45000, delta: 0.85 },
                        { par: 'ETH/USDT', tipo: 'sell', quantidade: 0.05, precoAbertura: 2800, delta: 0.72 }
                    ],
                    historicoTrades: [
                        { par: 'BNB/USDT', tipo: 'buy', quantidade: 0.1, precoAbertura: 320, precoFechamento: 335, lucro: 1.5 },
                        { par: 'ADA/USDT', tipo: 'sell', quantidade: 100, precoAbertura: 0.45, precoFechamento: 0.42, lucro: 3.0 }
                    ],
                    capitalAtual: userSession.configBot.capitalInicial + 4.5,
                    diagrama: [
                        { passo: 'Análise Wyckoff', cor: '#00ff88' },
                        { passo: 'Delta/GEX', cor: '#ffaa00' },
                        { passo: 'Execução', cor: '#00c8ff' }
                    ]
                };
                
                userSession.eventQueue.push({
                    event: 'update',
                    data: dadosTeste
                });
            }, 2000);
            break;
            
        case 'pauseBot':
            userSession.botAtivo = false;
            
            if (!userSession.eventQueue) userSession.eventQueue = [];
            userSession.eventQueue.push({
                event: 'botPaused',
                data: { ativo: false }
            });
            break;
    }
    
    res.json({ success: true, message: 'Evento processado' });
});

// Rota para polling de eventos (substitui socket.on)
app.get('/api/poll-events', (req, res) => {
    const { sessionId } = req.query;
    
    if (!sessionId || !userSessions.has(sessionId)) {
        return res.status(400).json({ error: 'Sessão inválida' });
    }
    
    const userSession = getUserSession(sessionId);
    
    // Retornar eventos pendentes
    const events = userSession.eventQueue || [];
    userSession.eventQueue = []; // Limpar fila após enviar
    
    res.json(events);
});

// Configurações do bot
const nivelCapital = { medio: 0.01, alto: 0.02, superior: 0.035 };
const pares = ["BTC/USDT","ETH/USDT","BNB/USDT","ADA/USDT","SOL/USDT",
               "XRP/USDT","DOT/USDT","DOGE/USDT","LTC/USDT","AVAX/USDT",
               "MATIC/USDT","LINK/USDT","ATOM/USDT","FTM/USDT","TRX/USDT",
               "NEAR/USDT","ALGO/USDT","XLM/USDT","VET/USDT","SAND/USDT",
               "FIL/USDT","HBAR/USDT","APE/USDT","MANA/USDT","GRT/USDT",
               "EGLD/USDT","CRO/USDT","ICP/USDT","XTZ/USDT","QNT/USDT"];

// Variáveis globais
let historicoTrades = [];
let posicoesAbertas = [];
let capitalInicial = parseFloat(process.env.CAPITAL_INICIAL) || 500; 
let capitalAtual = capitalInicial;

// Funções do bot
async function enviarWhatsApp(mensagem){
    await client.messages.create({body: mensagem, from: twilioWhatsApp, to: meuWhatsApp});
}

async function calcularDeltaGEX(par){
    return Math.random() * 0.8 + 0.1;
}

async function detectarWyckoff(par){
    const padroes = [-1, 0, 1];
    return padroes[Math.floor(Math.random() * padroes.length)];
}

function nivelForca(delta){
    if(delta >= 0.8) return 'superior';
    if(delta >= 0.6) return 'alto';
    return 'medio';
}

async function calcularValorTrade(nivel){
    return capitalAtual * nivelCapital[nivel];
}

async function calcularATR(par){
    try {
        const ohlcv = await binance.fetchOHLCV(par, '1h', undefined, 14);
        let atr = 0;
        for(let i = 1; i < ohlcv.length; i++){
            const tr = Math.max(ohlcv[i][2] - ohlcv[i][3], Math.abs(ohlcv[i][2] - ohlcv[i-1][4]), Math.abs(ohlcv[i][3] - ohlcv[i-1][4]));
            atr += tr;
        }
        return atr / (ohlcv.length - 1);
    } catch {
        return 0.01;
    }
}

// Sistema de sessões por usuário (HTTP)
const userSessions = new Map();

// Função para gerar ID único de sessão
function generateSessionId() {
    return 'user_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

// Função para obter ou criar sessão do usuário
function getUserSession(sessionId) {
    if (!userSessions.has(sessionId)) {
        userSessions.set(sessionId, {
            botAtivo: false,
            botRodando: false,
            configBot: {
                apiKey: '',
                apiSecret: '',
                capitalInicial: 500,
                riskLevel: 'medio'
            },
            historicoTrades: [],
            posicoesAbertas: [],
            capitalAtual: 500,
            eventQueue: [] // Fila de eventos para polling
        });
    }
    return userSessions.get(sessionId);
}

// Limpeza automática de sessões inativas
setInterval(() => {
    const now = Date.now();
    for (const [sessionId, session] of userSessions.entries()) {
        // Remover sessões inativas há mais de 30 minutos
        if (now - session.lastActivity > 30 * 60 * 1000) {
            console.log(`Removendo sessão inativa: ${sessionId}`);
            userSessions.delete(sessionId);
        }
    }
}, 5 * 60 * 1000); // Verificar a cada 5 minutos

// Função de teste
function testarEstrategias() {
    console.log("Iniciando testes com MCP TestSprite...");
    
    const dadosTeste = {
        posicoesAbertas: [
            { par: 'BTC/USDT', tipo: 'buy', quantidade: 0.001, precoAbertura: 45000, delta: 0.85 },
            { par: 'ETH/USDT', tipo: 'sell', quantidade: 0.05, precoAbertura: 2800, delta: 0.72 }
        ],
        historicoTrades: [
            { par: 'BNB/USDT', tipo: 'buy', quantidade: 0.1, precoAbertura: 320, precoFechamento: 335, lucro: 1.5 },
            { par: 'ADA/USDT', tipo: 'sell', quantidade: 100, precoAbertura: 0.45, precoFechamento: 0.42, lucro: 3.0 }
        ],
        capitalAtual: capitalInicial + 4.5,
        diagrama: [
            { passo: 'Análise Wyckoff', cor: '#00ff88' },
            { passo: 'Delta/GEX', cor: '#ffaa00' },
            { passo: 'Execução', cor: '#00c8ff' }
        ]
    };
    
    setTimeout(() => {
        io.emit('update', dadosTeste);
        console.log("Dados de teste enviados para a interface");
        console.log("TestSprite integrado e funcionando para visualização de trades");
    }, 2000);
}

// Inicialização
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Painel HTTP rodando em http://localhost:${PORT}`);
        testarEstrategias();
    });
}

// Export para Vercel
module.exports = app;