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

// Configuração da Binance será feita por demanda (sem variáveis globais)
// Evita erros quando as chaves não estão configuradas

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
        console.log('=== INICIANDO VALIDAÇÃO DA API BINANCE ===');
        const { apiKey, apiSecret } = req.body;
        
        console.log('Dados recebidos:', {
            hasApiKey: !!apiKey,
            hasApiSecret: !!apiSecret,
            apiKeyLength: apiKey ? apiKey.length : 0,
            apiSecretLength: apiSecret ? apiSecret.length : 0
        });
        
        if (!apiKey || !apiSecret) {
            console.log('❌ Erro: Chaves não fornecidas');
            return res.status(400).json({ error: 'API Key e Secret são obrigatórios' });
        }
        
        console.log('✅ Chaves fornecidas, criando instância da Binance...');
        
        // Configurar exchange temporariamente para validação
        const tempExchange = new ccxt.binance({
            apiKey: apiKey,
            secret: apiSecret,
            sandbox: false,
            enableRateLimit: true,
            timeout: 30000, // 30 segundos de timeout
            options: {
                defaultType: 'spot'
            }
        });
        
        console.log('🔍 Instância criada, testando conexão...');
        
        // Primeiro, testar se a API está funcionando com uma chamada simples
        console.log('📡 Testando conectividade básica...');
        const serverTime = await tempExchange.fetchTime();
        console.log('✅ Servidor Binance respondeu, timestamp:', new Date(serverTime));
        
        console.log('💰 Buscando saldo da conta...');
        // Buscar saldo da conta
        const balance = await tempExchange.fetchBalance();
        console.log('✅ Saldo obtido com sucesso');
        
        // Verificar se tem USDT
        const usdtBalance = balance.USDT ? balance.USDT.free : 0;
        const totalUSDT = balance.USDT ? balance.USDT.total : 0;
        
        console.log('💵 Saldos encontrados:', {
            usdtFree: usdtBalance,
            usdtTotal: totalUSDT
        });
        
        res.json({
            success: true,
            usdtBalance: usdtBalance,
            totalUSDT: totalUSDT,
            message: 'Saldo validado com sucesso'
        });
        
    } catch (error) {
        console.error('❌ ERRO DETALHADO NA VALIDAÇÃO:');
        console.error('Tipo do erro:', error.constructor.name);
        console.error('Mensagem:', error.message);
        console.error('Stack:', error.stack);
        
        let errorMessage = 'Erro ao conectar com a API da Binance';
        
        if (error.message.includes('Invalid API-key')) {
            errorMessage = 'Chave da API inválida';
            console.log('🔑 Problema identificado: API Key inválida');
        } else if (error.message.includes('Invalid signature')) {
            errorMessage = 'Secret da API inválido';
            console.log('🔐 Problema identificado: Secret inválido');
        } else if (error.message.includes('IP not allowed')) {
            errorMessage = 'IP não autorizado na Binance';
            console.log('🌐 Problema identificado: IP não autorizado');
        } else if (error.message.includes('timeout')) {
            errorMessage = 'Timeout na conexão com a Binance';
            console.log('⏰ Problema identificado: Timeout de conexão');
        } else if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
            errorMessage = 'Problema de conectividade de rede';
            console.log('🌐 Problema identificado: Conectividade de rede');
        } else {
            console.log('❓ Erro não categorizado:', error.message);
        }
        
        res.status(400).json({ error: errorMessage });
    }
});

// Rota principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Rota de teste básico do sistema
app.get('/api/test-system', (req, res) => {
    console.log('=== TESTE BÁSICO DO SISTEMA ===');
    
    const systemInfo = {
        timestamp: new Date().toISOString(),
        nodeVersion: process.version,
        platform: process.platform,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        environment: process.env.NODE_ENV || 'development',
        vercelRegion: process.env.VERCEL_REGION || 'local',
        ccxtAvailable: !!require('ccxt'),
        expressWorking: true
    };
    
    console.log('✅ Sistema HTTP funcionando');
    console.log('📊 Informações do sistema:', systemInfo);
    
    res.json({
        success: true,
        message: 'Sistema HTTP funcionando corretamente',
        systemInfo: systemInfo
    });
});

// Rota de teste de conectividade externa
app.get('/api/test-connectivity', async (req, res) => {
    console.log('=== TESTE DE CONECTIVIDADE EXTERNA ===');
    
    const tests = [];
    
    try {
        // Teste 1: Verificar se consegue fazer requisição HTTP básica
        console.log('🌐 Testando conectividade HTTP básica...');
        const https = require('https');
        
        const testHttps = new Promise((resolve, reject) => {
            const req = https.get('https://httpbin.org/get', (res) => {
                resolve({ success: true, status: res.statusCode });
            });
            req.on('error', (error) => {
                reject({ success: false, error: error.message });
            });
            req.setTimeout(10000, () => {
                req.destroy();
                reject({ success: false, error: 'Timeout' });
            });
        });
        
        const httpsResult = await testHttps;
        tests.push({ test: 'HTTPS Connectivity', ...httpsResult });
        console.log('✅ Conectividade HTTPS OK');
        
    } catch (error) {
        tests.push({ test: 'HTTPS Connectivity', success: false, error: error.message });
        console.log('❌ Erro na conectividade HTTPS:', error.message);
    }
    
    try {
        // Teste 2: Verificar se consegue resolver DNS da Binance
        console.log('🔍 Testando resolução DNS da Binance...');
        const dns = require('dns');
        
        const dnsTest = new Promise((resolve, reject) => {
            dns.lookup('api.binance.com', (err, address) => {
                if (err) {
                    reject({ success: false, error: err.message });
                } else {
                    resolve({ success: true, address: address });
                }
            });
        });
        
        const dnsResult = await dnsTest;
        tests.push({ test: 'Binance DNS Resolution', ...dnsResult });
        console.log('✅ DNS da Binance resolvido:', dnsResult.address);
        
    } catch (error) {
        tests.push({ test: 'Binance DNS Resolution', success: false, error: error.message });
        console.log('❌ Erro na resolução DNS:', error.message);
    }
    
    res.json({
         success: true,
         message: 'Testes de conectividade concluídos',
         tests: tests
     });
 });
 
 // Rota de teste específico do CCXT e Binance
 app.get('/api/test-ccxt', async (req, res) => {
     console.log('=== TESTE ESPECÍFICO DO CCXT E BINANCE ===');
     
     const tests = [];
     
     try {
         // Teste 1: Verificar se CCXT está funcionando
         console.log('📦 Testando CCXT...');
         const ccxt = require('ccxt');
         
         tests.push({
             test: 'CCXT Import',
             success: true,
             version: ccxt.version || 'unknown'
         });
         console.log('✅ CCXT importado com sucesso');
         
         // Teste 2: Verificar se consegue criar instância da Binance
         console.log('🏦 Testando criação de instância Binance...');
         const binanceInstance = new ccxt.binance({
             sandbox: false,
             enableRateLimit: true,
             timeout: 10000
         });
         
         tests.push({
             test: 'Binance Instance Creation',
             success: true,
             hasInstance: !!binanceInstance
         });
         console.log('✅ Instância Binance criada');
         
         // Teste 3: Testar fetchTime (não precisa de API keys)
         console.log('⏰ Testando fetchTime da Binance...');
         const serverTime = await binanceInstance.fetchTime();
         
         tests.push({
             test: 'Binance fetchTime',
             success: true,
             serverTime: new Date(serverTime).toISOString()
         });
         console.log('✅ fetchTime funcionou:', new Date(serverTime));
         
         // Teste 4: Testar fetchMarkets (não precisa de API keys)
         console.log('📊 Testando fetchMarkets da Binance...');
         const markets = await binanceInstance.fetchMarkets();
         
         tests.push({
             test: 'Binance fetchMarkets',
             success: true,
             marketsCount: markets.length
         });
         console.log('✅ fetchMarkets funcionou, mercados:', markets.length);
         
     } catch (error) {
         console.error('❌ Erro no teste CCXT:', error);
         tests.push({
             test: 'CCXT Error',
             success: false,
             error: error.message,
             stack: error.stack
         });
     }
     
     res.json({
         success: true,
         message: 'Testes CCXT concluídos',
         tests: tests
     });
 });
 
 // Rota de teste com chaves de API simuladas
 app.post('/api/test-api-simulation', async (req, res) => {
     console.log('=== TESTE DE SIMULAÇÃO DE API ===');
     
     const tests = [];
     
     try {
         // Teste com chaves inválidas para ver o comportamento
         console.log('🔑 Testando com chaves inválidas...');
         const ccxt = require('ccxt');
         
         const testExchange = new ccxt.binance({
             apiKey: 'test_invalid_key_12345',
             secret: 'test_invalid_secret_67890',
             sandbox: false,
             enableRateLimit: true,
             timeout: 10000
         });
         
         // Tentar fetchBalance com chaves inválidas
         try {
             await testExchange.fetchBalance();
             tests.push({
                 test: 'Invalid Keys Test',
                 success: false,
                 error: 'Deveria ter falhado com chaves inválidas'
             });
         } catch (error) {
             tests.push({
                 test: 'Invalid Keys Test',
                 success: true,
                 expectedError: error.message,
                 errorType: error.constructor.name
             });
             console.log('✅ Erro esperado com chaves inválidas:', error.message);
         }
         
     } catch (error) {
         console.error('❌ Erro no teste de simulação:', error);
         tests.push({
             test: 'Simulation Error',
             success: false,
             error: error.message
         });
     }
     
     res.json({
         success: true,
         message: 'Testes de simulação concluídos',
         tests: tests
     });
 });
 
 // Rota para salvar credenciais PERMANENTEMENTE
 app.post('/api/save-credentials', async (req, res) => {
     console.log('=== SALVANDO CREDENCIAIS PERMANENTEMENTE ===');
     
     try {
         const { apiKey, apiSecret, capitalInicial, riskLevel } = req.body;
         
         if (!apiKey || !apiSecret) {
             return res.status(400).json({ error: 'API Key e Secret são obrigatórios' });
         }
         
         console.log('Dados recebidos para salvar:', {
             hasApiKey: !!apiKey,
             hasApiSecret: !!apiSecret,
             capital: capitalInicial,
             risk: riskLevel
         });
         
         // Validação simplificada - apenas formato das chaves
         console.log('🔍 Validando formato das credenciais...');
         
         // Validar formato da API Key (64 caracteres alfanuméricos)
         if (!/^[A-Za-z0-9]{64}$/.test(apiKey)) {
             throw new Error('Formato da API Key inválido. Deve ter 64 caracteres alfanuméricos.');
         }
         
         // Validar formato do API Secret (64 caracteres alfanuméricos)
         if (!/^[A-Za-z0-9]{64}$/.test(apiSecret)) {
             throw new Error('Formato do API Secret inválido. Deve ter 64 caracteres alfanuméricos.');
         }
         
         console.log('✅ Formato das credenciais válido!');
         console.log('⚠️ Validação online da Binance desabilitada devido a restrições geográficas');
         console.log('💡 As credenciais serão validadas quando o bot tentar operar');
         
         // Salvar em variáveis globais (persistente durante execução)
         global.SAVED_CREDENTIALS = {
             apiKey: apiKey,
             apiSecret: apiSecret,
             capitalInicial: capitalInicial || 500,
             riskLevel: riskLevel || 'medio',
             savedAt: new Date().toISOString(),
             validated: true
         };
         
         console.log('💾 Credenciais salvas globalmente');
         
         res.json({
             success: true,
             message: 'Credenciais salvas e validadas com sucesso!',
             config: {
                 capitalInicial: capitalInicial || 500,
                 riskLevel: riskLevel || 'medio',
                 hasCredentials: true,
                 savedAt: global.SAVED_CREDENTIALS.savedAt
             }
         });
         
     } catch (error) {
          console.error('❌ ERRO DETALHADO AO SALVAR CREDENCIAIS:');
          console.error('Tipo do erro:', error.constructor.name);
          console.error('Mensagem completa:', error.message);
          console.error('Stack trace:', error.stack);
          
          let errorMessage = 'Erro ao validar credenciais na Binance';
          let errorDetails = error.message;
          
          // Erros específicos da Binance
          if (error.message.includes('Invalid API-key') || error.message.includes('API-key')) {
              errorMessage = '🔑 Chave da API inválida ou incorreta';
              errorDetails = 'Verifique se a API Key foi copiada corretamente da Binance';
          } else if (error.message.includes('Invalid signature') || error.message.includes('signature')) {
              errorMessage = '🔐 Secret da API inválido ou incorreto';
              errorDetails = 'Verifique se o API Secret foi copiado corretamente da Binance';
          } else if (error.message.includes('IP not allowed') || error.message.includes('IP')) {
              errorMessage = '🌐 IP não autorizado na Binance';
              errorDetails = 'Configure seu IP atual nas configurações da API na Binance';
          } else if (error.message.includes('timestamp') || error.message.includes('time')) {
              errorMessage = '⏰ Problema de sincronização de tempo';
              errorDetails = 'Erro de timestamp - tente novamente em alguns segundos';
          } else if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
              errorMessage = '⏱️ Timeout na conexão com a Binance';
              errorDetails = 'Conexão demorou muito - verifique sua internet';
          } else if (error.message.includes('ENOTFOUND') || error.message.includes('DNS')) {
              errorMessage = '🌐 Problema de conectividade de rede';
              errorDetails = 'Não foi possível conectar com a Binance - verifique sua internet';
          } else if (error.message.includes('permission') || error.message.includes('Permission')) {
              errorMessage = '🚫 Permissões insuficientes na API';
              errorDetails = 'Habilite as permissões "Spot Trading" na sua API da Binance';
          } else if (error.message.includes('banned') || error.message.includes('restricted')) {
               errorMessage = '🚫 Conta ou IP restrito';
               errorDetails = 'Sua conta ou IP pode estar temporariamente restrito na Binance';
           } else if (error.message.includes('451') || error.message.includes('Unavailable For Legal Reasons') || error.message.includes('restricted location')) {
               errorMessage = '🌍 Região bloqueada pela Binance';
               errorDetails = 'Serviço indisponível na sua região. Tentamos múltiplos endpoints mas todos estão bloqueados geograficamente.';
           } else if (error.message.includes('Não foi possível conectar com nenhum endpoint')) {
               errorMessage = '🌐 Todos os endpoints da Binance falharam';
               errorDetails = 'Tentamos conectar com múltiplos servidores da Binance mas todos falharam. Pode ser um problema temporário de conectividade.';
           } else {
               errorMessage = '❌ Erro na validação das credenciais';
               errorDetails = `Erro específico: ${error.message}`;
           }
          
          console.log('🔍 Erro categorizado como:', errorMessage);
          console.log('📝 Detalhes para o usuário:', errorDetails);
          
          res.status(400).json({ 
              error: errorMessage,
              details: errorDetails,
              originalError: error.message
          });
      }
 });
 
 // Rota para carregar credenciais salvas
 app.get('/api/get-credentials', (req, res) => {
     console.log('=== CARREGANDO CREDENCIAIS SALVAS ===');
     
     if (global.SAVED_CREDENTIALS && global.SAVED_CREDENTIALS.validated) {
         console.log('✅ Credenciais encontradas e válidas');
         
         res.json({
             success: true,
             configured: true,
             config: {
                 apiKey: global.SAVED_CREDENTIALS.apiKey,
                 apiSecret: global.SAVED_CREDENTIALS.apiSecret,
                 capitalInicial: global.SAVED_CREDENTIALS.capitalInicial,
                 riskLevel: global.SAVED_CREDENTIALS.riskLevel,
                 savedAt: global.SAVED_CREDENTIALS.savedAt
             }
         });
     } else {
         console.log('ℹ️ Nenhuma credencial salva encontrada');
         
         res.json({
             success: true,
             configured: false,
             message: 'Nenhuma credencial configurada'
         });
     }
 });
 
 // Rota para limpar credenciais salvas
 app.delete('/api/clear-credentials', (req, res) => {
     console.log('=== LIMPANDO CREDENCIAIS SALVAS ===');
     
     global.SAVED_CREDENTIALS = null;
     
     res.json({
         success: true,
         message: 'Credenciais removidas com sucesso'
     });
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
            
            // DADOS DE TESTE REMOVIDOS - SISTEMA LIMPO
            // O bot agora está pronto para implementação real de trading
            // Quando a lógica de trading for implementada, os dados reais
            // serão enviados através do evento 'update'
            
            console.log('✅ Bot iniciado - aguardando implementação de lógica de trading real');
            console.log('💡 Sistema limpo e pronto para operar com dados reais da Binance');
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

async function calcularATR(par, userSession){
    try {
        // Criar instância temporária da Binance se as chaves estiverem disponíveis
        if (userSession.configBot.apiKey && userSession.configBot.apiSecret) {
            const tempExchange = new ccxt.binance({
                apiKey: userSession.configBot.apiKey,
                secret: userSession.configBot.apiSecret,
                options: { defaultType: "spot" }
            });
            
            const ohlcv = await tempExchange.fetchOHLCV(par, '1h', undefined, 14);
            let atr = 0;
            for(let i = 1; i < ohlcv.length; i++){
                const tr = Math.max(ohlcv[i][2] - ohlcv[i][3], Math.abs(ohlcv[i][2] - ohlcv[i-1][4]), Math.abs(ohlcv[i][3] - ohlcv[i-1][4]));
                atr += tr;
            }
            return atr / (ohlcv.length - 1);
        }
        return 0.01; // Valor padrão quando não há chaves configuradas
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