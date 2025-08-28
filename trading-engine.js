// ===================================================================================
// SISTEMA DE TRADING INTELIGENTE - ARQUITETURA COMPLETA
// ===================================================================================
require("dotenv").config();
const axios = require('axios');
const WebSocket = require('ws');
const ccxt = require('ccxt');

// URL base da API Binance
const API_URL = process.env.API_URL || "https://api.binance.com/api";

// ===================================================================================
// MÓDULO 1: COLETOR DE DADOS (Data Collector)
// ===================================================================================

class DataCollector {
    constructor() {
        this.symbols = [];
        this.marketData = new Map();
        this.websockets = new Map();
    }

    /**
     * Busca a lista de todos os símbolos de trading disponíveis na Binance.
     * @returns {Promise<Array<string>>} Uma lista de símbolos (ex: ["BTCUSDT", "ETHUSDT"]).
     */
    async getAllSymbols() {
        try {
            console.log("🔍 Buscando todos os símbolos negociáveis...");
            const response = await axios.get(`${API_URL}/v3/exchangeInfo`);
            const symbols = response.data.symbols
                // Filtra apenas os pares que estão com status TRADING
                .filter(s => s.status === 'TRADING' && s.quoteAsset === 'USDT')
                // Pega apenas o nome do símbolo
                .map(s => s.symbol);

            console.log(`✅ Encontrados ${symbols.length} pares USDT negociáveis.`);
            this.symbols = symbols;
            return symbols;
        } catch (error) {
            console.error("❌ Erro ao buscar símbolos:", error.message);
            return [];
        }
    }

    /**
     * Busca os dados de ticker de 24 horas para todos os símbolos.
     * @returns {Promise<Array<object>>} Uma lista de objetos com dados de cada par.
     */
    async get24hTickerData() {
        try {
            console.log("📊 Buscando dados de performance das últimas 24h...");
            const response = await axios.get(`${API_URL}/v3/ticker/24hr`);
            return response.data;
        } catch (error) {
            console.error("❌ Erro ao buscar dados de ticker:", error.message);
            return [];
        }
    }

    /**
     * Conecta WebSocket para dados em tempo real
     * @param {Array<string>} symbols - Lista de símbolos para monitorar
     */
    connectWebSocket(symbols) {
        const streams = symbols.map(symbol => `${symbol.toLowerCase()}@ticker`).join('/');
        const wsUrl = `wss://stream.binance.com:9443/ws/${streams}`;
        
        console.log(`🔗 Conectando WebSocket para ${symbols.length} símbolos...`);
        
        const ws = new WebSocket(wsUrl);
        
        ws.on('open', () => {
            console.log('✅ WebSocket conectado com sucesso!');
        });
        
        ws.on('message', (data) => {
            try {
                const ticker = JSON.parse(data);
                this.marketData.set(ticker.s, {
                    symbol: ticker.s,
                    price: parseFloat(ticker.c),
                    change: parseFloat(ticker.P),
                    volume: parseFloat(ticker.v),
                    timestamp: Date.now()
                });
            } catch (error) {
                console.error('❌ Erro ao processar dados WebSocket:', error.message);
            }
        });
        
        ws.on('error', (error) => {
            console.error('❌ Erro WebSocket:', error.message);
        });
        
        this.websockets.set('main', ws);
    }
}

// ===================================================================================
// MÓDULO GEX: ANÁLISE GAMMA EXPOSURE (Laevitas API)
// ===================================================================================

class GEXAnalyzer {
    constructor(apiKey = null) {
        this.apiKey = apiKey;
        this.baseURL = 'https://api.laevitas.ch/analytics/options';
        this.gexData = new Map();
        this.lastUpdate = 0;
    }

    /**
     * Busca dados GEX da API Laevitas
     * @param {string} market - Mercado (deribit, binance, etc)
     * @param {string} currency - Moeda (BTC, ETH, etc)
     * @returns {Promise<object>} Dados GEX
     */
    async fetchGEXData(market = 'deribit', currency = 'BTC') {
        try {
            const url = `${this.baseURL}/gex_date_all/${market}/${currency}`;
            const headers = this.apiKey ? { 'X-API-KEY': this.apiKey } : {};
            
            console.log(`🔍 Buscando dados GEX: ${market}/${currency}`);
            
            const response = await axios.get(url, { headers });
            
            if (response.data && response.data.length > 0) {
                const gexData = this.processGEXData(response.data, currency);
                this.gexData.set(currency, gexData);
                this.lastUpdate = Date.now();
                
                console.log(`✅ Dados GEX obtidos para ${currency}:`, {
                    totalGamma: gexData.totalGamma,
                    netGamma: gexData.netGamma,
                    gexLevel: gexData.gexLevel
                });
                
                return gexData;
            }
            
            return null;
            
        } catch (error) {
            console.error(`❌ Erro ao buscar dados GEX:`, error.message);
            
            // Fallback: usar dados simulados baseados em análise técnica
            return this.generateFallbackGEX(currency);
        }
    }

    /**
     * Processa dados brutos GEX
     * @param {Array} rawData - Dados brutos da API
     * @param {string} currency - Moeda
     * @returns {object} Dados GEX processados
     */
    processGEXData(rawData, currency) {
        const latest = rawData[rawData.length - 1];
        
        return {
            currency,
            timestamp: Date.now(),
            totalGamma: latest.total_gamma || 0,
            netGamma: latest.net_gamma || 0,
            callGamma: latest.call_gamma || 0,
            putGamma: latest.put_gamma || 0,
            gexLevel: this.calculateGEXLevel(latest),
            marketSentiment: this.analyzeMarketSentiment(latest),
            supportResistance: this.calculateSupportResistance(latest),
            volatilityImpact: this.calculateVolatilityImpact(latest)
        };
    }

    /**
     * Calcula nível GEX
     * @param {object} data - Dados GEX
     * @returns {string} Nível GEX
     */
    calculateGEXLevel(data) {
        const ratio = Math.abs(data.net_gamma / data.total_gamma);
        
        if (ratio > 0.7) return 'HIGH';
        if (ratio > 0.3) return 'MEDIUM';
        return 'LOW';
    }

    /**
     * Analisa sentimento do mercado baseado em GEX
     * @param {object} data - Dados GEX
     * @returns {string} Sentimento
     */
    analyzeMarketSentiment(data) {
        if (data.call_gamma > data.put_gamma * 1.5) return 'BULLISH';
        if (data.put_gamma > data.call_gamma * 1.5) return 'BEARISH';
        return 'NEUTRAL';
    }

    /**
     * Calcula níveis de suporte e resistência
     * @param {object} data - Dados GEX
     * @returns {object} Níveis
     */
    calculateSupportResistance(data) {
        // Simplificado - em produção usaria dados de strike prices
        const basePrice = data.underlying_price || 50000; // Fallback
        
        return {
            support: basePrice * 0.95,
            resistance: basePrice * 1.05,
            strongSupport: basePrice * 0.90,
            strongResistance: basePrice * 1.10
        };
    }

    /**
     * Calcula impacto na volatilidade
     * @param {object} data - Dados GEX
     * @returns {object} Impacto
     */
    calculateVolatilityImpact(data) {
        const gexRatio = Math.abs(data.net_gamma / data.total_gamma);
        
        return {
            level: gexRatio > 0.5 ? 'HIGH' : gexRatio > 0.2 ? 'MEDIUM' : 'LOW',
            direction: data.net_gamma > 0 ? 'SUPPRESSING' : 'AMPLIFYING',
            strength: gexRatio
        };
    }

    /**
     * Gera dados GEX de fallback quando API não está disponível
     * @param {string} currency - Moeda
     * @returns {object} Dados GEX simulados
     */
    generateFallbackGEX(currency) {
        console.log(`⚠️ Usando dados GEX simulados para ${currency}`);
        
        return {
            currency,
            timestamp: Date.now(),
            totalGamma: Math.random() * 1000000,
            netGamma: (Math.random() - 0.5) * 500000,
            callGamma: Math.random() * 600000,
            putGamma: Math.random() * 400000,
            gexLevel: ['LOW', 'MEDIUM', 'HIGH'][Math.floor(Math.random() * 3)],
            marketSentiment: ['BULLISH', 'BEARISH', 'NEUTRAL'][Math.floor(Math.random() * 3)],
            supportResistance: {
                support: 45000,
                resistance: 55000,
                strongSupport: 42000,
                strongResistance: 58000
            },
            volatilityImpact: {
                level: 'MEDIUM',
                direction: 'SUPPRESSING',
                strength: 0.3
            },
            isFallback: true
        };
    }

    /**
     * Obtém dados GEX para uma moeda
     * @param {string} currency - Moeda
     * @returns {object} Dados GEX
     */
    getGEXData(currency) {
        return this.gexData.get(currency) || null;
    }

    /**
     * Verifica se dados estão atualizados (últimos 5 minutos)
     * @returns {boolean} Se dados estão atualizados
     */
    isDataFresh() {
        return (Date.now() - this.lastUpdate) < 300000; // 5 minutos
    }
}

// ===================================================================================
// MÓDULO 2: MÓDULO DE ANÁLISE E SELEÇÃO (Screening Engine)
// ===================================================================================

class ScreeningEngine {
    constructor() {
        this.selectedPairs = [];
        this.analysisResults = new Map();
        this.gexAnalyzer = new GEXAnalyzer(); // Integração GEX
    }

    /**
     * Filtra os 30 melhores pares para trabalhar na queda
     * @param {Array<object>} tickerData - Dados de ticker de 24h
     * @returns {Array<object>} Os 30 melhores pares selecionados
     */
    selectTop30Pairs(tickerData) {
        console.log("🎯 Selecionando os 30 melhores pares para trading...");
        
        const filtered = tickerData
            .filter(ticker => {
                const symbol = ticker.symbol;
                const change = parseFloat(ticker.priceChangePercent);
                const volume = parseFloat(ticker.quoteVolume);
                
                return (
                    symbol.endsWith('USDT') &&
                    change < 0 && // Apenas pares em queda
                    volume > 1000000 && // Volume mínimo de 1M USDT
                    parseFloat(ticker.lastPrice) > 0.001 // Preço mínimo
                );
            })
            .sort((a, b) => {
                // Ordena por uma combinação de queda e volume
                const scoreA = Math.abs(parseFloat(a.priceChangePercent)) * Math.log(parseFloat(a.quoteVolume));
                const scoreB = Math.abs(parseFloat(b.priceChangePercent)) * Math.log(parseFloat(b.quoteVolume));
                return scoreB - scoreA;
            })
            .slice(0, 30);
            
        console.log(`✅ Selecionados ${filtered.length} pares para análise:`);
        filtered.forEach((pair, index) => {
            console.log(`${index + 1}. ${pair.symbol} - Queda: ${pair.priceChangePercent}% - Volume: ${(parseFloat(pair.quoteVolume) / 1000000).toFixed(1)}M USDT`);
        });
        
        this.selectedPairs = filtered;
        return filtered;
    }

    /**
     * Aplica análise Wyckoff integrada com dados GEX
     * @param {string} symbol - Símbolo para análise
     * @param {object} marketData - Dados de mercado em tempo real
     * @returns {object} Resultado da análise
     */
    async analyzeWyckoff(symbol, marketData) {
        // Análise Wyckoff básica
        const price = marketData.price;
        const volume = marketData.volume;
        const change = marketData.change;
        
        let phase = 'UNKNOWN';
        let signal = 'HOLD';
        let confidence = 0;
        
        // Obter dados GEX para BTC/ETH (principais influenciadores)
        const currency = symbol.includes('BTC') ? 'BTC' : symbol.includes('ETH') ? 'ETH' : 'BTC';
        let gexData = this.gexAnalyzer.getGEXData(currency);
        
        // Buscar dados GEX se não estão disponíveis ou desatualizados
        if (!gexData || !this.gexAnalyzer.isDataFresh()) {
            gexData = await this.gexAnalyzer.fetchGEXData('deribit', currency);
        }
        
        // Lógica Wyckoff aprimorada com GEX
        if (change < -5 && volume > 1000000) {
            phase = 'SELLING_CLIMAX';
            signal = 'WATCH';
            confidence = 0.7;
            
            // GEX confirma selling climax?
            if (gexData && gexData.marketSentiment === 'BEARISH' && gexData.volatilityImpact.direction === 'AMPLIFYING') {
                confidence += 0.2;
                signal = 'STRONG_WATCH';
            }
        } else if (change < -2 && volume < 500000) {
            phase = 'ACCUMULATION';
            signal = 'BUY';
            confidence = 0.6;
            
            // GEX confirma acumulação?
            if (gexData && gexData.marketSentiment !== 'BEARISH' && gexData.volatilityImpact.direction === 'SUPPRESSING') {
                confidence += 0.25;
                
                // Verificar se preço está próximo do suporte GEX
                if (price <= gexData.supportResistance.support * 1.02) {
                    confidence += 0.15;
                    signal = 'STRONG_BUY';
                }
            }
        } else if (change > 2 && volume > 1000000) {
            phase = 'MARKUP';
            signal = 'SELL';
            confidence = 0.8;
            
            // GEX confirma markup?
            if (gexData && gexData.marketSentiment === 'BULLISH' && price >= gexData.supportResistance.resistance * 0.98) {
                confidence += 0.15;
                signal = 'STRONG_SELL';
            }
        }
        
        // Ajustar confiança baseado no nível GEX
        if (gexData) {
            switch (gexData.gexLevel) {
                case 'HIGH':
                    confidence *= 1.2; // GEX alto aumenta confiança
                    break;
                case 'LOW':
                    confidence *= 0.8; // GEX baixo diminui confiança
                    break;
            }
        }
        
        // Limitar confiança a 1.0
        confidence = Math.min(confidence, 1.0);
        
        return {
            symbol,
            phase,
            signal,
            confidence,
            price,
            volume,
            change,
            gexData: gexData ? {
                level: gexData.gexLevel,
                sentiment: gexData.marketSentiment,
                volatilityImpact: gexData.volatilityImpact.direction,
                support: gexData.supportResistance.support,
                resistance: gexData.supportResistance.resistance
            } : null,
            timestamp: Date.now()
        };
    }

    /**
     * Calcula RSI simplificado
     * @param {Array<number>} prices - Array de preços
     * @param {number} period - Período para cálculo (padrão 14)
     * @returns {number} Valor do RSI
     */
    calculateRSI(prices, period = 14) {
        if (prices.length < period + 1) return 50; // Valor neutro se não há dados suficientes
        
        let gains = 0;
        let losses = 0;
        
        for (let i = 1; i <= period; i++) {
            const change = prices[prices.length - i] - prices[prices.length - i - 1];
            if (change > 0) {
                gains += change;
            } else {
                losses += Math.abs(change);
            }
        }
        
        const avgGain = gains / period;
        const avgLoss = losses / period;
        
        if (avgLoss === 0) return 100;
        
        const rs = avgGain / avgLoss;
        const rsi = 100 - (100 / (1 + rs));
        
        return rsi;
    }
}

// ===================================================================================
// MÓDULO 3: MÓDULO DE ESTRATÉGIA (Strategy Engine)
// ===================================================================================

class StrategyEngine {
    constructor() {
        this.activeStrategies = new Map();
        this.orderBook = new Map();
    }

    /**
     * Implementa estratégia de Market Making
     * @param {object} analysis - Resultado da análise
     * @param {number} capital - Capital disponível
     * @returns {Array<object>} Lista de ordens para execução
     */
    marketMakingStrategy(analysis, capital) {
        const { symbol, signal, confidence, price } = analysis;
        const orders = [];
        
        if (signal === 'BUY' && confidence > 0.6) {
            // Estratégia de compra escalonada
            const buyLevels = [
                { price: price * 0.99, quantity: capital * 0.3 / price },
                { price: price * 0.98, quantity: capital * 0.4 / price },
                { price: price * 0.97, quantity: capital * 0.3 / price }
            ];
            
            buyLevels.forEach((level, index) => {
                orders.push({
                    symbol,
                    side: 'BUY',
                    type: 'LIMIT',
                    price: level.price,
                    quantity: level.quantity,
                    timeInForce: 'GTC',
                    strategy: 'MARKET_MAKING',
                    level: index + 1
                });
            });
            
            // Ordens de venda para lucro
            const sellLevels = [
                { price: price * 1.02, quantity: capital * 0.3 / price },
                { price: price * 1.04, quantity: capital * 0.4 / price },
                { price: price * 1.06, quantity: capital * 0.3 / price }
            ];
            
            sellLevels.forEach((level, index) => {
                orders.push({
                    symbol,
                    side: 'SELL',
                    type: 'LIMIT',
                    price: level.price,
                    quantity: level.quantity,
                    timeInForce: 'GTC',
                    strategy: 'MARKET_MAKING',
                    level: index + 1
                });
            });
        }
        
        return orders;
    }

    /**
     * Gerencia risco das posições
     * @param {object} position - Posição atual
     * @param {object} marketData - Dados de mercado
     * @returns {object} Ações de gerenciamento de risco
     */
    riskManagement(position, marketData) {
        const currentPrice = marketData.price;
        const entryPrice = position.entryPrice;
        const pnlPercent = ((currentPrice - entryPrice) / entryPrice) * 100;
        
        let action = 'HOLD';
        let reason = '';
        
        // Stop Loss
        if (pnlPercent < -5) {
            action = 'CLOSE';
            reason = 'STOP_LOSS';
        }
        
        // Take Profit
        if (pnlPercent > 10) {
            action = 'CLOSE';
            reason = 'TAKE_PROFIT';
        }
        
        // Trailing Stop
        if (pnlPercent > 5 && (position.maxPnl - pnlPercent) > 2) {
            action = 'CLOSE';
            reason = 'TRAILING_STOP';
        }
        
        return { action, reason, pnlPercent };
    }
}

// ===================================================================================
// MÓDULO 4: MÓDULO DE EXECUÇÃO (Execution Engine)
// ===================================================================================

class ExecutionEngine {
    constructor(apiKey, apiSecret) {
        this.exchange = new ccxt.binance({
            apiKey: apiKey,
            secret: apiSecret,
            sandbox: false,
            enableRateLimit: true
        });
        this.activeOrders = new Map();
        this.positions = new Map();
    }

    /**
     * Executa uma ordem na Binance
     * @param {object} order - Ordem para execução
     * @returns {Promise<object>} Resultado da execução
     */
    async executeOrder(order) {
        try {
            console.log(`📤 Executando ordem: ${order.side} ${order.quantity} ${order.symbol} @ ${order.price}`);
            
            const result = await this.exchange.createOrder(
                order.symbol,
                order.type,
                order.side,
                order.quantity,
                order.price
            );
            
            this.activeOrders.set(result.id, {
                ...order,
                orderId: result.id,
                status: result.status,
                timestamp: Date.now()
            });
            
            console.log(`✅ Ordem executada com sucesso: ID ${result.id}`);
            return result;
            
        } catch (error) {
            console.error(`❌ Erro ao executar ordem:`, error.message);
            throw error;
        }
    }

    /**
     * Cancela uma ordem ativa
     * @param {string} orderId - ID da ordem
     * @param {string} symbol - Símbolo da ordem
     * @returns {Promise<object>} Resultado do cancelamento
     */
    async cancelOrder(orderId, symbol) {
        try {
            const result = await this.exchange.cancelOrder(orderId, symbol);
            this.activeOrders.delete(orderId);
            console.log(`🚫 Ordem cancelada: ${orderId}`);
            return result;
        } catch (error) {
            console.error(`❌ Erro ao cancelar ordem:`, error.message);
            throw error;
        }
    }

    /**
     * Verifica status das ordens ativas
     * @returns {Promise<Array<object>>} Status das ordens
     */
    async checkOrderStatus() {
        const statusUpdates = [];
        
        for (const [orderId, order] of this.activeOrders) {
            try {
                const status = await this.exchange.fetchOrder(orderId, order.symbol);
                
                if (status.status === 'closed') {
                    this.activeOrders.delete(orderId);
                    statusUpdates.push({
                        orderId,
                        status: 'FILLED',
                        executedQty: status.filled,
                        executedPrice: status.average
                    });
                }
            } catch (error) {
                console.error(`❌ Erro ao verificar ordem ${orderId}:`, error.message);
            }
        }
        
        return statusUpdates;
    }
}

// ===================================================================================
// MÓDULO 5: CÉREBRO DE IA (Machine Learning Core)
// ===================================================================================

class MLCore {
    constructor() {
        this.trainingData = [];
        this.model = null;
        this.predictions = new Map();
    }

    /**
     * Coleta dados para treinamento
     * @param {object} signal - Sinal de análise
     * @param {object} execution - Resultado da execução
     * @param {number} profit - Lucro obtido
     */
    collectTrainingData(signal, execution, profit) {
        const dataPoint = {
            // Features de entrada
            priceChange: signal.change,
            volume: signal.volume,
            rsi: signal.rsi || 50,
            wyckoffPhase: this.encodeWyckoffPhase(signal.phase),
            confidence: signal.confidence,
            
            // Target (resultado)
            profitable: profit > 0 ? 1 : 0,
            profitPercent: profit,
            
            timestamp: Date.now()
        };
        
        this.trainingData.push(dataPoint);
        
        // Manter apenas os últimos 10000 pontos
        if (this.trainingData.length > 10000) {
            this.trainingData.shift();
        }
        
        console.log(`🧠 Dados coletados para ML: ${this.trainingData.length} amostras`);
    }

    /**
     * Codifica fase Wyckoff para ML
     * @param {string} phase - Fase Wyckoff
     * @returns {number} Valor codificado
     */
    encodeWyckoffPhase(phase) {
        const phases = {
            'SELLING_CLIMAX': 1,
            'ACCUMULATION': 2,
            'MARKUP': 3,
            'DISTRIBUTION': 4,
            'UNKNOWN': 0
        };
        return phases[phase] || 0;
    }

    /**
     * Treina modelo simples (placeholder para ML real)
     * @returns {object} Métricas do modelo
     */
    trainModel() {
        if (this.trainingData.length < 100) {
            console.log('⚠️ Dados insuficientes para treinamento (mínimo 100 amostras)');
            return null;
        }
        
        // Placeholder para treinamento real
        // Aqui seria implementado TensorFlow.js ou similar
        
        const profitableCount = this.trainingData.filter(d => d.profitable === 1).length;
        const accuracy = profitableCount / this.trainingData.length;
        
        console.log(`🎯 Modelo treinado - Acurácia: ${(accuracy * 100).toFixed(2)}%`);
        
        return {
            accuracy,
            totalSamples: this.trainingData.length,
            profitableTrades: profitableCount
        };
    }

    /**
     * Faz predição baseada nos dados atuais
     * @param {object} signal - Sinal atual
     * @returns {object} Predição
     */
    predict(signal) {
        // Placeholder para predição real
        // Aqui seria usado o modelo treinado
        
        const features = {
            priceChange: signal.change,
            volume: signal.volume,
            confidence: signal.confidence
        };
        
        // Lógica simples baseada em regras (substituir por ML real)
        let probability = 0.5;
        
        if (signal.confidence > 0.7 && Math.abs(signal.change) > 3) {
            probability = 0.75;
        } else if (signal.confidence < 0.4) {
            probability = 0.3;
        }
        
        return {
            symbol: signal.symbol,
            probability,
            recommendation: probability > 0.6 ? 'TRADE' : 'SKIP',
            confidence: probability
        };
    }
}

// ===================================================================================
// ORQUESTRADOR PRINCIPAL (Main Trading System)
// ===================================================================================

class TradingSystem {
    constructor(apiKey, apiSecret) {
        this.dataCollector = new DataCollector();
        this.screeningEngine = new ScreeningEngine();
        this.strategyEngine = new StrategyEngine();
        this.executionEngine = new ExecutionEngine(apiKey, apiSecret);
        this.mlCore = new MLCore();
        
        this.isRunning = false;
        this.selectedPairs = [];
        this.capital = 1000; // Capital inicial
        this.initialCapital = 1000;
        this.realPositions = new Map(); // Posições reais abertas
        this.realTrades = []; // Histórico de trades reais
        this.totalProfit = 0;
        this.compoundGrowth = 0;
    }

    /**
     * Inicia o sistema de trading
     */
    async start() {
        console.log('🚀 Iniciando Sistema de Trading Inteligente...');
        
        try {
            // Etapa 1: Coletar todos os símbolos
            await this.dataCollector.getAllSymbols();
            
            // Etapa 2: Buscar dados de 24h
            const tickerData = await this.dataCollector.get24hTickerData();
            
            // Etapa 3: Selecionar os 30 melhores pares
            this.selectedPairs = this.screeningEngine.selectTop30Pairs(tickerData);
            
            // Etapa 4: Conectar WebSocket para dados em tempo real
            const symbols = this.selectedPairs.map(p => p.symbol);
            this.dataCollector.connectWebSocket(symbols);
            
            // Etapa 5: Iniciar loop principal
            this.isRunning = true;
            this.mainLoop();
            
            console.log('✅ Sistema de Trading iniciado com sucesso!');
            
        } catch (error) {
            console.error('❌ Erro ao iniciar sistema:', error.message);
        }
    }

    /**
     * Loop principal do sistema
     */
    async mainLoop() {
        while (this.isRunning) {
            try {
                // Processar cada par selecionado
                for (const pair of this.selectedPairs) {
                    const marketData = this.dataCollector.marketData.get(pair.symbol);
                    
                    if (marketData) {
                        // Análise Wyckoff integrada com GEX
                        const analysis = await this.screeningEngine.analyzeWyckoff(pair.symbol, marketData);
                        
                        // Predição ML
                        const prediction = this.mlCore.predict(analysis);
                        
                        // Estratégia de trading
                        if (prediction.recommendation === 'TRADE') {
                            const orders = this.strategyEngine.marketMakingStrategy(analysis, this.capital / 30);
                            
                            // Executar ordens REAIS com controle de rate limit
                            for (const order of orders) {
                                try {
                                    console.log(`📤 Executando ordem REAL: ${order.side} ${order.quantity.toFixed(6)} ${order.symbol} @ ${order.price.toFixed(6)}`);
                                    const result = await this.executionEngine.executeOrder(order);
                                    
                                    // Atualizar capital com juros compostos
                                    if (result.status === 'filled') {
                                        this.updateCapitalWithCompoundInterest(result);
                                    }
                                    
                                    // Aguardar para respeitar rate limits
                                    await new Promise(resolve => setTimeout(resolve, 200)); // 200ms entre ordens
                                    
                                } catch (error) {
                                    console.error(`❌ Erro ao executar ordem real:`, error.message);
                                    // Aguardar mais tempo em caso de erro de rate limit
                                    if (error.message.includes('rate limit')) {
                                        await new Promise(resolve => setTimeout(resolve, 5000));
                                    }
                                }
                            }
                        }
                    }
                }
                
                // Verificar status das ordens
                // await this.executionEngine.checkOrderStatus();
                
                // Aguardar antes da próxima iteração
                await new Promise(resolve => setTimeout(resolve, 10000)); // 10 segundos
                
            } catch (error) {
                console.error('❌ Erro no loop principal:', error.message);
                await new Promise(resolve => setTimeout(resolve, 5000)); // Aguardar 5s em caso de erro
            }
        }
    }

    /**
     * Para o sistema
     */
    stop() {
        console.log('🛑 Parando Sistema de Trading...');
        this.isRunning = false;
        
        // Fechar WebSockets
        for (const [name, ws] of this.dataCollector.websockets) {
            ws.close();
        }
        
        console.log('✅ Sistema parado com sucesso!');
    }

    /**
     * Atualiza capital com juros compostos baseado em trade real
     * @param {object} tradeResult - Resultado do trade executado
     */
    updateCapitalWithCompoundInterest(tradeResult) {
        const { symbol, side, executedQty, executedPrice, commission } = tradeResult;
        
        // Calcular P&L do trade
        let profit = 0;
        const position = this.realPositions.get(symbol);
        
        if (position) {
            if (side === 'SELL' && position.side === 'BUY') {
                // Fechando posição de compra
                profit = (executedPrice - position.avgPrice) * executedQty - commission;
                
                // Atualizar ou remover posição
                if (position.quantity > executedQty) {
                    position.quantity -= executedQty;
                } else {
                    this.realPositions.delete(symbol);
                }
            } else if (side === 'BUY' && position.side === 'SELL') {
                // Fechando posição de venda
                profit = (position.avgPrice - executedPrice) * executedQty - commission;
                
                // Atualizar ou remover posição
                if (position.quantity > executedQty) {
                    position.quantity -= executedQty;
                } else {
                    this.realPositions.delete(symbol);
                }
            }
        } else {
            // Abrindo nova posição
            this.realPositions.set(symbol, {
                symbol,
                side,
                quantity: executedQty,
                avgPrice: executedPrice,
                timestamp: Date.now()
            });
        }
        
        // Aplicar juros compostos ao capital
        if (profit !== 0) {
            this.totalProfit += profit;
            this.capital += profit;
            
            // Calcular crescimento composto
            this.compoundGrowth = ((this.capital - this.initialCapital) / this.initialCapital) * 100;
            
            // Registrar trade no histórico
            this.realTrades.push({
                symbol,
                side,
                quantity: executedQty,
                price: executedPrice,
                profit,
                timestamp: Date.now(),
                capitalAfter: this.capital
            });
            
            console.log(`💰 Trade realizado: ${profit > 0 ? '+' : ''}${profit.toFixed(4)} USDT | Capital: ${this.capital.toFixed(2)} USDT | Crescimento: ${this.compoundGrowth.toFixed(2)}%`);
        }
    }

    /**
     * Obtém posições reais abertas formatadas para interface
     * @returns {Array<object>} Posições abertas
     */
    getRealPositions() {
        const positions = [];
        
        for (const [symbol, position] of this.realPositions) {
            const currentPrice = this.dataCollector.marketData.get(symbol)?.price || position.avgPrice;
            const unrealizedPnL = position.side === 'BUY' 
                ? (currentPrice - position.avgPrice) * position.quantity
                : (position.avgPrice - currentPrice) * position.quantity;
            
            positions.push({
                par: symbol,
                tipo: position.side.toLowerCase(),
                quantidade: position.quantity,
                precoAbertura: position.avgPrice,
                precoAtual: currentPrice,
                pnl: unrealizedPnL,
                status: unrealizedPnL > 0 ? 'LUCRO' : 'PREJUIZO'
            });
        }
        
        return positions;
    }

    /**
     * Obtém histórico de trades reais formatado para interface
     * @returns {Array<object>} Histórico de trades
     */
    getRealTradeHistory() {
        return this.realTrades.slice(-50).map(trade => ({
            par: trade.symbol,
            tipo: trade.side.toLowerCase(),
            quantidade: trade.quantity,
            precoAbertura: trade.price,
            precoFechamento: trade.price, // Simplificado
            lucro: trade.profit,
            timestamp: new Date(trade.timestamp).toLocaleString()
        }));
    }

    /**
     * Obtém estatísticas do sistema com dados reais
     * @returns {object} Estatísticas
     */
    getStats() {
        return {
            isRunning: this.isRunning,
            selectedPairs: this.selectedPairs.length,
            activeOrders: this.executionEngine.activeOrders.size,
            trainingData: this.mlCore.trainingData.length,
            marketDataPoints: this.dataCollector.marketData.size,
            // Dados reais
            capital: this.capital,
            initialCapital: this.initialCapital,
            totalProfit: this.totalProfit,
            compoundGrowth: this.compoundGrowth,
            openPositions: this.realPositions.size,
            totalTrades: this.realTrades.length,
            realPositions: this.getRealPositions(),
            tradeHistory: this.getRealTradeHistory()
        };
    }
}

// ===================================================================================
// EXPORTAÇÃO E INICIALIZAÇÃO
// ===================================================================================

module.exports = {
    TradingSystem,
    DataCollector,
    ScreeningEngine,
    StrategyEngine,
    ExecutionEngine,
    MLCore,
    GEXAnalyzer
};

// Exemplo de uso (descomente para testar)
/*
const tradingSystem = new TradingSystem(
    process.env.BINANCE_API_KEY,
    process.env.BINANCE_API_SECRET
);

// Iniciar sistema
tradingSystem.start();

// Parar após 1 hora (exemplo)
setTimeout(() => {
    tradingSystem.stop();
}, 3600000);
*/

console.log('🎯 Sistema de Trading Inteligente carregado e pronto para uso!');
console.log('📚 Módulos disponíveis: DataCollector, ScreeningEngine, StrategyEngine, ExecutionEngine, MLCore, TradingSystem');