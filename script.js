const socket = io();

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
