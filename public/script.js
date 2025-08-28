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
    const { posicoesAbertas, historicoTrades, capitalAtual } = data;

    document.getElementById('capital').innerText = parseFloat(capitalAtual).toFixed(2);
    document.getElementById('totalTrades').innerText = historicoTrades.length;
    document.getElementById('posicoesAbertas').innerText = posicoesAbertas.length;
    
    const lucroTotal = historicoTrades.reduce((acc, trade) => acc + (trade.lucro || 0), 0);
    document.getElementById('lucroDiario').innerText = lucroTotal.toFixed(2);

    updateChart(capitalAtual);
    updateTables(posicoesAbertas, historicoTrades);
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
    const tbodyAberta = document.querySelector("#abertas tbody");
    tbodyAberta.innerHTML = "";
    posicoesAbertas.forEach(p => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${p.par}</td><td>${p.tipo}</td><td>${p.quantidade}</td><td>${p.precoAbertura}</td><td>${p.status || 'N/A'}</td>`;
        tbodyAberta.appendChild(tr);
    });

    const tbodyHist = document.querySelector("#historico tbody");
    tbodyHist.innerHTML = "";
    historicoTrades.forEach(t => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${t.par}</td><td>${t.tipo}</td><td>${t.quantidade}</td><td>${t.precoAbertura}</td><td>${t.precoFechamento}</td><td>${t.lucro.toFixed(2)}</td>`;
        tbodyHist.appendChild(tr);
    });
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
