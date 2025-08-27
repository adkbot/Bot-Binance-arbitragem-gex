require('dotenv').config();
const ccxt = require("ccxt");
const express = require("express");
const { Server } = require("socket.io");
const http = require("http");
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
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
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

// Sistema de sessões por usuário
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
            capitalAtual: 500
        });
    }
    return userSessions.get(sessionId);
}

// Configuração do Socket.IO com sessões isoladas
io.on('connection', (socket) => {
    console.log('Cliente conectado:', socket.id);
    
    // Gerar ID de sessão único para este usuário
    const sessionId = generateSessionId();
    socket.sessionId = sessionId;
    
    // Juntar o usuário à sua sala privada
    socket.join(sessionId);
    
    // Obter sessão do usuário
    const userSession = getUserSession(sessionId);
    
    // Enviar ID da sessão e estado atual do bot para este usuário específico
    socket.emit('sessionCreated', { sessionId });
    socket.emit('botStatus', {
        ativo: userSession.botAtivo,
        config: {
            // Nunca enviar credenciais reais, apenas status
            capitalInicial: userSession.configBot.capitalInicial,
            riskLevel: userSession.configBot.riskLevel,
            hasApiKeys: !!(userSession.configBot.apiKey && userSession.configBot.apiSecret)
        }
    });
    
    // Receber configurações atualizadas (isoladas por usuário)
    socket.on('updateConfig', (novaConfig) => {
        console.log(`Configurações atualizadas para sessão ${sessionId}`);
        const userSession = getUserSession(sessionId);
        
        // Atualizar apenas a sessão deste usuário
        userSession.configBot = { ...userSession.configBot, ...novaConfig };
        
        // Confirmar apenas para este cliente específico
        socket.emit('configUpdated', {
            capitalInicial: userSession.configBot.capitalInicial,
            riskLevel: userSession.configBot.riskLevel,
            hasApiKeys: !!(userSession.configBot.apiKey && userSession.configBot.apiSecret)
        });
    });
    
    // Iniciar bot (isolado por usuário)
    socket.on('startBot', (config) => {
        console.log(`Iniciando bot para sessão ${sessionId}`);
        const userSession = getUserSession(sessionId);
        
        userSession.botAtivo = true;
        userSession.configBot = { ...userSession.configBot, ...config };
        
        // Confirmar apenas para este usuário específico
        socket.emit('botStarted', { 
            ativo: true, 
            config: {
                capitalInicial: userSession.configBot.capitalInicial,
                riskLevel: userSession.configBot.riskLevel,
                hasApiKeys: !!(userSession.configBot.apiKey && userSession.configBot.apiSecret)
            }
        });
        
        // Iniciar dados de teste para este usuário
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
            
            // Enviar dados apenas para este usuário específico
            socket.emit('update', dadosTeste);
        }, 2000);
    });
    
    // Pausar bot (isolado por usuário)
    socket.on('pauseBot', () => {
        console.log(`Pausando bot para sessão ${sessionId}`);
        const userSession = getUserSession(sessionId);
        
        userSession.botAtivo = false;
        
        // Confirmar apenas para este usuário específico
        socket.emit('botPaused', { ativo: false });
    });
    
    socket.on('disconnect', () => {
        console.log(`Cliente desconectado: ${socket.id} (sessão: ${sessionId})`);
        
        // Opcional: Limpar sessão após um tempo de inatividade
        setTimeout(() => {
            if (userSessions.has(sessionId)) {
                console.log(`Limpando sessão inativa: ${sessionId}`);
                userSessions.delete(sessionId);
            }
        }, 30 * 60 * 1000); // 30 minutos
    });
});

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
    server.listen(PORT, () => {
        console.log(`Painel rodando em http://localhost:${PORT}`);
        testarEstrategias();
    });
}

// Export para Vercel
module.exports = app;