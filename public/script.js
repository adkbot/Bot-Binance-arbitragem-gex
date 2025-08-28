// ===================================================================================
// COMMUNICATION ARCHITECTURE (HTTP Polling for Vercel)
// ===================================================================================

const httpClient = {
    sessionId: null,
    eventListeners: new Map(),
    pollingInterval: null,

    // Sends an event to the backend
    async emit(event, data) {
        if (!this.sessionId) {
            console.error("Cannot emit event: Session not started.");
            return;
        }
        try {
            await fetch('/api/socket-event', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: this.sessionId, event, data })
            });
        } catch (error) {
            console.error(`Error sending event '${event}':`, error);
        }
    },

    // Registers a listener for an event
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    },

    // Triggers an event for local listeners
    triggerEvent(event, data) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error executing callback for event '${event}':`, error);
                }
            });
        }
    },

    // Starts a session with the backend
    async init() {
        try {
            const response = await fetch('/api/create-session', { method: 'POST' });
            if (!response.ok) throw new Error('Failed to get server response.');
            
            const result = await response.json();
            this.sessionId = result.sessionId;
            console.log('HTTP Session created successfully:', this.sessionId);
            this.triggerEvent('sessionCreated', { sessionId: this.sessionId });
            this.startPolling();
            return true;
        } catch (error) {
            console.error('Critical error creating session:', error);
            return false;
        }
    },

    // Starts polling process to fetch events from server
    startPolling() {
        if (this.pollingInterval) clearInterval(this.pollingInterval);
        this.pollingInterval = setInterval(async () => {
            if (!this.sessionId) return;
            try {
                const response = await fetch(`/api/poll-events?sessionId=${this.sessionId}`);
                if (response.ok) {
                    const events = await response.json();
                    events.forEach(eventData => this.triggerEvent(eventData.event, eventData.data));
                }
            } catch (error) {
                // Only log network errors to avoid console pollution
                if (error.message.includes('Failed to fetch')) {
                     console.error('Network error during polling:', error);
                }
            }
        }, 3000); // Poll every 3 seconds
    }
};

const socket = httpClient; // Use httpClient as "socket"

// ===================================================================================
// GLOBAL STATE AND SETTINGS
// ===================================================================================

let botActive = false;
// Configuration object to be sent to backend. Keys are filled after loading from server.
let botConfig = {
    apiKey: '',
    apiSecret: '',
    capitalInicial: 500,
    riskLevel: 'medio'
};
// Safe object for interface use, NEVER contains API keys.
let safeConfig = {
    capitalInicial: 500,
    riskLevel: 'medio',
    hasApiKeys: false
};

let graficoLucro = null;
const tradingPairs = [
    'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'DOTUSDT', 'MATICUSDT'
];

// ===================================================================================
// MAIN APPLICATION FUNCTIONS
// ===================================================================================

/**
 * Loads configurations from server when page starts.
 * This is the ONLY safe source of configuration.
 */
async function loadConfigFromServer() {
    console.log('=== LOADING SERVER CONFIGURATIONS ===');
    try {
        const response = await fetch('/api/get-credentials');
        const result = await response.json();

        if (response.ok && result.configured) {
            console.log('✅ Configurations found on server!');
            // Fill global configurations with safe data from server
            botConfig = result.config;
            safeConfig = {
                capitalInicial: result.config.capitalInicial,
                riskLevel: result.config.riskLevel,
                hasApiKeys: true
            };
            showNotification('🚀 Configurations loaded from server! Ready to operate.', 'success');
        } else {
            console.log('ℹ️ No credentials found on server. Please configure.');
            safeConfig.hasApiKeys = false;
        }
    } catch (error) {
        console.error('⚠️ Error loading server configurations:', error);
        showNotification('Could not load server configurations.', 'error');
    }
    updatePlaceholders();
}

/**
 * Saves configurations permanently on server.
 * @param {Event} event - The form event.
 */
async function saveSettings(event) {
    event.preventDefault();
    console.log('=== ATTEMPTING TO SAVE CONFIGURATIONS ON SERVER ===');

    const apiKey = document.getElementById('apiKey').value.trim();
    const apiSecret = document.getElementById('apiSecret').value.trim();
    const capitalInicial = parseFloat(document.getElementById('capitalInicial').value) || 500;
    const riskLevel = document.getElementById('riskLevel').value;

    if (!apiKey && !apiSecret && safeConfig.hasApiKeys) {
        showNotification('To change keys, you must provide both new Key and Secret.', 'warning');
        return;
    }
    
    if (!apiKey || !apiSecret) {
        showNotification('Please fill in both API Key and Secret.', 'error');
        return;
    }

    try {
        const response = await fetch('/api/save-credentials', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey, apiSecret, capitalInicial, riskLevel })
        });
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Unknown server error.');
        }

        console.log('🎉 CREDENTIALS PERMANENTLY SAVED ON SERVER!');
        
        // Update local configurations with new data
        botConfig = { apiKey, apiSecret, capitalInicial, riskLevel };
        safeConfig = { capitalInicial, riskLevel, hasApiKeys: true };
        
        closeSettings();
        showNotification('🚀 Settings successfully saved on server!', 'success');
        updatePlaceholders();

    } catch (error) {
        console.error('❌ Error saving credentials:', error);
        showNotification(`Save error: ${error.message}`, 'error');
    }
}

/**
 * Starts the bot after validations.
 */
async function startBot() {
    console.log('=== ATTEMPTING TO START BOT ===');
    
    if (!safeConfig.hasApiKeys) {
        showNotification('Configure your API keys first!', 'error');
        openSettings();
        return;
    }
    
    // Shows "starting" state to user
    updateBotStatus(true, 'Starting...');
    showNotification('Starting bot... Validating Binance balance...', 'warning');

    try {
        await socket.emit('startBot', {});
        console.log("'startBot' command sent to server.");
        
    } catch (error) {
        console.error("Failed to send 'startBot' command:", error);
        showNotification('Communication error while trying to start bot.', 'error');
        updateBotStatus(false);
    }
}

/**
 * Pauses the bot.
 */
function pauseBot() {
    console.log('=== ATTEMPTING TO PAUSE BOT ===');
    socket.emit('pauseBot');
    updateBotStatus(false);
    showNotification('Command to pause bot sent!', 'warning');
}

// ===================================================================================
// SOCKET EVENT HANDLERS (Received from Backend)
// ===================================================================================

socket.on('sessionCreated', (data) => {
    console.log('Private session started with server:', data.sessionId);
});

socket.on('botStarted', (data) => {
    botActive = true;
    updateBotStatus(true);
    startCarousel();
    showNotification('✅ Bot successfully started by server!', 'success');
});

socket.on('botPaused', () => {
    botActive = false;
    updateBotStatus(false);
    stopCarousel();
    showNotification(' Bot paused by server.', 'warning');
});

socket.on('botError', (error) => {
    console.error('Received error from backend:', error.message);
    showNotification(`BOT ERROR: ${error.message}`, 'error');
    updateBotStatus(false);
    stopCarousel();
});

socket.on('update', (data) => {
    updateInterfaceWithRealData(data);
});

// ===================================================================================
// INTERFACE UPDATE FUNCTIONS (UI)
// ===================================================================================

/**
 * Updates interface with real data received from backend.
 * @param {object} data - Bot data (positions, history, etc.).
 */
function updateInterfaceWithRealData(data) {
    // Atualizar estatísticas principais com dados REAIS
    document.getElementById('capital').textContent = (data.capitalAtual || 0).toFixed(2);
    document.getElementById('totalTrades').textContent = data.totalTrades || 0;
    document.getElementById('posicoesAbertas').textContent = data.posicoesAbertasCount || 0;
    document.getElementById('lucroDiario').textContent = (data.lucroTotal || 0).toFixed(4);
    
    // Mostrar crescimento composto na interface
    const capitalElement = document.getElementById('capital');
    const crescimento = data.crescimentoComposto || 0;
    capitalElement.style.color = crescimento >= 0 ? '#00ff88' : '#ff4444';
    capitalElement.title = `Crescimento: ${crescimento.toFixed(2)}%`;
    
    // Atualizar tabelas com dados reais
    updateTables(data.posicoesAbertas || [], data.historicoTrades || []);
    
    // Atualizar gráfico com capital real
    updateChart(data.capitalAtual || 0);
    
    // Atualizar carrossel com pares sendo analisados
    if (data.stats && data.stats.selectedPairs > 0) {
        updateCarouselWithRealPairs(data.stats.selectedPairs);
    }
    
    // Log para debug
    console.log('📊 Dados reais atualizados:', {
        capital: data.capitalAtual,
        trades: data.totalTrades,
        posicoes: data.posicoesAbertasCount,
        crescimento: data.crescimentoComposto
    });
}

/**
 * Updates bot's visual status in interface.
 * @param {boolean} isActive - Is bot active?
 * @param {string} [statusText=null] - Custom status text.
 */
function updateBotStatus(isActive, statusText = null) {
    const startBtn = document.getElementById('startBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const statusIndicator = document.getElementById('botStatus');

    if (isActive) {
        startBtn.disabled = true;
        pauseBtn.disabled = false;
        statusIndicator.className = 'status-indicator status-active';
        statusIndicator.innerHTML = `<i class="fas fa-circle"></i> ${statusText || 'Bot Active'}`;
    } else {
        startBtn.disabled = false;
        pauseBtn.disabled = true;
        statusIndicator.className = 'status-indicator status-inactive';
        statusIndicator.innerHTML = `<i class="fas fa-circle"></i> ${statusText || 'Bot Inactive'}`;
    }
}

function updateChart(capitalAtual) {
    if (!graficoLucro) return;
    const tempo = new Date().toLocaleTimeString();
    graficoLucro.data.labels.push(tempo);
    graficoLucro.data.datasets[0].data.push(capitalAtual);

    if (graficoLucro.data.labels.length > 50) {
        graficoLucro.data.labels.shift();
        graficoLucro.data.datasets[0].data.shift();
    }
    graficoLucro.update();
}

function updateTables(posicoesAbertas, historicoTrades) {
    // Atualizar tabela de posições abertas com dados REAIS
    const abertasBody = document.querySelector('#abertas tbody');
    abertasBody.innerHTML = '';
    
    posicoesAbertas.forEach(posicao => {
        const row = abertasBody.insertRow();
        const pnlColor = posicao.pnl >= 0 ? '#00ff88' : '#ff4444';
        row.innerHTML = `
            <td>${posicao.par}</td>
            <td style="color: ${posicao.tipo === 'buy' ? '#00ff88' : '#ff4444'}">${posicao.tipo.toUpperCase()}</td>
            <td>${posicao.quantidade.toFixed(6)}</td>
            <td>$${posicao.precoAbertura.toFixed(4)}</td>
            <td style="color: ${pnlColor}">${posicao.status} (${posicao.pnl >= 0 ? '+' : ''}${posicao.pnl.toFixed(4)})</td>
        `;
    });
    
    // Atualizar tabela de histórico com trades REAIS
    const historicoBody = document.querySelector('#historico tbody');
    historicoBody.innerHTML = '';
    
    // Mostrar apenas os últimos 20 trades
    const recentTrades = historicoTrades.slice(-20).reverse();
    
    recentTrades.forEach(trade => {
        const row = historicoBody.insertRow();
        const lucroColor = trade.lucro >= 0 ? '#00ff88' : '#ff4444';
        row.innerHTML = `
            <td>${trade.par}</td>
            <td style="color: ${trade.tipo === 'buy' ? '#00ff88' : '#ff4444'}">${trade.tipo.toUpperCase()}</td>
            <td>${trade.quantidade.toFixed(6)}</td>
            <td>$${trade.precoAbertura.toFixed(4)}</td>
            <td>$${trade.precoFechamento.toFixed(4)}</td>
            <td style="color: ${lucroColor}">${trade.lucro >= 0 ? '+' : ''}${trade.lucro.toFixed(4)} USDT</td>
        `;
    });
}

/**
 * Atualiza carrossel com pares sendo analisados em tempo real
 * @param {number} selectedPairs - Número de pares selecionados
 */
function updateCarouselWithRealPairs(selectedPairs) {
    const track = document.getElementById('carouselTrack');
    
    // Atualizar header do carrossel
    const header = document.querySelector('.carousel-header span');
    header.textContent = `Analisando ${selectedPairs} Pares em Tempo Real`;
    
    // Simular ativos sendo analisados (em produção, viria do backend)
    const assets = [
        'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'SOLUSDT',
        'XRPUSDT', 'DOTUSDT', 'LINKUSDT', 'LTCUSDT', 'BCHUSDT'
    ];
    
    track.innerHTML = assets.slice(0, selectedPairs).map(asset => `
        <div class="asset-item analyzing">
            <i class="fas fa-chart-line asset-icon"></i>
            <span>${asset}</span>
        </div>
    `).join('');
}

function updatePlaceholders() {
    const apiKeyField = document.getElementById('apiKey');
    const apiSecretField = document.getElementById('apiSecret');
    if (safeConfig.hasApiKeys) {
        apiKeyField.placeholder = '🔐 Key already configured on server';
        apiSecretField.placeholder = '🔐 Secret already configured on server';
    } else {
        apiKeyField.placeholder = 'Enter your Binance API Key';
        apiSecretField.placeholder = 'Enter your Binance API Secret';
    }
}

function openSettings() {
    document.getElementById('settingsModal').style.display = 'block';
    document.getElementById('capitalInicial').value = safeConfig.capitalInicial;
    document.getElementById('riskLevel').value = safeConfig.riskLevel;
    updatePlaceholders();
}

function closeSettings() { 
    document.getElementById('settingsModal').style.display = 'none'; 
}

// ===================================================================================
// PAGE INITIALIZATION
// ===================================================================================

document.addEventListener('DOMContentLoaded', () => {
    socket.init().then(success => {
        if (success) {
            loadConfigFromServer();
        } else {
            showNotification('Critical failure in server communication.', 'error');
        }
    });
    
    const ctx = document.getElementById('graficoLucro').getContext('2d');
    graficoLucro = new Chart(ctx, {
        type: 'line',
        data: { 
            labels: [], 
            datasets: [{ 
                label: 'Capital (USDT)', 
                data: [], 
                borderColor: '#00ff88', 
                tension: 0.3, 
                fill: true, 
                backgroundColor: 'rgba(0,255,136,0.1)' 
            }] 
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false 
        }
    });

    document.getElementById('settingsForm').addEventListener('submit', saveSettings);
    document.getElementById('startBtn').addEventListener('click', startBot);
    document.getElementById('pauseBtn').addEventListener('click', pauseBot);
    document.querySelector('.settings-btn').addEventListener('click', openSettings);
    document.querySelector('.close').addEventListener('click', closeSettings);
});
