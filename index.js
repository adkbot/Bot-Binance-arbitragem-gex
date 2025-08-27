<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Bot Binance - Painel Juros Compostos</title>
<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet">
<style>
:root {
    --primary-color: #9b59b6;
    --secondary-color: #3498db;
    --success-color: #2ecc71;
    --danger-color: #e74c3c;
    --dark-bg: #1b1b1b;
    --card-bg: #2c3e50;
    --text-color: #fff;
    --border-radius: 8px;
    --box-shadow: 0 4px 8px rgba(0,0,0,0.3);
    --transition: all 0.3s ease;
}

body { 
    font-family: 'Roboto', sans-serif; 
    background: var(--dark-bg); 
    color: var(--text-color); 
    margin: 0; 
    padding: 20px; 
}

h1 { 
    color: var(--primary-color); 
    text-align: center;
    margin-bottom: 30px;
}

h2 { 
    margin-top: 25px; 
    border-bottom: 1px solid #444;
    padding-bottom: 8px;
}

table { 
    width: 100%; 
    border-collapse: collapse; 
    margin-bottom: 25px; 
    border-radius: var(--border-radius);
    overflow: hidden;
    box-shadow: var(--box-shadow);
}

th, td { 
    border: 1px solid #444; 
    padding: 12px; 
    text-align: center; 
}

th { 
    background: var(--card-bg); 
    font-weight: 500;
}

tr:hover {
    background-color: rgba(255,255,255,0.05);
}

#diagrama { 
    margin-top: 25px; 
    padding: 15px; 
    background: var(--card-bg); 
    border-radius: var(--border-radius); 
    box-shadow: var(--box-shadow);
}

.box { 
    padding: 8px 15px; 
    margin: 8px 0; 
    border-radius: var(--border-radius); 
    color: var(--text-color); 
    transition: var(--transition);
}

.box:hover {
    transform: translateY(-3px);
    box-shadow: 0 6px 12px rgba(0,0,0,0.2);
}

#spriteContainer { 
    margin-top: 25px; 
    display: flex; 
    flex-wrap: wrap; 
    gap: 15px; 
    justify-content: center;
}

.sprite { 
    width: 64px; 
    height: 64px; 
    background-size: contain; 
    background-repeat: no-repeat; 
    background-position: center; 
    transition: transform 0.3s ease;
    border-radius: var(--border-radius);
}

.sprite:hover {
    transform: scale(1.1);
}

.sprite-buy { 
    background-color: rgba(46, 204, 113, 0.3); 
    border: 2px solid var(--success-color); 
}

.sprite-sell { 
    background-color: rgba(231, 76, 60, 0.3); 
    border: 2px solid var(--danger-color); 
}

@media (max-width: 768px) {
    body {
        padding: 10px;
    }
    
    table {
        font-size: 14px;
    }
    
    .sprite {
        width: 48px;
        height: 48px;
    }
}
</style>
</head>
<body>
<h1>Bot Binance - Painel Juros Compostos</h1>
<h2>Capital Atual: <span id="capital">0</span> USDT</h2>

<h2>Posições Abertas</h2>
<table id="abertas">
  <thead>
    <tr><th>Par</th><th>Tipo</th><th>Qtd</th><th>Preço Abertura</th></tr>
  </thead>
  <tbody></tbody>
</table>

<h2>Histórico de Trades</h2>
<table id="historico">
  <thead>
    <tr><th>Par</th><th>Tipo</th><th>Qtd</th><th>Preço Abertura</th><th>Preço Fechamento</th><th>Lucro</th></tr>
  </thead>
  <tbody></tbody>
</table>

<h2>Gráfico de Lucro em Tempo Real</h2>
<canvas id="graficoLucro" width="800" height="300"></canvas>

<h2>Barras de Força das Posições Abertas</h2>
<div id="barrasForca"></div>

<h2>Visualização de Trades com TestSprite</h2>
<div id="spriteContainer"></div>

<h2>Diagrama de Fluxo do Bot</h2>
<div id="diagrama"></div>

<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<script src="/socket.io/socket.io.js"></script>
<script src="script.js"></script>
</body>
</html>
