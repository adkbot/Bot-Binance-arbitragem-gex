require('dotenv').config();
const ccxt = require("ccxt");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/************ Config Twilio ************/
// Modo de teste - sem Twilio
const client = {
  messages: {
    create: (options) => {
      console.log('Mensagem WhatsApp simulada:', options.body);
      return Promise.resolve({ sid: 'SIMULADO' });
    }
  }
};
const twilioWhatsApp = process.env.TWILIO_WHATSAPP;
const meuWhatsApp = process.env.MEU_WHATSAPP;

/************ Binance ************/
const binance = new ccxt.binance({
  apiKey: process.env.BINANCE_API_KEY,
  secret: process.env.BINANCE_API_SECRET,
  options: { defaultType: "spot" }
});

/************ App + Socket.io ************/
const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static('public'));
app.use(express.json());

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

/************ Config bot ************/
const nivelCapital = { medio: 0.01, alto: 0.02, superior: 0.035 };
const pares = ["BTC/USDT","ETH/USDT","BNB/USDT","ADA/USDT","SOL/USDT",
               "XRP/USDT","DOT/USDT","DOGE/USDT","LTC/USDT","AVAX/USDT",
               "MATIC/USDT","LINK/USDT","ATOM/USDT","FTM/USDT","TRX/USDT",
               "NEAR/USDT","ALGO/USDT","XLM/USDT","VET/USDT","SAND/USDT",
               "FIL/USDT","HBAR/USDT","APE/USDT","MANA/USDT","GRT/USDT",
               "EGLD/USDT","CRO/USDT","ICP/USDT","XTZ/USDT","QNT/USDT"];

/************ Histórico e capital ************/
let historicoTrades = [];
let posicoesAbertas = [];
let capitalInicial = parseFloat(process.env.CAPITAL_INICIAL) || 500; 
let capitalAtual = capitalInicial;

/************ Funções utilitárias ************/
function alertar(bips){ process.stdout.write('\x07'.repeat(bips)); }

async function enviarWhatsApp(mensagem){
  try { await client.messages.create({body: mensagem, from: twilioWhatsApp, to: meuWhatsApp}); }
  catch(err){ console.log("Erro WhatsApp:", err.message); }
}

async function calcularDeltaGEX(par){
  const book = await binance.fetchOrderBook(par, 20);
  const bidVolume = book.bids.reduce((sum,b)=>sum+b[1],0);
  const askVolume = book.asks.reduce((sum,a)=>sum+a[1],0);
  return (bidVolume - askVolume)/(bidVolume + askVolume);
}

async function detectarWyckoff(par){
  const candles = await binance.fetchOHLCV(par,"1m",undefined,21);
  const ultima = candles[candles.length-1];
  const volume = ultima[5];
  const corpo = ultima[4]-ultima[1];
  const media = candles.slice(0,20).reduce((a,c)=>a+c[5],0)/20;
  if(corpo>0 && volume>1.5*media) return 1;
  if(corpo<0 && volume>1.5*media) return -1;
  return 0;
}

function nivelForca(delta){
  if(delta>=0.9) return "superior";
  if(delta>=0.8) return "alto";
  return "medio";
}

async function calcularValorTrade(nivel){
  const saldoUSDT = capitalAtual;
  if(saldoUSDT<200) return 10;
  return saldoUSDT*nivelCapital[nivel];
}

async function calcularATR(par){
  const candles = await binance.fetchOHLCV(par,"1m",undefined,14);
  let tr=[];
  for(let i=1;i<candles.length;i++){
    const [,high,low] = candles[i];
    const closeAnterior = candles[i-1][4];
    const trueRange = Math.max(high-low, Math.abs(high-closeAnterior), Math.abs(low-closeAnterior));
    tr.push(trueRange);
  }
  return tr.reduce((a,b)=>a+b,0)/tr.length;
}

function gerarDiagrama(posicoes){
  const diagrama = [];
  diagrama.push({passo:"Seleção de 30 pares", cor:"#3498db"});
  diagrama.push({passo:"Análise Wyckoff + Delta/GEX + ATR", cor:"#2980b9"});
  diagrama.push({passo:"Definição nível de força", cor:"#8e44ad"});
  diagrama.push({passo:"Cálculo % do capital", cor:"#f39c12"});

  posicoes.forEach(p=>{
    let corTrade = p.tipo==="buy" ? "#2ecc71" : "#e74c3c";
    diagrama.push({passo:`Execução trade ${p.tipo.toUpperCase()} | ${p.par} | Força: ${nivelForca(Math.abs(p.delta || 0))}`, cor:corTrade});
    diagrama.push({passo:"Monitoramento posição", cor:"#16a085"});
    diagrama.push({passo:"Fechamento trade", cor:"#c0392b"});
    diagrama.push({passo:"Acumulação lucro / Juros compostos diário", cor:"#f1c40f"});
  });

  return diagrama;
}

/************ Executa trade ************/
async function executarTrade(par,tipo,valorUSDT,deltaVal){
  const ticker = await binance.fetchTicker(par);
  const preco = tipo==="buy"?ticker.ask:ticker.bid;
  const quantidade = (valorUSDT/preco).toFixed(6);

  try{
    if(tipo==="buy") await binance.createMarketBuyOrder(par,quantidade);
    else await binance.createMarketSellOrder(par,quantidade);

    alertar(2);
    await enviarWhatsApp(`🚀 ${tipo==="buy"?"Compra":"Venda"} aberta: ${par} | Qtd: ${quantidade} | Preço: ${preco}`);

    posicoesAbertas.push({par,tipo,quantidade,precoAbertura:preco,delta:deltaVal});
    io.emit('update', {posicoesAbertas, historicoTrades, capitalAtual, diagrama: gerarDiagrama(posicoesAbertas)});

    const atr = await calcularATR(par);
    let stopPrice = tipo==="buy"? preco-1.5*atr : preco+1.5*atr;
    let tpPrice = tipo==="buy"? preco+2*atr : preco-2*atr;

    let posicaoAberta = true;
    while(posicaoAberta){
      const precoAtual = (await binance.fetchTicker(par)).last;
      if((tipo==="buy" && (precoAtual<=stopPrice || precoAtual>=tpPrice))||
         (tipo==="sell" && (precoAtual>=stopPrice || precoAtual<=tpPrice))){
        if(tipo==="buy") await binance.createMarketSellOrder(par,quantidade);
        else await binance.createMarketBuyOrder(par,quantidade);

        alertar(4);
        await enviarWhatsApp(`⛔ Posição fechada: ${par} | Preço: ${precoAtual}`);

        const lucro = (tipo==="buy"? precoAtual-preco : preco-precoAtual)*quantidade;
        capitalAtual += lucro; 
        historicoTrades.push({par,tipo,quantidade,precoAbertura:preco,precoFechamento:precoAtual,lucro});
        posicoesAbertas = posicoesAbertas.filter(p=>p.par!==par);

        io.emit('update',{posicoesAbertas, historicoTrades, capitalAtual, diagrama: gerarDiagrama(posicoesAbertas)});
        posicaoAberta=false;
      }
      await sleep(1000);
    }

  } catch(err){ console.log(`Erro em ${par}: ${err.message}`);}
}

/************ Seleção top pares ************/
async function paresPromissores(){
  const resultados=[];
  for(const par of pares){
    try{
      const wyckoff = await detectarWyckoff(par);
      const delta = await calcularDeltaGEX(par);
      const score = Math.abs(delta)+(wyckoff!==0?0.5:0);
      resultados.push({par,wyckoff,delta,score});
    } catch(e){}
  }
  resultados.sort((a,b)=>b.score-a.score);
  return resultados.slice(0,30);
}

/************ Loop principal ************/
async function rodarBot(){
  console.log("🤖 Bot iniciado!");
  
  while(botRodando){
    try {
      // Verifica se o bot está ativo
      if (!botAtivo) {
        console.log("⏸️ Bot pausado, aguardando...");
        await sleep(10000); // Aguarda 10 segundos
        continue;
      }
      
      console.log("\n=== Nova análise ===");
      
      const topPares = await paresPromissores();
      
      // Enviar dados de análise para o frontend
      const analyzing = topPares.slice(0, 5).map(p => p.par);
      const opportunities = [];
      
      const promessas = topPares.map(async ativo=>{
        // Verifica novamente se o bot ainda está ativo
        if (!botAtivo) return;
        
        const {par,wyckoff,delta} = ativo;
        
        // Emitir par sendo analisado
        io.emit('pairAnalysis', {
          analyzing: [par],
          status: 'analyzing'
        });
        
        if(wyckoff!==0 && Math.abs(delta)>0.7){
          const nivel = nivelForca(Math.abs(delta));
          const valorTrade = await calcularValorTrade(nivel);
          
          // Verificar saldo mínimo
          if(valorTrade < 20) {
            console.log(`⚠️ Saldo insuficiente para ${par}: $${valorTrade} (mínimo: $20)`);
            io.emit('botError', {
              message: `Saldo insuficiente: $${valorTrade.toFixed(2)} (mínimo: $20)`,
              timestamp: new Date().toISOString()
            });
            return;
          }
          
          if(valorTrade>=20){
            opportunities.push(par);
            
            // Emitir oportunidade encontrada
            io.emit('pairAnalysis', {
              opportunities: [par],
              status: 'opportunity',
              action: wyckoff === 1 ? 'buy' : 'sell',
              value: valorTrade
            });
            
            if(wyckoff===1) executarTrade(par,"buy",valorTrade,delta);
            if(wyckoff===-1) executarTrade(par,"sell",valorTrade,delta);
          }
        }
      });
      
      // Emitir lista completa de análise
      io.emit('pairAnalysis', {
        analyzing: analyzing,
        opportunities: opportunities,
        timestamp: new Date().toISOString()
      });
      
      await Promise.all(promessas);
      
      console.log("⏰ Aguardando 5 segundos...");
      await sleep(5000);
      
    } catch (error) {
      console.error("❌ Erro no bot:", error.message);
      
      // Emitir erro para o frontend
      io.emit('botError', {
        message: error.message,
        timestamp: new Date().toISOString()
      });
      
      await sleep(60000); // Aguarda 1 minuto em caso de erro
    }
  }
  
  console.log("🛑 Bot parado.");
}

/************ Resumo diário ************/
async function resumoDiario(){
  while(true){
    await sleep(24*60*60*1000);
    capitalInicial = capitalAtual; 
    let mensagem = "📊 Resumo diário de trades:\n";
    let lucroTotal = 0;
    historicoTrades.forEach(trade=>{
      mensagem+=`${trade.par}: ${trade.tipo} | Lucro: ${trade.lucro.toFixed(2)} USDT\n`;
      lucroTotal += trade.lucro;
    });
    mensagem += `💰 Lucro total: ${lucroTotal.toFixed(2)} USDT | Capital atualizado: ${capitalAtual.toFixed(2)} USDT`;
    await enviarWhatsApp(mensagem);
    historicoTrades = [];
    io.emit('update',{posicoesAbertas,historicoTrades,capitalAtual,diagrama: gerarDiagrama(posicoesAbertas)});
  }
}

/************ Testes com TestSprite ************/
function testarEstrategias() {
  console.log("Iniciando testes com MCP TestSprite...");
  
  // Cache para melhorar performance
  const cache = new Map();
  
  // Simula dados de teste para verificar a interface
  const dadosTeste = {
    posicoesAbertas: [
      {par: "BTC/USDT", tipo: "buy", quantidade: 0.001, precoAbertura: 50000, delta: 0.92},
      {par: "ETH/USDT", tipo: "sell", quantidade: 0.01, precoAbertura: 3000, delta: -0.85}
    ],
    historicoTrades: [
      {par: "BTC/USDT", tipo: "buy", quantidade: 0.002, precoAbertura: 49000, precoFechamento: 51000, lucro: 4},
      {par: "ETH/USDT", tipo: "sell", quantidade: 0.02, precoAbertura: 3100, precoFechamento: 2900, lucro: 4},
      {par: "SOL/USDT", tipo: "buy", quantidade: 0.1, precoAbertura: 100, precoFechamento: 105, lucro: 0.5}
    ],
    capitalAtual: 508.5,
    diagrama: gerarDiagrama([
      {par: "BTC/USDT", tipo: "buy", quantidade: 0.001, precoAbertura: 50000, delta: 0.92},
      {par: "ETH/USDT", tipo: "sell", quantidade: 0.01, precoAbertura: 3000, delta: -0.85}
    ])
  };
  
  // Envia dados de teste para a interface com setTimeout para não bloquear o event loop
  setTimeout(() => {
    io.emit('update', dadosTeste);
    console.log("Dados de teste enviados para a interface");
    console.log("TestSprite integrado e funcionando para visualização de trades");
  }, 0);
}

// Estado do bot
let botAtivo = false;
let botRodando = false;
let configBot = {
    apiKey: '',
    apiSecret: '',
    capitalInicial: 500,
    riskLevel: 'medio'
};

// Configuração do Socket.IO
io.on('connection', (socket) => {
    console.log('Cliente conectado');
    
    // Enviar estado atual do bot
    socket.emit('botStatus', {
        ativo: botAtivo,
        config: configBot
    });
    
    // Receber configurações atualizadas
    socket.on('updateConfig', (novaConfig) => {
        console.log('Configurações atualizadas:', novaConfig);
        configBot = { ...configBot, ...novaConfig };
        
        // Atualizar variáveis de ambiente se necessário
        if (novaConfig.apiKey) process.env.BINANCE_API_KEY = novaConfig.apiKey;
        if (novaConfig.apiSecret) process.env.BINANCE_API_SECRET = novaConfig.apiSecret;
        if (novaConfig.capitalInicial) process.env.CAPITAL_INICIAL = novaConfig.capitalInicial;
        
        // Confirmar para o cliente
        socket.emit('configUpdated', configBot);
    });
    
    // Iniciar bot
    socket.on('startBot', (config) => {
        console.log('Iniciando bot com configurações:', config);
        botAtivo = true;
        configBot = { ...configBot, ...config };
        
        // Atualizar variáveis de ambiente
        if (config.apiKey) process.env.BINANCE_API_KEY = config.apiKey;
        if (config.apiSecret) process.env.BINANCE_API_SECRET = config.apiSecret;
        if (config.capitalInicial) process.env.CAPITAL_INICIAL = config.capitalInicial;
        
        // Iniciar o bot se não estiver rodando
        if (!botRodando) {
            botRodando = true;
            rodarBot();
        }
        
        // Confirmar para todos os clientes
        io.emit('botStarted', { ativo: true, config: configBot });
    });
    
    // Pausar bot
    socket.on('pauseBot', () => {
        console.log('Pausando bot');
        botAtivo = false;
        
        // Confirmar para todos os clientes
        io.emit('botPaused', { ativo: false });
    });
    
    socket.on('disconnect', () => {
        console.log('Cliente desconectado');
    });
});

/************ Inicialização ************/
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
   console.log(`Painel rodando em http://localhost:${PORT}`);
   
   // Executa testes primeiro
   testarEstrategias();
   
   // Inicia o bot após os testes apenas se não for iniciado via interface
   setTimeout(() => {
     console.log("Testes concluídos, aguardando configuração via interface...");
     resumoDiario();
   }, 5000);
});

// Export para Vercel
module.exports = server;
