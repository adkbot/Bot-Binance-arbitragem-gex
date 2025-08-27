const socket = io();

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
