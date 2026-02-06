const express = require('express');
const app = express();
const fs = require('fs');
const https = require('https');
const crypto = require('crypto');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// ===================================================
// ⚙️ CONFIGURAÇÕES
// ===================================================

const TELEGRAM_BOT_TOKEN = "SEU_TOKEN_AQUI"; 
const TELEGRAM_CHAT_ID = "SEU_CHAT_ID_AQUI"; 
const SENHA_ADMIN = "admin123"; 

const ARQUIVO_LEADS = 'leads.json';
const ARQUIVO_FINANCEIRO = 'financeiro.json';
const ARQUIVO_SOLICITACOES = 'solicitacoes.json';
const ARQUIVO_GANHADORES = 'ganhadores.json';
const ARQUIVO_TENTATIVAS = 'tentativas.json';
const ARQUIVO_CONFIG = 'config.json';

// Inicializa o cofre se não existir
let configCofre = { premioAtual: 500.30, senhaCorreta: "1234" };
if (fs.existsSync(ARQUIVO_CONFIG)) {
    configCofre = JSON.parse(fs.readFileSync(ARQUIVO_CONFIG));
} else {
    fs.writeFileSync(ARQUIVO_CONFIG, JSON.stringify(configCofre, null, 2));
}

// ===================================================
// 🛠️ FUNÇÕES AUXILIARES
// ===================================================

function lerArquivo(arquivo) {
    if (fs.existsSync(arquivo)) {
        try {
            return JSON.parse(fs.readFileSync(arquivo));
        } catch (e) {
            return [];
        }
    }
    return [];
}

function salvarArquivo(arquivo, dados) {
    fs.writeFileSync(arquivo, JSON.stringify(dados, null, 2));
}

function notificarTelegram(mensagem) {
    if (TELEGRAM_BOT_TOKEN === "SEU_TOKEN_AQUI") return;
    
    const data = JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: mensagem,
        parse_mode: 'Markdown'
    });

    const options = {
        hostname: 'api.telegram.org',
        port: 443,
        path: `/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': data.length
        }
    };

    const req = https.request(options, res => {
        res.on('data', () => {});
    });
    
    req.on('error', error => {
        console.error('Erro Telegram:', error);
    });
    
    req.write(data);
    req.end();
}

function obterConfigCofreAtual() {
    if (fs.existsSync(ARQUIVO_CONFIG)) {
        try {
            return JSON.parse(fs.readFileSync(ARQUIVO_CONFIG));
        } catch (e) {
            return configCofre;
        }
    }
    return configCofre;
}

function obterUltimosGanhadores(quantidade = 3) {
    const ganhadores = lerArquivo(ARQUIVO_GANHADORES);
    if (ganhadores.length) {
        return ganhadores
            .slice(-quantidade)
            .reverse()
            .map(ganhador => ({
                nome: ganhador.nome,
                valor: ganhador.valor
            }));
    }

    const solicitacoes = lerArquivo(ARQUIVO_SOLICITACOES);
    return solicitacoes
        .filter(solicitacao => ["PAGO", "PENDENTE"].includes(solicitacao.status))
        .slice(-quantidade)
        .reverse()
        .map(solicitacao => ({
            nome: solicitacao.nome,
            valor: solicitacao.valor
        }));
}

function parseDataPtBr(dataStr) {
    if (!dataStr || typeof dataStr !== 'string') return null;
    const [data, hora] = dataStr.split(' ');
    if (!data) return null;
    const [dia, mes, ano] = data.split('/');
    if (!dia || !mes || !ano) return null;
    const horaStr = hora || '00:00:00';
    const [hh, mm, ss] = horaStr.split(':');
    return new Date(
        Number(ano),
        Number(mes) - 1,
        Number(dia),
        Number(hh || 0),
        Number(mm || 0),
        Number(ss || 0)
    );
}

function obterChaveData(registro) {
    if (registro.dataISO) {
        return new Date(registro.dataISO).toISOString().slice(0, 10);
    }
    const data = parseDataPtBr(registro.data);
    if (!data || Number.isNaN(data.getTime())) return null;
    return data.toISOString().slice(0, 10);
}

function gerarSerieDiaria(registros, extrairValor, dias = 7) {
    const hoje = new Date();
    const labels = [];
    const valores = [];
    for (let i = dias - 1; i >= 0; i--) {
        const dia = new Date(hoje);
        dia.setDate(hoje.getDate() - i);
        labels.push(dia.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
        const chave = dia.toISOString().slice(0, 10);
        const total = registros
            .filter(registro => obterChaveData(registro) === chave)
            .reduce((acc, registro) => acc + extrairValor(registro), 0);
        valores.push(Number(total.toFixed(2)));
    }
    return { labels, valores };
}

function obterTopVencedoresDia(quantidade = 5) {
    const ganhadores = lerArquivo(ARQUIVO_GANHADORES);
    const hoje = new Date().toISOString().slice(0, 10);
    return ganhadores
        .filter(ganhador => obterChaveData(ganhador) === hoje)
        .sort((a, b) => (b.valor || 0) - (a.valor || 0))
        .slice(0, quantidade)
        .map(ganhador => ({
            nome: ganhador.nome,
            valor: ganhador.valor
        }));
}

// ===================================================
// 🚀 ROTAS DO JOGO
// ===================================================

// Salvar Lead (Cadastro)
app.post('/salvar-lead', (req, res) => {
    const leads = lerArquivo(ARQUIVO_LEADS);
    leads.push({
        ...req.body,
        data: new Date().toLocaleString('pt-BR'),
        dataISO: new Date().toISOString()
    });
    salvarArquivo(ARQUIVO_LEADS, leads);
    res.json({ status: "ok" });
});

// Registrar Venda
app.post('/registrar-venda', (req, res) => {
    const vendas = lerArquivo(ARQUIVO_FINANCEIRO);
    vendas.push({
        ...req.body,
        data: new Date().toLocaleString('pt-BR'),
        dataISO: new Date().toISOString()
    });
    salvarArquivo(ARQUIVO_FINANCEIRO, vendas);
    
    notificarTelegram(`💰 *NOVA VENDA!*\nItem: ${req.body.plano}\nValor: *R$ ${parseFloat(req.body.valor).toFixed(2)}*`);
    
    res.json({ status: "ok" });
});

// Comprar Dica
app.post('/comprar-dica', (req, res) => {
    const { nivel, valor, plano } = req.body;
    const vendas = lerArquivo(ARQUIVO_FINANCEIRO);
    vendas.push({
        plano: plano,
        valor: parseFloat(valor),
        data: new Date().toLocaleString('pt-BR'),
        dataISO: new Date().toISOString()
    });
    salvarArquivo(ARQUIVO_FINANCEIRO, vendas);
    
    notificarTelegram(`🕵️ *DICA VENDIDA (Nível ${nivel})*\nValor: R$ ${parseFloat(valor).toFixed(2)}`);

    const senhaReal = configCofre.senhaCorreta;
    let revelacao = "";
    if (nivel == 1) revelacao = senhaReal[0] + " _ _ _";
    if (nivel == 2) revelacao = senhaReal[0] + " " + senhaReal[1] + " _ _";
    if (nivel == 3) revelacao = senhaReal[0] + " " + senhaReal[1] + " " + senhaReal[2] + " _";

    res.json({ sucesso: true, dica: revelacao });
});

// Tentar Senha
app.post('/tentar', (req, res) => {
    const { senha } = req.body;
    const tentativas = lerArquivo(ARQUIVO_TENTATIVAS);
    
    if (senha === configCofre.senhaCorreta) {
        // Vitória
        const tokenVitoria = "WIN-" + crypto.randomBytes(3).toString('hex').toUpperCase();

        tentativas.push({
            id: crypto.randomUUID(),
            ganhou: true,
            data: new Date().toLocaleString('pt-BR'),
            dataISO: new Date().toISOString()
        });
        salvarArquivo(ARQUIVO_TENTATIVAS, tentativas);
        
        notificarTelegram(`🚨🚨 *O COFRE FOI ABERTO!* 🚨🚨\nSenha: ${senha}\nToken: ${tokenVitoria}\nAguardando solicitação de saque.`);
        
        res.json({
            ganhou: true,
            premio: configCofre.premioAtual,
            token: tokenVitoria
        });
    } else {
        // Derrota (Aumenta prêmio)
        tentativas.push({
            id: crypto.randomUUID(),
            ganhou: false,
            data: new Date().toLocaleString('pt-BR'),
            dataISO: new Date().toISOString()
        });
        salvarArquivo(ARQUIVO_TENTATIVAS, tentativas);

        configCofre.premioAtual += 0.50; 
        salvarArquivo(ARQUIVO_CONFIG, configCofre);
        res.json({
            ganhou: false,
            novoPremio: configCofre.premioAtual
        });
    }
});

// Solicitar Saque
app.post('/solicitar-saque', (req, res) => {
    const { token, pix, nome, cpf, valor } = req.body;
    const solicitacoes = lerArquivo(ARQUIVO_SOLICITACOES);
    
    solicitacoes.push({
        id: crypto.randomUUID(),
        token: token,
        nome: nome,
        cpf: cpf,
        pix: pix,
        valor: parseFloat(valor),
        status: "PENDENTE",
        data: new Date().toLocaleString('pt-BR'),
        dataISO: new Date().toISOString()
    });
    
    salvarArquivo(ARQUIVO_SOLICITACOES, solicitacoes);
    notificarTelegram(`💸 *SOLICITAÇÃO DE SAQUE*\nNome: ${nome}\nValor: R$ ${valor}\nPix: ${pix}`);
    
    res.json({ sucesso: true });
});

// Registrar vencedor (para aparecer nos últimos ganhadores)
app.post('/registrar-ganhador', (req, res) => {
    const { nome, valor, token } = req.body;
    if (!nome || !valor || !token) {
        return res.status(400).json({ sucesso: false });
    }
    const ganhadores = lerArquivo(ARQUIVO_GANHADORES);
    ganhadores.push({
        id: crypto.randomUUID(),
        nome: nome,
        valor: parseFloat(valor),
        token: token,
        data: new Date().toLocaleString('pt-BR'),
        dataISO: new Date().toISOString()
    });
    salvarArquivo(ARQUIVO_GANHADORES, ganhadores);
    res.json({ sucesso: true });
});

// Status público (prêmio e últimos ganhadores)
app.get('/status', (req, res) => {
    const configAtual = obterConfigCofreAtual();
    res.json({
        premioAtual: configAtual.premioAtual,
        ultimosGanhadores: obterUltimosGanhadores(),
        topVencedoresDia: obterTopVencedoresDia()
    });
});

// ===================================================
// 🔐 ÁREA ADMINISTRATIVA
// ===================================================

// Rota Login Admin
app.get('/admin', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html class="bg-slate-900">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script src="https://cdn.tailwindcss.com"></script>
        <title>Login Admin</title>
    </head>
    <body class="flex items-center justify-center h-screen">
        <form action="/admin-dashboard" method="POST" class="bg-slate-800 p-8 rounded-xl shadow-2xl border border-slate-700 w-full max-w-xs">
            <h1 class="text-2xl font-bold text-yellow-500 mb-6 text-center">OPENPIX ADMIN</h1>
            <input type="password" name="senha" placeholder="Senha Master" class="w-full p-3 rounded bg-slate-900 text-white border border-slate-600 mb-4 outline-none focus:border-yellow-500">
            <button type="submit" class="w-full bg-yellow-600 hover:bg-yellow-500 text-black font-bold py-3 rounded transition">ACESSAR PAINEL</button>
        </form>
    </body>
    </html>
    `);
});

// Rota Pagar Solicitacao
app.post('/admin-pagar', (req, res) => {
    const { id } = req.body;
    const solicitacoes = lerArquivo(ARQUIVO_SOLICITACOES);
    
    const index = solicitacoes.findIndex(s => s.id === id);
    if (index !== -1) {
        solicitacoes[index].status = "PAGO";
        salvarArquivo(ARQUIVO_SOLICITACOES, solicitacoes);
        
        // Zera o cofre
        configCofre.premioAtual = 100.00; 
        salvarArquivo(ARQUIVO_CONFIG, configCofre);
        
        res.json({ sucesso: true });
    } else {
        res.json({ sucesso: false });
    }
});

// Rota Mudar Senha
app.post('/admin-mudar-senha', (req, res) => {
    const { senha_admin, nova_senha_cofre } = req.body;
    
    if (senha_admin === SENHA_ADMIN) {
        configCofre.senhaCorreta = nova_senha_cofre;
        salvarArquivo(ARQUIVO_CONFIG, configCofre);
        
        notificarTelegram(`🔐 *SENHA DO COFRE ALTERADA*\nNova senha: ${nova_senha_cofre}`);
        
        // Redireciona via JS para manter o POST
        res.send(`
            <form action="/admin-dashboard" method="POST" id="formRedirect">
                <input type="hidden" name="senha" value="${SENHA_ADMIN}">
            </form>
            <script>document.getElementById("formRedirect").submit();</script>
        `);
    } else {
        res.send("Erro: Senha admin incorreta.");
    }
});

// Rota Dashboard
app.post('/admin-dashboard', (req, res) => {
    const { senha } = req.body;
    
    if (senha !== SENHA_ADMIN) {
        return res.send("<h1>Acesso Negado</h1><a href='/admin'>Voltar</a>");
    }
    
    // Carrega dados
    const leads = lerArquivo(ARQUIVO_LEADS);
    const vendas = lerArquivo(ARQUIVO_FINANCEIRO);
    const solicitacoes = lerArquivo(ARQUIVO_SOLICITACOES);
    const tentativas = lerArquivo(ARQUIVO_TENTATIVAS);
    const totalFaturado = vendas.reduce((acc, v) => acc + (parseFloat(v.valor) || 0), 0);
    const serieReceita = gerarSerieDiaria(vendas, v => parseFloat(v.valor) || 0);
    const serieLeads = gerarSerieDiaria(leads, () => 1);
    const serieTentativas = gerarSerieDiaria(tentativas, () => 1);

    // HTML DO DASHBOARD (TOTALMENTE EXPANDIDO)
    res.send(`
    <!DOCTYPE html>
    <html lang="pt-br">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Painel Admin - OpenPix</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" />
        <style>
            .custom-scrollbar::-webkit-scrollbar { width: 6px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: #0f172a; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
        </style>
    </head>
    <body class="bg-slate-950 text-white min-h-screen p-6 font-sans">
        <div class="max-w-6xl mx-auto">
            
            <header class="flex justify-between items-center mb-10 border-b border-slate-800 pb-6">
                <h1 class="text-3xl font-black text-yellow-500">
                    OPEN<span class="text-white">PIX</span> 
                    <span class="text-sm font-normal text-slate-500 ml-2">ADMIN V3.0</span>
                </h1>
                <div class="text-right">
                    <p class="text-xs text-slate-500 uppercase tracking-widest">Prêmio Atual no Cofre</p>
                    <p class="text-2xl font-mono font-bold text-green-400">R$ ${configCofre.premioAtual.toFixed(2)}</p>
                </div>
            </header>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                
                <div class="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
                    <div class="flex items-center gap-3 mb-2">
                        <div class="bg-green-500/20 p-2 rounded-lg">
                            <i class="fas fa-wallet text-green-500"></i>
                        </div>
                        <p class="text-slate-500 text-xs font-bold uppercase">Faturamento Total</p>
                    </div>
                    <p class="text-4xl font-black text-green-500">R$ ${totalFaturado.toFixed(2)}</p>
                </div>

                <div class="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
                    <div class="flex items-center gap-3 mb-2">
                        <div class="bg-blue-500/20 p-2 rounded-lg">
                            <i class="fas fa-users text-blue-500"></i>
                        </div>
                        <p class="text-slate-500 text-xs font-bold uppercase">Leads Cadastrados</p>
                    </div>
                    <p class="text-4xl font-black text-blue-500">${leads.length}</p>
                </div>

                <div class="bg-slate-900 p-6 rounded-2xl border border-yellow-500/30 shadow-xl">
                    <div class="flex items-center gap-3 mb-2">
                        <div class="bg-yellow-500/20 p-2 rounded-lg">
                            <i class="fas fa-key text-yellow-500"></i>
                        </div>
                        <p class="text-slate-500 text-xs font-bold uppercase">Senha do Cofre</p>
                    </div>
                    <form action="/admin-mudar-senha" method="POST" class="flex gap-2 mt-4">
                        <input type="hidden" name="senha_admin" value="${senha}">
                        <input type="text" name="nova_senha_cofre" maxlength="4" value="${configCofre.senhaCorreta}" class="bg-black border border-slate-700 rounded p-2 w-full text-center text-xl font-mono text-yellow-500 outline-none focus:border-yellow-500">
                        <button class="bg-yellow-600 hover:bg-yellow-500 text-black px-4 rounded text-xs font-bold transition">SALVAR</button>
                    </form>
                </div>
            </div>

            <div class="bg-slate-900 rounded-xl border border-yellow-500/50 overflow-hidden mb-8 shadow-2xl shadow-yellow-500/10">
                <div class="p-4 bg-yellow-900/20 border-b border-yellow-500/20 font-bold text-sm uppercase tracking-widest text-yellow-500 flex items-center gap-2">
                    <i class="fas fa-hand-holding-usd"></i> Solicitações de Prêmios (Saques)
                </div>
                <div class="p-4 space-y-3">
                    ${solicitacoes.length === 0 ? '<p class="text-slate-500 text-sm text-center py-4">Nenhuma solicitação pendente.</p>' : ''}
                    
                    ${solicitacoes.reverse().map(s => `
                        <div class="flex flex-col md:flex-row justify-between items-center bg-black/40 p-4 rounded-lg border ${s.status === 'PAGO' ? 'border-green-900 opacity-70' : 'border-yellow-600'}">
                            <div class="mb-2 md:mb-0">
                                <p class="font-bold text-white text-lg">${s.nome}</p>
                                <p class="text-xs text-slate-400">CPF: ${s.cpf} | Data: ${s.data}</p>
                                <div class="bg-black/50 p-2 rounded mt-2 border border-slate-700 inline-block">
                                    <p class="text-[10px] text-slate-500 uppercase">Chave Pix</p>
                                    <p class="text-sm font-mono text-yellow-400 select-all">${s.pix}</p>
                                </div>
                                <p class="text-[10px] text-slate-600 mt-1">TOKEN: ${s.token}</p>
                            </div>
                            <div class="text-right flex flex-col items-end gap-2">
                                <p class="text-2xl font-black text-white">R$ ${s.valor.toFixed(2)}</p>
                                ${s.status === 'PENDENTE' ? `
                                    <button onclick="pagar('${s.id}')" class="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded-lg text-xs font-bold transition shadow-lg shadow-green-600/20 flex items-center gap-2">
                                        <i class="fas fa-check"></i> MARCAR COMO PAGO
                                    </button>
                                ` : `
                                    <span class="bg-green-900/50 text-green-400 px-3 py-1 rounded text-xs font-bold border border-green-700 flex items-center gap-1">
                                        <i class="fas fa-check-circle"></i> PAGO
                                    </span>
                                `}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="bg-slate-900 rounded-xl border border-slate-800 mb-10 p-6">
                <div class="flex items-center justify-between mb-4">
                    <h2 class="text-sm uppercase tracking-widest text-slate-400 font-bold">Métricas Visuais</h2>
                    <span class="text-xs text-slate-500">Últimos 7 dias</span>
                </div>
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div class="bg-slate-950 p-4 rounded-xl border border-slate-800">
                        <p class="text-xs text-slate-500 font-bold uppercase mb-2">Receita diária</p>
                        <canvas id="chartReceita" height="160"></canvas>
                    </div>
                    <div class="bg-slate-950 p-4 rounded-xl border border-slate-800">
                        <p class="text-xs text-slate-500 font-bold uppercase mb-2">Leads diários</p>
                        <canvas id="chartLeads" height="160"></canvas>
                    </div>
                    <div class="bg-slate-950 p-4 rounded-xl border border-slate-800">
                        <p class="text-xs text-slate-500 font-bold uppercase mb-2">Tentativas diárias</p>
                        <canvas id="chartTentativas" height="160"></canvas>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                <div class="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden h-[400px] flex flex-col">
                    <div class="p-4 bg-slate-800 font-bold text-xs uppercase tracking-widest text-slate-400 flex justify-between items-center">
                        <span>Últimos Leads</span>
                        <i class="fas fa-user-plus"></i>
                    </div>
                    <div class="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                        ${leads.reverse().map(l => `
                            <div class="flex justify-between items-center border-b border-slate-800 pb-2 hover:bg-slate-800/50 p-2 rounded transition">
                                <div>
                                    <p class="font-bold text-sm text-slate-200">${l.nome}</p>
                                    <p class="text-[10px] text-slate-500">${l.data}</p>
                                </div>
                                <a href="https://wa.me/${l.tel.replace(/\D/g,'')}" target="_blank" class="text-green-500 text-xs font-mono hover:underline flex items-center gap-1">
                                    <i class="fab fa-whatsapp"></i> ${l.tel}
                                </a>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden h-[400px] flex flex-col">
                    <div class="p-4 bg-slate-800 font-bold text-xs uppercase tracking-widest text-slate-400 flex justify-between items-center">
                        <span>Fluxo de Caixa</span>
                        <i class="fas fa-chart-line"></i>
                    </div>
                    <div class="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                        ${vendas.reverse().map(v => `
                            <div class="flex justify-between items-center border-b border-slate-800 pb-2 hover:bg-slate-800/50 p-2 rounded transition">
                                <div>
                                    <p class="font-bold text-sm text-slate-300">${v.plano}</p>
                                    <p class="text-[10px] text-slate-600">${v.data}</p>
                                </div>
                                <p class="text-green-400 font-bold font-mono">+ R$ ${parseFloat(v.valor).toFixed(2)}</p>
                            </div>
                        `).join('')}
                    </div>
                </div>

            </div>
        </div>

        <script>
            const labels = ${JSON.stringify(serieReceita.labels)};
            const serieReceita = ${JSON.stringify(serieReceita.valores)};
            const serieLeads = ${JSON.stringify(serieLeads.valores)};
            const serieTentativas = ${JSON.stringify(serieTentativas.valores)};

            function criarGrafico(id, dados, cor, titulo) {
                const ctx = document.getElementById(id);
                if (!ctx) return;
                new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels,
                        datasets: [{
                            label: titulo,
                            data: dados,
                            borderColor: cor,
                            backgroundColor: 'rgba(255,255,255,0.04)',
                            fill: true,
                            tension: 0.4,
                            pointRadius: 3
                        }]
                    },
                    options: {
                        plugins: {
                            legend: { display: false }
                        },
                        scales: {
                            x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.1)' } },
                            y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.1)' } }
                        }
                    }
                });
            }

            criarGrafico('chartReceita', serieReceita, '#22c55e', 'Receita');
            criarGrafico('chartLeads', serieLeads, '#38bdf8', 'Leads');
            criarGrafico('chartTentativas', serieTentativas, '#facc15', 'Tentativas');

            async function pagar(id) {
                if(confirm('Tem certeza que já realizou o PIX para o ganhador? Isso irá marcar a solicitação como PAGA e resetar o cofre.')) {
                    await fetch('/admin-pagar', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ id })
                    });
                    location.reload();
                }
            }
        </script>
    </body>
    </html>
    `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor OpenPix Rodando na porta ${PORT}`));
