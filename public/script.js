const socket = io();

// Estado do bot
let botActive = false;
let botConfig = {
    apiKey: '',
    apiSecret: '',
    capitalInicial: 500,
    riskLevel: 'medio'
};

// Estado do carrossel
let assetsBeingAnalyzed = [];
let foundOpportunities = [];
let carouselInterval = null;

// Lista de pares para análise
const tradingPairs = [
    'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'XRPUSDT',
    'SOLUSDT', 'DOTUSDT', 'DOGEUSDT', 'AVAXUSDT', 'SHIBUSDT',
    'MATICUSDT', 'LTCUSDT', 'UNIUSDT', 'LINKUSDT', 'ATOMUSDT',
    'ETCUSDT', 'XLMUSDT', 'BCHUSDT', 'FILUSDT', 'TRXUSDT'
];

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
    
    // Carregar configurações salvas
    document.getElementById('apiKey').value = botConfig.apiKey;
    document.getElementById('apiSecret').value = botConfig.apiSecret;
    document.getElementById('capitalInicial').value = botConfig.capitalInicial;
    document.getElementById('riskLevel').value = botConfig.riskLevel;
}

// Fechar modal de configurações
function closeSettings() {
    const modal = document.getElementById('settingsModal');
    modal.style.display = 'none';
}

// Salvar configurações
function saveSettings(event) {
    event.preventDefault();
    
    botConfig.apiKey = document.getElementById('apiKey').value;
    botConfig.apiSecret = document.getElementById('apiSecret').value;
    botConfig.capitalInicial = parseFloat(document.getElementById('capitalInicial').value);
    botConfig.riskLevel = document.getElementById('riskLevel').value;
    
    // Salvar no localStorage
    localStorage.setItem('botConfig', JSON.stringify(botConfig));
    
    // Enviar configurações para o servidor
    socket.emit('updateConfig', botConfig);
    
    closeSettings();
    
    // Mostrar notificação
    showNotification('Configurações salvas com sucesso!', 'success');
}

// Carregar configurações salvas
function loadConfig() {
    const savedConfig = localStorage.getItem('botConfig');
    if (savedConfig) {
        botConfig = JSON.parse(savedConfig);
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
    if (!botConfig.apiKey || !botConfig.apiSecret) {
        showNotification('Configure suas chaves da API primeiro!', 'error');
        openSettings();
        return;
    }
    
    // Validar saldo mínimo configurado
    if (botConfig.capitalInicial < 20) {
        showNotification('Saldo mínimo necessário: $20 USD para operar!', 'error');
        openSettings();
        return;
    }
    
    // Validar saldo real na API
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

const ctx = document.getElementById('graficoLucro').getContext('2d');
const graficoLucro = new Chart(ctx, {
    type: 'line',
    data: { labels: [], datasets: [{ label: 'Capital (USDT)', data: [], borderColor: '#9b59b6', backgroundColor: 'rgba(155,89,182,0.2)', tension: 0.3 }]},
    options: { responsive: true, plugins: { legend: { display: true } } }
});

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

// Adicionar eventos do Socket.IO para monitoramento
socket.on('botStarted', (data) => {
    if (data.ativo) {
        startCarousel();
        showNotification('Bot conectado e analisando mercado!', 'success');
    }
});

socket.on('botPaused', (data) => {
    stopCarousel();
});

socket.on('botError', (error) => {
    showNotification(`Erro no bot: ${error.message}`, 'error');
    stopCarousel();
});

socket.on('pairAnalysis', (data) => {
    // Atualizar com dados reais do servidor
    if (data.analyzing) {
        assetsBeingAnalyzed = data.analyzing;
    }
    if (data.opportunities) {
        foundOpportunities = data.opportunities;
    }
    updateCarousel();
});

// Manter compatibilidade com eventos antigos
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
