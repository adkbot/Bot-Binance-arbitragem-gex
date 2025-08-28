// Sistema de comunicação HTTP (sem Socket.IO) para Vercel
let httpClient = {
    sessionId: null,
    eventListeners: new Map(),
    pollingInterval: null,
    
    // Simular emit do Socket.IO
    emit: async function(event, data) {
        try {
            const response = await fetch('/api/socket-event', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sessionId: this.sessionId,
                    event: event,
                    data: data
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('Evento enviado:', event, result);
                return result;
            }
        } catch (error) {
            console.error('Erro ao enviar evento:', error);
        }
    },
    
    // Simular on do Socket.IO
    on: function(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    },
    
    // Simular off do Socket.IO
    off: function(event, callback) {
        if (this.eventListeners.has(event)) {
            const listeners = this.eventListeners.get(event);
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    },
    
    // Inicializar sessão
    init: async function() {
        try {
            const response = await fetch('/api/create-session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const result = await response.json();
                this.sessionId = result.sessionId;
                console.log('Sessão HTTP criada:', this.sessionId);
                
                // Simular evento de conexão
                this.triggerEvent('sessionCreated', { sessionId: this.sessionId });
                
                // Iniciar polling para receber eventos
                this.startPolling();
                
                return true;
            }
        } catch (error) {
            console.error('Erro ao criar sessão:', error);
        }
        return false;
    },
    
    // Polling para receber eventos do servidor
    startPolling: function() {
        this.pollingInterval = setInterval(async () => {
            try {
                const response = await fetch(`/api/poll-events?sessionId=${this.sessionId}`);
                if (response.ok) {
                    const events = await response.json();
                    events.forEach(eventData => {
                        this.triggerEvent(eventData.event, eventData.data);
                    });
                }
            } catch (error) {
                console.error('Erro no polling:', error);
            }
        }, 2000); // Poll a cada 2 segundos
    },
    
    // Disparar evento para listeners
    triggerEvent: function(event, data) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error('Erro ao executar callback:', error);
                }
            });
        }
    }
};

// Usar httpClient como socket
let socket = httpClient;

// Inicializar conexão HTTP
httpClient.init().then(success => {
    if (success) {
        console.log('Sistema de comunicação HTTP inicializado com sucesso!');
    } else {
        console.error('Falha ao inicializar sistema de comunicação HTTP');
    }
});

// Estado do bot - Declarações globais no topo
let botActive = false;
let sessionId = null;
let botConfig = {
    apiKey: '',
    apiSecret: '',
    capitalInicial: 500,
    riskLevel: 'medio'
};

// Configurações seguras (sem credenciais)
let safeConfig = {
    capitalInicial: 500,
    riskLevel: 'medio',
    hasApiKeys: false
};

// Estado do carrossel
let assetsBeingAnalyzed = [];
let foundOpportunities = [];
let carouselInterval = null;

// Variáveis do gráfico
let graficoLucro = null;

// Lista de pares para análise
const tradingPairs = [
    'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'XRPUSDT',
    'SOLUSDT', 'DOTUSDT', 'DOGEUSDT', 'AVAXUSDT', 'SHIBUSDT',
    'MATICUSDT', 'LTCUSDT', 'UNIUSDT', 'LINKUSDT', 'ATOMUSDT',
    'ETCUSDT', 'XLMUSDT', 'BCHUSDT', 'FILUSDT', 'TRXUSDT'
];

// Objeto para armazenar símbolos e cores de criptomoedas
const spriteSymbols = {
    'BTC': { symbol: '₿', color: '#f7931a' },
    'ETH': { symbol: 'Ξ', color: '#627eea' },
    'BNB': { symbol: 'BNB', color: '#f3ba2f' },
    'SOL': { symbol: 'SOL', color: '#00ffbd' },
    'XRP': { symbol: 'XRP', color: '#23292f' },
    'ADA': { symbol: 'ADA', color: '#0033ad' },
    'DOGE': { symbol: '🐶', color: '#c3a634' },
    'DOT': { symbol: 'DOT', color: '#e6007a' },
    'AVAX': { symbol: 'AVAX', color: '#e84142' },
    'MATIC': { symbol: 'MATIC', color: '#8247e5' },
    'LINK': { symbol: 'LINK', color: '#2a5ada' },
    'ATOM': { symbol: 'ATOM', color: '#2e3148' },
    'LTC': { symbol: 'Ł', color: '#345d9d' },
    'FTM': { symbol: 'FTM', color: '#1969ff' },
    'TRX': { symbol: 'TRX', color: '#ff0013' },
    'NEAR': { symbol: 'NEAR', color: '#000000' },
    'APE': { symbol: '🦍', color: '#0052ff' },
    'MANA': { symbol: 'MANA', color: '#ff2d55' }
};

// Função para alternar tema
function toggleTheme() {
    const body = document.body;
    const themeIcon = document.getElementById('theme-icon');
    
    if (body.getAttribute('data-theme') === 'dark') {
        body.setAttribute('data-theme', 'light');
        themeIcon.className = 'fas fa-sun';
        localStorage.setItem('theme', 'light');
    } else {
        body.setAttribute('data-theme', 'dark');
        themeIcon.className = 'fas fa-moon';
        localStorage.setItem('theme', 'dark');
    }
}

// Carregar tema salvo
function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    const body = document.body;
    const themeIcon = document.getElementById('theme-icon');
    
    body.setAttribute('data-theme', savedTheme);
    themeIcon.className = savedTheme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
}

// Abrir modal de configurações
function openSettings() {
    const modal = document.getElementById('settingsModal');
    modal.style.display = 'block';
    
    // Carregar apenas configurações seguras (NUNCA credenciais)
    document.getElementById('apiKey').value = ''; // Sempre vazio por segurança
    document.getElementById('apiSecret').value = ''; // Sempre vazio por segurança
    document.getElementById('capitalInicial').value = safeConfig.capitalInicial;
    document.getElementById('riskLevel').value = safeConfig.riskLevel;
    
    // Mostrar status das chaves API sem revelar os valores
    const apiKeyField = document.getElementById('apiKey');
    const apiSecretField = document.getElementById('apiSecret');
    
    if (safeConfig.hasApiKeys) {
        apiKeyField.placeholder = 'Chaves configuradas - Digite nova chave para alterar';
        apiSecretField.placeholder = 'Secret configurado - Digite novo secret para alterar';
    } else {
        apiKeyField.placeholder = 'Digite sua chave da API Binance';
        apiSecretField.placeholder = 'Digite seu secret da API Binance';
    }
}

// Fechar modal de configurações
function closeSettings() {
    const modal = document.getElementById('settingsModal');
    modal.style.display = 'none';
}

// Salvar configurações
function saveSettings(event) {
    event.preventDefault();
    
    console.log('=== SALVANDO CONFIGURAÇÕES ===');
    
    const apiKey = document.getElementById('apiKey').value.trim();
    const apiSecret = document.getElementById('apiSecret').value.trim();
    const capitalInicial = parseFloat(document.getElementById('capitalInicial').value);
    const riskLevel = document.getElementById('riskLevel').value;
    
    console.log('Dados do formulário:', {
        hasApiKey: !!apiKey,
        hasApiSecret: !!apiSecret,
        apiKeyLength: apiKey ? apiKey.length : 0,
        capital: capitalInicial,
        risk: riskLevel
    });
    
    // Validar se as chaves foram preenchidas
    if (!apiKey || !apiSecret) {
        console.log('❌ Validação falhou: chaves vazias');
        showNotification('Por favor, preencha a API Key e Secret da Binance!', 'error');
        return;
    }
    
    console.log('✅ Validação passou, salvando...');
    
    // Atualizar configurações locais IMEDIATAMENTE
    botConfig.apiKey = apiKey;
    botConfig.apiSecret = apiSecret;
    botConfig.capitalInicial = capitalInicial;
    botConfig.riskLevel = riskLevel;
    
    // Atualizar configurações seguras IMEDIATAMENTE
    safeConfig.capitalInicial = capitalInicial;
    safeConfig.riskLevel = riskLevel;
    safeConfig.hasApiKeys = true;
    
    // Salvar TUDO no localStorage de forma persistente
    const completeConfig = {
        // Dados básicos
        capitalInicial: capitalInicial,
        riskLevel: riskLevel,
        hasApiKeys: true,
        // Chaves criptografadas
        encryptedKeys: btoa(JSON.stringify({
            apiKey: apiKey,
            apiSecret: apiSecret,
            timestamp: Date.now()
        })),
        // Timestamp para controle
        savedAt: Date.now()
    };
    
    localStorage.setItem('botCompleteConfig', JSON.stringify(completeConfig));
    localStorage.setItem('botSafeConfig', JSON.stringify({
        capitalInicial: capitalInicial,
        riskLevel: riskLevel,
        hasApiKeys: true
    }));
    
    console.log('💾 Configurações COMPLETAS salvas no localStorage');
    console.log('🔐 Chaves criptografadas e salvas localmente');
    
    // Tentar enviar para o servidor (mas não depender disso)
    socket.emit('updateConfig', botConfig).then(() => {
        console.log('✅ Configurações também enviadas para o servidor');
    }).catch((error) => {
        console.log('⚠️ Servidor não respondeu, mas configurações salvas localmente:', error);
    });
    
    closeSettings();
    showNotification('🔐 Configurações salvas com sucesso! Persistem entre sessões.', 'success');
    
    // Atualizar placeholders
    setTimeout(() => {
        updatePlaceholders();
    }, 500);
    
    console.log('botConfig final:', {
        hasApiKey: !!botConfig.apiKey,
        hasApiSecret: !!botConfig.apiSecret,
        apiKeyLength: botConfig.apiKey ? botConfig.apiKey.length : 0,
        capital: botConfig.capitalInicial,
        risk: botConfig.riskLevel
    });
}

// Função para limpar chaves salvas
function clearSavedKeys() {
    localStorage.removeItem('secureApiKeys');
    botConfig.apiKey = '';
    botConfig.apiSecret = '';
    safeConfig.hasApiKeys = false;
    console.log('🗑️ Chaves removidas com sucesso');
    showNotification('Chaves API removidas da memória', 'warning');
}

// Função para atualizar placeholders
function updatePlaceholders() {
    const apiKeyField = document.getElementById('apiKey');
    const apiSecretField = document.getElementById('apiSecret');
    
    if (apiKeyField && apiSecretField) {
        if (safeConfig.hasApiKeys && (botConfig.apiKey || botConfig.apiSecret)) {
            apiKeyField.placeholder = '🔐 Chaves salvas - Digite nova para alterar';
            apiSecretField.placeholder = '🔐 Secret salvo - Digite novo para alterar';
            apiKeyField.value = '';
            apiSecretField.value = '';
        } else {
            apiKeyField.placeholder = 'Digite sua API Key da Binance';
            apiSecretField.placeholder = 'Digite seu API Secret da Binance';
        }
    }
}

// Funções de criptografia simples para as chaves
function encryptKeys(apiKey, apiSecret) {
    const data = {
        apiKey: apiKey,
        apiSecret: apiSecret,
        timestamp: Date.now()
    };
    return btoa(JSON.stringify(data));
}

function decryptKeys(encrypted) {
    try {
        const data = JSON.parse(atob(encrypted));
        // Verificar se não expirou (24 horas)
        if (Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
            return {
                apiKey: data.apiKey,
                apiSecret: data.apiSecret
            };
        }
    } catch (error) {
        console.log('Erro ao descriptografar chaves:', error);
    }
    return null;
}

// Salvar chaves de forma segura
function saveKeysSecurely(apiKey, apiSecret) {
    if (apiKey && apiSecret) {
        const encrypted = encryptKeys(apiKey, apiSecret);
        localStorage.setItem('secureApiKeys', encrypted);
        console.log('🔐 Chaves salvas de forma segura');
    }
}

// Carregar chaves de forma segura
function loadKeysSecurely() {
    const encrypted = localStorage.getItem('secureApiKeys');
    if (encrypted) {
        const keys = decryptKeys(encrypted);
        if (keys) {
            console.log('🔓 Chaves carregadas com sucesso');
            return keys;
        } else {
            console.log('🕐 Chaves expiraram, removendo...');
            localStorage.removeItem('secureApiKeys');
        }
    }
    return null;
}

// Carregar configurações salvas (incluindo chaves seguras)
function loadConfig() {
    console.log('=== CARREGANDO CONFIGURAÇÕES ===');
    
    // Tentar carregar configuração completa primeiro
    const completeConfig = localStorage.getItem('botCompleteConfig');
    if (completeConfig) {
        try {
            const config = JSON.parse(completeConfig);
            
            // Carregar dados básicos
            safeConfig.capitalInicial = config.capitalInicial || 500;
            safeConfig.riskLevel = config.riskLevel || 'medio';
            safeConfig.hasApiKeys = config.hasApiKeys || false;
            
            botConfig.capitalInicial = config.capitalInicial || 500;
            botConfig.riskLevel = config.riskLevel || 'medio';
            
            // Tentar descriptografar chaves
            if (config.encryptedKeys) {
                try {
                    const keyData = JSON.parse(atob(config.encryptedKeys));
                    
                    // Verificar se não expirou (7 dias)
                    if (Date.now() - keyData.timestamp < 7 * 24 * 60 * 60 * 1000) {
                        botConfig.apiKey = keyData.apiKey;
                        botConfig.apiSecret = keyData.apiSecret;
                        safeConfig.hasApiKeys = true;
                        
                        console.log('✅ Configuração COMPLETA carregada com sucesso!');
                        console.log('🔐 Chaves API descriptografadas e carregadas!');
                        
                        // Mostrar notificação de sucesso
                        showNotification('🔐 Configurações carregadas automaticamente!', 'success');
                        
                        // Atualizar placeholders
                        updatePlaceholders();
                        
                        console.log('Estado final após carregar:', {
                            hasApiKey: !!botConfig.apiKey,
                            hasApiSecret: !!botConfig.apiSecret,
                            apiKeyLength: botConfig.apiKey ? botConfig.apiKey.length : 0,
                            capital: botConfig.capitalInicial,
                            risk: botConfig.riskLevel,
                            hasKeys: safeConfig.hasApiKeys
                        });
                        
                        return; // Sucesso, não precisa tentar outros métodos
                    } else {
                        console.log('🕐 Chaves expiraram, removendo...');
                        localStorage.removeItem('botCompleteConfig');
                    }
                } catch (decryptError) {
                    console.log('❌ Erro ao descriptografar chaves:', decryptError);
                }
            }
        } catch (parseError) {
            console.log('❌ Erro ao parsear configuração completa:', parseError);
        }
    }
    
    // Fallback: tentar carregar configuração básica
    const savedConfig = localStorage.getItem('botSafeConfig');
    if (savedConfig) {
        try {
            const safe = JSON.parse(savedConfig);
            safeConfig.capitalInicial = safe.capitalInicial || 500;
            safeConfig.riskLevel = safe.riskLevel || 'medio';
            safeConfig.hasApiKeys = false; // Sem chaves no fallback
            
            botConfig.capitalInicial = safeConfig.capitalInicial;
            botConfig.riskLevel = safeConfig.riskLevel;
            botConfig.apiKey = '';
            botConfig.apiSecret = '';
            
            console.log('⚠️ Apenas configurações básicas carregadas (sem chaves)');
        } catch (error) {
            console.log('❌ Erro ao carregar configurações básicas:', error);
        }
    } else {
        console.log('ℹ️ Nenhuma configuração salva encontrada');
    }
}

// Validar saldo via API Binance
async function validateBalance() {
    try {
        showNotification('Verificando saldo na Binance...', 'warning');
        
        const response = await fetch('/api/validate-balance', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                apiKey: botConfig.apiKey,
                apiSecret: botConfig.apiSecret
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Erro ao validar saldo');
        }
        
        return data;
    } catch (error) {
        showNotification(`Erro na validação: ${error.message}`, 'error');
        return null;
    }
}

// Iniciar bot
async function startBot() {
    console.log('=== INICIANDO BOT ===');
    console.log('botConfig atual:', {
        hasApiKey: !!botConfig.apiKey,
        hasApiSecret: !!botConfig.apiSecret,
        apiKeyLength: botConfig.apiKey ? botConfig.apiKey.length : 0,
        capital: botConfig.capitalInicial,
        risk: botConfig.riskLevel
    });
    console.log('safeConfig atual:', safeConfig);
    
    if (!botConfig.apiKey || !botConfig.apiSecret) {
        console.log('❌ Chaves API não encontradas!');
        showNotification('Configure suas chaves da API primeiro! Chaves não estão salvas na sessão.', 'error');
        openSettings();
        return;
    }
    
    console.log('✅ Chaves API encontradas, continuando...');
    
    // Validar saldo mínimo configurado
    if (botConfig.capitalInicial < 20) {
        showNotification('Saldo mínimo necessário: $20 USD para operar!', 'error');
        openSettings();
        return;
    }
    
    // Validar saldo real na API
    console.log('🔍 Validando saldo na Binance...');
    const balanceData = await validateBalance();
    if (!balanceData) {
        return; // Erro já mostrado na função validateBalance
    }
    
    if (balanceData.usdtBalance < 20) {
        showNotification(`Saldo insuficiente na Binance: $${balanceData.usdtBalance.toFixed(2)} (mínimo: $20)`, 'error');
        return;
    }
    
    showNotification(`Saldo validado: $${balanceData.usdtBalance.toFixed(2)} USDT disponível`, 'success');
    
    botActive = true;
    document.getElementById('startBtn').disabled = true;
    document.getElementById('pauseBtn').disabled = false;
    
    const statusIndicator = document.getElementById('botStatus');
    statusIndicator.className = 'status-indicator status-active';
    statusIndicator.innerHTML = '<i class="fas fa-circle"></i> Bot Ativo';
    
    // Iniciar carrossel
    startCarousel();
    
    // Inicializar dados de teste para visualização
    initializeTestData();
    
    socket.emit('startBot', botConfig);
    showNotification('Bot iniciado com sucesso!', 'success');
}

// Pausar bot
function pauseBot() {
    botActive = false;
    document.getElementById('startBtn').disabled = false;
    document.getElementById('pauseBtn').disabled = true;
    
    const statusIndicator = document.getElementById('botStatus');
    statusIndicator.className = 'status-indicator status-inactive';
    statusIndicator.innerHTML = '<i class="fas fa-circle"></i> Bot Inativo';
    
    // Parar carrossel
    stopCarousel();
    
    socket.emit('pauseBot');
    showNotification('Bot pausado!', 'warning');
}

// Iniciar carrossel de ativos
function startCarousel() {
    if (carouselInterval) clearInterval(carouselInterval);
    
    // Simular análise de ativos
    carouselInterval = setInterval(() => {
        // Selecionar 3-5 pares aleatórios para análise
        const analyzing = getRandomPairs(3, 5);
        assetsBeingAnalyzed = analyzing;
        
        // Ocasionalmente encontrar oportunidades
        if (Math.random() > 0.7) {
            const opportunity = getRandomPairs(1, 1)[0];
            foundOpportunities.push(opportunity);
            
            // Manter apenas as últimas 3 oportunidades
            if (foundOpportunities.length > 3) {
                foundOpportunities.shift();
            }
        }
        
        updateCarousel();
    }, 2000);
    
    // Primeira atualização imediata
    assetsBeingAnalyzed = getRandomPairs(3, 5);
    updateCarousel();
}

// Parar carrossel
function stopCarousel() {
    if (carouselInterval) {
        clearInterval(carouselInterval);
        carouselInterval = null;
    }
    
    // Limpar carrossel
    const track = document.getElementById('carouselTrack');
    if (track) {
        track.innerHTML = '<div class="asset-item"><i class="fas fa-pause asset-icon"></i>Sistema Pausado</div>';
    }
}

// Obter pares aleatórios
function getRandomPairs(min, max) {
    const count = Math.floor(Math.random() * (max - min + 1)) + min;
    const shuffled = [...tradingPairs].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

// Atualizar carrossel
function updateCarousel() {
    const track = document.getElementById('carouselTrack');
    if (!track) return;
    
    let html = '';
    
    // Adicionar ativos sendo analisados
    assetsBeingAnalyzed.forEach(pair => {
        html += `
            <div class="asset-item analyzing">
                <i class="fas fa-search asset-icon"></i>
                ${pair}
            </div>
        `;
    });
    
    // Adicionar oportunidades encontradas
    foundOpportunities.forEach(pair => {
        html += `
            <div class="asset-item opportunity">
                <i class="fas fa-bullseye asset-icon"></i>
                ${pair} - Oportunidade!
            </div>
        `;
    });
    
    // Se não houver nada, mostrar mensagem padrão
    if (html === '') {
        html = '<div class="asset-item"><i class="fas fa-chart-line asset-icon"></i>Aguardando análise...</div>';
    }
    
    track.innerHTML = html;
}

// Mostrar notificações
function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'times' : 'exclamation'}"></i>
        ${message}
    `;
    
    // Adicionar estilos da notificação
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 10000;
        animation: slideIn 0.3s ease;
        background: ${type === 'success' ? 'var(--success-gradient)' : type === 'error' ? 'var(--danger-gradient)' : 'var(--secondary-gradient)'};
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Função para criar sprites usando o MCP TestSprite com funcionalidades avançadas
function createSprite(par, tipo, delta) {
    const symbol = par.split('/')[0];
    const sprite = document.createElement('div');
    sprite.className = `sprite sprite-${tipo}`;
    
    const coinInfo = spriteSymbols[symbol] || { symbol: symbol, color: '#888888' };
    
    // Criar elemento interno para o símbolo com cor personalizada
    const symbolElement = document.createElement('span');
    symbolElement.textContent = coinInfo.symbol;
    symbolElement.style.color = coinInfo.color;
    sprite.appendChild(symbolElement);
    
    sprite.title = `${par} | ${tipo.toUpperCase()} | Força: ${nivelForca(Math.abs(delta || 0))}`;
    
    // Adiciona animação avançada baseada no tipo de trade e força
    if (tipo === 'buy') {
        sprite.style.animation = `pulse-green ${3 - Math.min(Math.abs(delta), 0.9)}s infinite`;
        sprite.style.borderColor = `rgba(46, 204, 113, ${Math.abs(delta) * 0.8})`;
    } else {
        sprite.style.animation = `pulse-red ${3 - Math.min(Math.abs(delta), 0.9)}s infinite`;
        sprite.style.borderColor = `rgba(231, 76, 60, ${Math.abs(delta) * 0.8})`;
    }
    
    // Adicionar indicador de força
    const strengthIndicator = document.createElement('div');
    strengthIndicator.className = 'strength-indicator';
    const strengthLevel = Math.ceil(Math.abs(delta) * 5);
    for (let i = 0; i < strengthLevel; i++) {
        const dot = document.createElement('span');
        dot.className = 'strength-dot';
        strengthIndicator.appendChild(dot);
    }
    sprite.appendChild(strengthIndicator);
    
    return sprite;
}

// Adiciona estilos de animação para os sprites
const styleSheet = document.createElement('style');
styleSheet.textContent = `
    @keyframes pulse-green {
        0% { transform: scale(1); }
        50% { transform: scale(1.1); box-shadow: 0 0 10px #2ecc71; }
        100% { transform: scale(1); }
    }
    @keyframes pulse-red {
        0% { transform: scale(1); }
        50% { transform: scale(1.1); box-shadow: 0 0 10px #e74c3c; }
        100% { transform: scale(1); }
    }
`;
document.head.appendChild(styleSheet);

// Inicialização do gráfico será feita no DOMContentLoaded

socket.on('update', data => {
  const { posicoesAbertas, historicoTrades, capitalAtual, diagrama } = data;

  document.getElementById('capital').innerText = capitalAtual.toFixed(2);

  // Atualiza gráfico
  const tempo = new Date().toLocaleTimeString();
  graficoLucro.data.labels.push(tempo);
  graficoLucro.data.datasets[0].data.push(capitalAtual.toFixed(2));
  if (graficoLucro.data.labels.length > 30) {
      graficoLucro.data.labels.shift();
      graficoLucro.data.datasets[0].data.shift();
  }
  graficoLucro.update();

  // Atualiza posições abertas
  const tbodyAberta = document.querySelector("#abertas tbody");
  tbodyAberta.innerHTML = "";
  posicoesAbertas.forEach(p => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${p.par}</td><td>${p.tipo}</td><td>${p.quantidade}</td><td>${p.precoAbertura}</td>`;
      tbodyAberta.appendChild(tr);
  });

  // Histórico de trades
  const tbodyHist = document.querySelector("#historico tbody");
  tbodyHist.innerHTML = "";
  historicoTrades.forEach(t => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${t.par}</td><td>${t.tipo}</td><td>${t.quantidade}</td><td>${t.precoAbertura}</td><td>${t.precoFechamento}</td><td>${t.lucro.toFixed(2)}</td>`;
      tbodyHist.appendChild(tr);
  });

  // Barras de força
  const divBarras = document.getElementById('barrasForca');
  divBarras.innerHTML = '';
  posicoesAbertas.forEach(p => {
      const barra = document.createElement('div');
      barra.style.width = Math.min(Math.abs(p.delta)*100,100) + '%';
      barra.style.background = nivelCor(p.delta);
      barra.style.height = '25px';
      barra.style.margin = '5px 0';
      barra.innerText = `${p.par} | ${p.tipo.toUpperCase()} | Força: ${nivelForca(Math.abs(p.delta || 0))}`;
      divBarras.appendChild(barra);
  });

  // Atualiza visualização de sprites usando TestSprite
  const spriteContainer = document.getElementById('spriteContainer');
  spriteContainer.innerHTML = '';
  
  // Adiciona sprites para posições abertas
  posicoesAbertas.forEach(p => {
      const sprite = createSprite(p.par, p.tipo, p.delta);
      spriteContainer.appendChild(sprite);
  });
  
  // Adiciona sprites para os últimos 5 trades do histórico
  const recentTrades = historicoTrades.slice(-5);
  recentTrades.forEach(t => {
      const sprite = createSprite(t.par, t.tipo, 0.8); // Valor de delta padrão para histórico
      sprite.style.opacity = '0.6'; // Mais transparente para indicar que é histórico
      spriteContainer.appendChild(sprite);
  });

  // Diagrama
  const divDiagrama = document.getElementById("diagrama");
  divDiagrama.innerHTML = "";
  diagrama.forEach(p=>{
      const box = document.createElement("div");
      box.className="box";
      box.style.background=p.cor;
      box.innerText=p.passo;
      divDiagrama.appendChild(box);
  });
});

function nivelCor(delta){
    if(delta>=0.9) return '#8e44ad';
    if(delta>=0.8) return '#f39c12';
    return '#3498db';
}

function nivelForca(delta){
    if(delta>=0.9) return 'superior';
    if(delta>=0.8) return 'alto';
    return 'medio';
}

// Diagrama de fluxo do bot
function atualizarDiagramaFluxo() {
    const diagramaDiv = document.getElementById('diagramaFluxo');
    diagramaDiv.innerHTML = `
        <div style="text-align: center; color: #00ff88; font-family: 'Orbitron', monospace;">
            <h3>🤖 Fluxo do Bot de Trading</h3>
            <div style="margin: 20px 0; line-height: 2;">
                📊 Análise Wyckoff → 📈 Delta/GEX → 🎯 Score → 💰 Trade → 📱 WhatsApp
            </div>
            <div style="font-size: 12px; color: #888;">
                Atualizado: ${new Date().toLocaleTimeString()}
            </div>
        </div>
    `;
}

// Event listeners e inicialização
document.addEventListener('DOMContentLoaded', function() {
    // Carregar tema e configurações
    loadTheme();
    loadConfig();
    
    // Inicializar gráfico Chart.js
    const ctx = document.getElementById('graficoLucro');
    if (ctx) {
        graficoLucro = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: { 
                labels: [], 
                datasets: [{ 
                    label: 'Capital (USDT)', 
                    data: [], 
                    borderColor: '#00ff88', 
                    backgroundColor: 'rgba(0,255,136,0.1)', 
                    tension: 0.3,
                    fill: true
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                plugins: { 
                    legend: { 
                        display: true,
                        labels: {
                            color: '#ffffff'
                        }
                    } 
                },
                scales: {
                    x: {
                        ticks: { color: '#ffffff' },
                        grid: { color: 'rgba(255,255,255,0.1)' }
                    },
                    y: {
                        ticks: { color: '#ffffff' },
                        grid: { color: 'rgba(255,255,255,0.1)' }
                    }
                }
            }
        });
    }
    
    // Event listeners para botões (com verificação de existência)
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
    
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) settingsBtn.addEventListener('click', openSettings);
    
    const startBtn = document.getElementById('startBtn');
    if (startBtn) startBtn.addEventListener('click', startBot);
    
    const pauseBtn = document.getElementById('pauseBtn');
    if (pauseBtn) pauseBtn.addEventListener('click', pauseBot);
    
    // Event listeners para modal (com verificação de existência)
    const closeBtn = document.querySelector('.close');
    if (closeBtn) closeBtn.addEventListener('click', closeSettings);
    
    const settingsForm = document.getElementById('settingsForm');
    if (settingsForm) settingsForm.addEventListener('submit', saveSettings);
    
    // Fechar modal ao clicar fora
    window.addEventListener('click', function(event) {
        const modal = document.getElementById('settingsModal');
        if (event.target === modal) {
            closeSettings();
        }
    });
    
    // Inicializar estado do bot (com verificação de existência)
    const statusIndicator = document.getElementById('botStatus');
    if (statusIndicator) {
        statusIndicator.className = 'status-indicator status-inactive';
        statusIndicator.innerHTML = '<i class="fas fa-circle"></i> Bot Inativo';
    }
    
    // Inicializar gráfico e outras funções
    const diagramaDiv = document.getElementById('diagramaFluxo');
    if (diagramaDiv) {
        atualizarDiagramaFluxo();
    }
    
    // Inicializar carrossel com estado parado
    const track = document.getElementById('carouselTrack');
    if (track) {
        track.innerHTML = '<div class="asset-item"><i class="fas fa-pause asset-icon"></i>Sistema Pausado - Configure e inicie o bot</div>';
    }
});

// Inicializar dados de teste para visualização
function initializeTestData() {
    // Dados de teste para o gráfico de performance
    const testData = {
        posicoesAbertas: [
            { par: 'BTCUSDT', tipo: 'buy', quantidade: 0.001, precoAbertura: 45000, delta: 0.85 },
            { par: 'ETHUSDT', tipo: 'sell', quantidade: 0.05, precoAbertura: 2800, delta: 0.72 }
        ],
        historicoTrades: [
            { par: 'BNBUSDT', tipo: 'buy', quantidade: 0.1, precoAbertura: 320, precoFechamento: 335, lucro: 1.5 },
            { par: 'ADAUSDT', tipo: 'sell', quantidade: 100, precoAbertura: 0.45, precoFechamento: 0.42, lucro: 3.0 },
            { par: 'SOLUSDT', tipo: 'buy', quantidade: 0.5, precoAbertura: 95, precoFechamento: 102, lucro: 3.5 }
        ],
        capitalAtual: botConfig.capitalInicial + 8.0,
        diagrama: [
            { passo: 'Análise Wyckoff', cor: '#00ff88' },
            { passo: 'Delta/GEX', cor: '#ffaa00' },
            { passo: 'Execução', cor: '#00c8ff' }
        ]
    };
    
    // Simular evento de atualização
    setTimeout(() => {
        const event = new CustomEvent('update', { detail: testData });
        socket.emit = socket.emit || function() {}; // Fallback
        
        // Atualizar interface diretamente
        updateInterface(testData);
        
        showNotification('Dados de teste carregados para demonstração', 'success');
    }, 1000);
}

// Função para atualizar interface
function updateInterface(data) {
    const { posicoesAbertas, historicoTrades, capitalAtual, diagrama } = data;
    
    // Atualizar capital
    const capitalElement = document.getElementById('capital');
    if (capitalElement) {
        capitalElement.innerText = capitalAtual.toFixed(2);
    }
    
    // Atualizar total de trades
    const totalTradesElement = document.getElementById('totalTrades');
    if (totalTradesElement) {
        totalTradesElement.innerText = historicoTrades.length;
    }
    
    // Atualizar posições abertas
    const posicoesElement = document.getElementById('posicoesAbertas');
    if (posicoesElement) {
        posicoesElement.innerText = posicoesAbertas.length;
    }
    
    // Calcular lucro diário
    const lucroTotal = historicoTrades.reduce((acc, trade) => acc + trade.lucro, 0);
    const lucroDiarioElement = document.getElementById('lucroDiario');
    if (lucroDiarioElement) {
        lucroDiarioElement.innerText = lucroTotal.toFixed(2);
    }
    
    // Atualizar gráfico
    const tempo = new Date().toLocaleTimeString();
    if (graficoLucro) {
        graficoLucro.data.labels.push(tempo);
        graficoLucro.data.datasets[0].data.push(capitalAtual);
        if (graficoLucro.data.labels.length > 30) {
            graficoLucro.data.labels.shift();
            graficoLucro.data.datasets[0].data.shift();
        }
        graficoLucro.update();
    }
    
    // Atualizar tabelas e outros elementos
    updateTables(posicoesAbertas, historicoTrades);
    updateForceIndicators(posicoesAbertas);
    updateSprites(posicoesAbertas, historicoTrades);
    updateDiagram(diagrama);
}

// Atualizar tabelas
function updateTables(posicoesAbertas, historicoTrades) {
    // Posições abertas
    const tbodyAberta = document.querySelector("#abertas tbody");
    if (tbodyAberta) {
        tbodyAberta.innerHTML = "";
        posicoesAbertas.forEach(p => {
            const tr = document.createElement("tr");
            tr.innerHTML = `<td>${p.par}</td><td>${p.tipo}</td><td>${p.quantidade}</td><td>${p.precoAbertura}</td>`;
            tbodyAberta.appendChild(tr);
        });
    }
    
    // Histórico de trades
    const tbodyHist = document.querySelector("#historico tbody");
    if (tbodyHist) {
        tbodyHist.innerHTML = "";
        historicoTrades.forEach(t => {
            const tr = document.createElement("tr");
            tr.innerHTML = `<td>${t.par}</td><td>${t.tipo}</td><td>${t.quantidade}</td><td>${t.precoAbertura}</td><td>${t.precoFechamento}</td><td>${t.lucro.toFixed(2)}</td>`;
            tbodyHist.appendChild(tr);
        });
    }
}

// Atualizar indicadores de força
function updateForceIndicators(posicoesAbertas) {
    const divBarras = document.getElementById('barrasForca');
    if (divBarras) {
        divBarras.innerHTML = '';
        posicoesAbertas.forEach(p => {
            const barra = document.createElement('div');
            barra.style.cssText = `
                width: ${Math.min(Math.abs(p.delta)*100,100)}%;
                background: ${nivelCor(p.delta)};
                height: 25px;
                margin: 5px 0;
                border-radius: 4px;
                display: flex;
                align-items: center;
                padding: 0 10px;
                color: white;
                font-weight: bold;
            `;
            barra.innerText = `${p.par} | ${p.tipo.toUpperCase()} | Força: ${nivelForca(Math.abs(p.delta || 0))}`;
            divBarras.appendChild(barra);
        });
    }
}

// Atualizar sprites
function updateSprites(posicoesAbertas, historicoTrades) {
    const spriteContainer = document.getElementById('spriteContainer');
    if (spriteContainer) {
        spriteContainer.innerHTML = '';
        
        // Adicionar sprites para posições abertas
        posicoesAbertas.forEach(p => {
            const sprite = createSprite(p.par, p.tipo, p.delta);
            spriteContainer.appendChild(sprite);
        });
        
        // Adicionar sprites para os últimos 3 trades do histórico
        const recentTrades = historicoTrades.slice(-3);
        recentTrades.forEach(t => {
            const sprite = createSprite(t.par, t.tipo, 0.6);
            sprite.style.opacity = '0.6';
            spriteContainer.appendChild(sprite);
        });
    }
}

// Atualizar diagrama
function updateDiagram(diagrama) {
    const divDiagrama = document.getElementById("diagramaFluxo");
    if (divDiagrama) {
        divDiagrama.innerHTML = "";
        diagrama.forEach(p => {
            const box = document.createElement("div");
            box.className = "box";
            box.style.cssText = `
                background: ${p.cor};
                padding: 10px;
                margin: 5px;
                border-radius: 8px;
                color: white;
                font-weight: bold;
                text-align: center;
                display: inline-block;
                min-width: 120px;
            `;
            box.innerText = p.passo;
            divDiagrama.appendChild(box);
        });
    }
}

// Adicionar eventos do Socket.IO para sessões isoladas
socket.on('sessionCreated', (data) => {
    sessionId = data.sessionId;
    console.log('Sessão criada:', sessionId);
    showNotification('Sessão privada iniciada com sucesso!', 'success');
});

socket.on('botStatus', (data) => {
    botActive = data.ativo;
    if (data.config) {
        // Atualizar apenas configurações seguras
        safeConfig.capitalInicial = data.config.capitalInicial;
        safeConfig.riskLevel = data.config.riskLevel;
        safeConfig.hasApiKeys = data.config.hasApiKeys;
        
        // Atualizar botConfig apenas com dados não sensíveis
        botConfig.capitalInicial = data.config.capitalInicial;
        botConfig.riskLevel = data.config.riskLevel;
    }
});

socket.on('configUpdated', (data) => {
    // Atualizar apenas configurações seguras recebidas do servidor
    safeConfig.capitalInicial = data.capitalInicial;
    safeConfig.riskLevel = data.riskLevel;
    safeConfig.hasApiKeys = data.hasApiKeys;
    
    showNotification('Configurações atualizadas para sua sessão!', 'success');
});

socket.on('botStarted', (data) => {
    if (data.ativo) {
        botActive = true;
        startCarousel();
        showNotification('Seu bot foi iniciado com sucesso!', 'success');
        
        // Atualizar configurações seguras
        if (data.config) {
            safeConfig.capitalInicial = data.config.capitalInicial;
            safeConfig.riskLevel = data.config.riskLevel;
            safeConfig.hasApiKeys = data.config.hasApiKeys;
        }
    }
});

socket.on('botPaused', (data) => {
    botActive = false;
    stopCarousel();
    showNotification('Seu bot foi pausado!', 'warning');
});

socket.on('botError', (error) => {
    showNotification(`Erro no seu bot: ${error.message}`, 'error');
    stopCarousel();
});

socket.on('pairAnalysis', (data) => {
    // Atualizar com dados reais do servidor (isolados por sessão)
    if (data.analyzing) {
        assetsBeingAnalyzed = data.analyzing;
    }
    if (data.opportunities) {
        foundOpportunities = data.opportunities;
    }
    updateCarousel();
});

// Manter compatibilidade com eventos antigos (isolados por sessão)
socket.on('update', (data) => {
    updateInterface(data);
});

// Adicionar estilos para animações
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    .notification {
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        border-left: 4px solid rgba(255, 255, 255, 0.3);
    }
`;
document.head.appendChild(style);
