const express = require('express');
const app = express();
const fs = require('fs');
const path = require('path');
const https = require('https'); // Para falar com o Telegram

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// --- 🤖 CONFIGURAÇÕES DE SEGURANÇA E TELEGRAM ---

// 1. DADOS DO SEU BOT (Crie no @BotFather)
const TELEGRAM_BOT_TOKEN = "SEU_TOKEN_AQUI"; 
const TELEGRAM_CHAT_ID = "SEU_CHAT_ID_AQUI"; 

// 2. CONFIGURAÇÃO ANTI-ROBÔ (RATE LIMIT)
const RATE_LIMIT_WINDOW = 60000; // 1 minuto
const MAX_ATTEMPTS_PER_WINDOW = 10; // Máximo de 10 tentativas por minuto por IP
const ipRequestCounts = {}; // Armazena tentativas na memória

// --- ARQUIVOS DE DADOS ---
const SENHA_ADMIN = "admin123"; 
const ARQUIVO_LEADS = 'leads.json';
const ARQUIVO_FINANCEIRO = 'financeiro.json';
const ARQUIVO_CONFIG = 'config.json';

// Inicialização
let configCofre = { premioAtual: 500.30, senhaCorreta: "1234" };
if (fs.existsSync(ARQUIVO_CONFIG)) configCofre = JSON.parse(fs.readFileSync(ARQUIVO_CONFIG));
else fs.writeFileSync(ARQUIVO_CONFIG, JSON.stringify(configCofre, null, 2));

// --- FUNÇÕES AUXILIARES ---

function lerArquivo(arquivo) {
    if (fs.existsSync(arquivo)) {
        try { return JSON.parse(fs.readFileSync(arquivo)); } catch (e) { return []; }
    }
    return [];
}

function salvarArquivo(arquivo, dados) {
    fs.writeFileSync(arquivo, JSON.stringify(dados, null, 2));
}

// 📲 ENVIA MENSAGEM PARA O SEU TELEGRAM
function notificarTelegram(mensagem) {
    if (TELEGRAM_BOT_TOKEN === "SEU_TOKEN_AQUI") return; // Não envia se não configurou

    const data = JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: mensagem, parse_mode: 'Markdown' });
    const options = {
        hostname: 'api.telegram.org',
        port: 443,
        path: `/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
    };

    const req = https.request(options, res => {
        res.on('data', () => {}); // Apenas consome a resposta para não travar
    });
    req.on('error', error => console.error('Erro no Telegram:', error));
    req.write(data);
    req.end();
}

// 🛡️ MIDDLEWARE ANTI-ROBÔ
function checkRateLimit(req, res, next) {
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const now = Date.now();

    if (!ipRequestCounts[ip]) {
        ipRequestCounts[ip] = { count: 1, startTime: now };
    } else {
        const timePassed = now - ipRequestCounts[ip].startTime;
        if (timePassed < RATE_LIMIT_WINDOW) {
            ipRequestCounts[ip].count++;
            if (ipRequestCounts[ip].count > MAX_ATTEMPTS_PER_WINDOW) {
                console.log(`🚨 IP BLOQUEADO POR SPAM: ${ip}`);
                return res.status(429).json({ 
                    ganhou: false, 
                    erro: "Muitas tentativas. Aguarde 1 minuto.", 
                    novoPremio: configCofre.premioAtual 
                });
            }
        } else {
            // Reseta a contagem após o tempo passar
            ipRequestCounts[ip] = { count: 1, startTime: now };
        }
    }
    next();
}

// --- ROTAS DO JOGO ---

app.post('/salvar-lead', (req, res) => {
    const leads = lerArquivo(ARQUIVO_LEADS);
    leads.push({ ...req.body, data: new Date().toLocaleString('pt-BR') });
    salvarArquivo(ARQUIVO_LEADS, leads);
    
    // Notifica lead novo (opcional, pode comentar se for muito spam)
    // notificarTelegram(`👤 *NOVO LEAD CADASTRADO:*\nNome: ${req.body.nome}\nTel: ${req.body.tel}`);
    
    res.json({ status: "ok" });
});

app.post('/registrar-venda', (req, res) => {
    const vendas = lerArquivo(ARQUIVO_FINANCEIRO);
    vendas.push({ ...req.body, data: new Date().toLocaleString('pt-BR') });
    salvarArquivo(ARQUIVO_FINANCEIRO, vendas);

    // 💰 NOTIFICAÇÃO DE DINHEIRO NO BOLSO
    notificarTelegram(`💰 *VENDA REALIZADA!*\nItem: ${req.body.plano}\nValor: *R$ ${parseFloat(req.body.valor).toFixed(2)}*\nData: ${new Date().toLocaleString('pt-BR')}`);

    res.json({ status: "ok" });
});

// Rota protegida pelo Anti-Robô
app.post('/tentar', checkRateLimit, (req, res) => {
    const { senha } = req.body;
    
    if (senha === configCofre.senhaCorreta) {
        // 🚨 ALERTA MÁXIMO: ALGUÉM GANHOU
        notificarTelegram(`🚨🚨 *O COFRE FOI ABERTO!* 🚨🚨\nSenha usada: ${senha}\nPrêmio a pagar: R$ ${configCofre.premioAtual.toFixed(2)}`);
        
        res.json({ ganhou: true, premio: configCofre.premioAtual });
    } else {
        configCofre.premioAtual += 0.50; 
        salvarArquivo(ARQUIVO_CONFIG, configCofre);
        res.json({ ganhou: false, novoPremio: configCofre.premioAtual });
    }
});

app.post('/comprar-dica', (req, res) => {
    const { nivel, valor, plano } = req.body;
    
    const vendas = lerArquivo(ARQUIVO_FINANCEIRO);
    vendas.push({ plano: plano, valor: parseFloat(valor), data: new Date().toLocaleString('pt-BR') });
    salvarArquivo(ARQUIVO_FINANCEIRO, vendas);

    // 💰 NOTIFICAÇÃO DE VENDA DE DICA
    notificarTelegram(`🕵️ *DICA VENDIDA (Nível ${nivel})*\nValor: *R$ ${parseFloat(valor).toFixed(2)}*`);

    const senhaReal = configCofre.senhaCorreta;
    let revelacao = "";

    if (nivel == 1) revelacao = senhaReal[0] + " _ _ _";
    if (nivel == 2) revelacao = senhaReal[0] + " " + senhaReal[1] + " _ _";
    if (nivel == 3) revelacao = senhaReal[0] + " " + senhaReal[1] + " " + senhaReal[2] + " _";

    res.json({ sucesso: true, dica: revelacao });
});

// --- ÁREA ADMINISTRATIVA (MANTIDA IGUAL) ---
app.get('/admin', (req, res) => {
    res.send(`<!DOCTYPE html><html class="bg-slate-900"><head><meta charset="UTF-8"><script src="https://cdn.tailwindcss.com"></script></head><body class="flex items-center justify-center h-screen"><form action="/admin-dashboard" method="POST" class="bg-slate-800 p-8 rounded-xl shadow-2xl border border-slate-700 w-full max-w-xs"><h1 class="text-2xl font-bold text-yellow-500 mb-6 text-center">OPENPIX ADMIN</h1><input type="password" name="senha" placeholder="Senha Master" class="w-full p-3 rounded bg-slate-900 text-white border border-slate-600 mb-4 outline-none focus:border-yellow-500"><button type="submit" class="w-full bg-yellow-600 hover:bg-yellow-500 text-black font-bold py-3 rounded transition">ACESSAR PAINEL</button></form></body></html>`);
});

app.post('/admin-mudar-senha', (req, res) => {
    const { senha_admin, nova_senha_cofre } = req.body;
    if (senha_admin === SENHA_ADMIN) {
        configCofre.senhaCorreta = nova_senha_cofre;
        salvarArquivo(ARQUIVO_CONFIG, configCofre);
        notificarTelegram(`🔐 *SENHA DO COFRE ALTERADA*\nNova senha: ${nova_senha_cofre}`);
        res.redirect(307, '/admin-dashboard');
    } else {
        res.send("Acesso negado.");
    }
});

app.post('/admin-dashboard', (req, res) => {
    const { senha } = req.body;
    if (senha !== SENHA_ADMIN) return res.send("Senha incorreta.");
    const leads = lerArquivo(ARQUIVO_LEADS);
    const vendas = lerArquivo(ARQUIVO_FINANCEIRO);
    const totalFaturado = vendas.reduce((acc, v) => acc + (parseFloat(v.valor) || 0), 0);
    res.send(`<!DOCTYPE html><html lang="pt-br"><head><meta charset="UTF-8"><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-slate-950 text-white min-h-screen p-6 font-sans"><div class="max-w-6xl mx-auto"><header class="flex justify-between items-center mb-10 border-b border-slate-800 pb-6"><h1 class="text-3xl font-black text-yellow-500">OPEN<span class="text-white">PIX</span> <span class="text-xs text-slate-500 block">PAINEL DE CONTROLE v2.1 (BLINDADO)</span></h1><div class="text-right"><p class="text-xs text-slate-500">Prêmio no Cofre</p><p class="text-xl font-mono font-bold text-green-400">R$ ${configCofre.premioAtual.toFixed(2)}</p></div></header><div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10"><div class="bg-slate-900 p-6 rounded-2xl border border-slate-800"><p class="text-slate-500 text-xs font-bold uppercase mb-2">Faturamento Total</p><p class="text-4xl font-black text-green-500">R$ ${totalFaturado.toFixed(2)}</p></div><div class="bg-slate-900 p-6 rounded-2xl border border-slate-800"><p class="text-slate-500 text-xs font-bold uppercase mb-2">Leads Capturados</p><p class="text-4xl font-black text-blue-500">${leads.length}</p></div><div class="bg-slate-900 p-6 rounded-2xl border border-yellow-500/30"><p class="text-slate-500 text-xs font-bold uppercase mb-1">Senha do Cofre</p><form action="/admin-mudar-senha" method="POST" class="flex gap-2"><input type="hidden" name="senha_admin" value="${senha}"><input type="text" name="nova_senha_cofre" maxlength="4" value="${configCofre.senhaCorreta}" class="bg-black border border-slate-700 rounded p-1 w-20 text-center text-xl font-mono text-yellow-500"><button class="bg-yellow-600 text-black px-3 rounded text-xs font-bold">ALTERAR</button></form></div></div><div class="grid grid-cols-1 lg:grid-cols-2 gap-8"><div class="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden"><div class="p-4 bg-slate-800 font-bold text-xs uppercase tracking-widest text-slate-400">Últimos Leads</div><div class="max-h-80 overflow-y-auto p-4 space-y-3">${leads.reverse().map(l => `<div class="flex justify-between items-center border-b border-slate-800 pb-2"><div><p class="font-bold text-sm">${l.nome}</p><p class="text-xs text-slate-500">${l.data}</p></div><a href="https://wa.me/${l.tel.replace(/\D/g,'')}" target="_blank" class="text-green-500 text-xs font-mono">${l.tel}</a></div>`).join('') || 'Nenhum lead.'}</div></div><div class="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden"><div class="p-4 bg-slate-800 font-bold text-xs uppercase tracking-widest text-slate-400">Fluxo de Caixa</div><div class="max-h-80 overflow-y-auto p-4 space-y-3">${vendas.reverse().map(v => `<div class="flex justify-between items-center border-b border-slate-800 pb-2"><div><p class="font-bold text-sm text-slate-300">${v.plano}</p><p class="text-[10px] text-slate-600">${v.data}</p></div><p class="text-green-400 font-bold">R$ ${parseFloat(v.valor).toFixed(2)}</p></div>`).join('') || 'Sem vendas.'}</div></div></div></div></body></html>`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor OpenPix Blindado Online na porta ${PORT}`));
