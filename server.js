const express = require('express');
const app = express();
const fs = require('fs');
const path = require('path');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// --- CONFIGURAÇÕES DO SISTEMA ---
const SENHA_ADMIN = "admin123"; 
const ARQUIVO_LEADS = 'leads.json';
const ARQUIVO_FINANCEIRO = 'financeiro.json';
const ARQUIVO_CONFIG = 'config.json';

// Inicialização das configurações (Senha e Prêmio)
let configCofre = {
    premioAtual: 500.30,
    senhaCorreta: "1234"
};

if (fs.existsSync(ARQUIVO_CONFIG)) {
    configCofre = JSON.parse(fs.readFileSync(ARQUIVO_CONFIG));
} else {
    fs.writeFileSync(ARQUIVO_CONFIG, JSON.stringify(configCofre, null, 2));
}

// --- FUNÇÕES DE BANCO DE DADOS (JSON) ---
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

// --- ROTAS DO JOGO ---

// Salvar Cadastro de Lead
app.post('/salvar-lead', (req, res) => {
    const leads = lerArquivo(ARQUIVO_LEADS);
    leads.push({
        ...req.body,
        data: new Date().toLocaleString('pt-BR')
    });
    salvarArquivo(ARQUIVO_LEADS, leads);
    res.json({ status: "ok" });
});

// Registrar Venda de Planos ou Dicas
app.post('/registrar-venda', (req, res) => {
    const vendas = lerArquivo(ARQUIVO_FINANCEIRO);
    vendas.push({
        ...req.body,
        data: new Date().toLocaleString('pt-BR')
    });
    salvarArquivo(ARQUIVO_FINANCEIRO, vendas);
    res.json({ status: "ok" });
});

// Processar tentativa de abertura
app.post('/tentar', (req, res) => {
    const { senha } = req.body;
    
    if (senha === configCofre.senhaCorreta) {
        res.json({ ganhou: true, premio: configCofre.premioAtual });
    } else {
        configCofre.premioAtual += 0.50; // Aumenta o prêmio a cada erro
        salvarArquivo(ARQUIVO_CONFIG, configCofre);
        res.json({ ganhou: false, novoPremio: configCofre.premioAtual });
    }
});

// Entrega de Dicas (Pistas)
app.post('/comprar-dica', (req, res) => {
    const { nivel, valor, plano } = req.body;
    
    const vendas = lerArquivo(ARQUIVO_FINANCEIRO);
    vendas.push({
        plano: plano,
        valor: parseFloat(valor),
        data: new Date().toLocaleString('pt-BR')
    });
    salvarArquivo(ARQUIVO_FINANCEIRO, vendas);

    const senhaReal = configCofre.senhaCorreta;
    let revelacao = "";

    if (nivel == 1) revelacao = senhaReal[0] + " _ _ _";
    if (nivel == 2) revelacao = senhaReal[0] + " " + senhaReal[1] + " _ _";
    if (nivel == 3) revelacao = senhaReal[0] + " " + senhaReal[1] + " " + senhaReal[2] + " _";
    if (nivel == 4) revelacao = senhaReal;

    res.json({ sucesso: true, dica: revelacao });
});

// --- ÁREA ADMINISTRATIVA ---

// Login Admin
app.get('/admin', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html class="bg-slate-900">
        <head><meta charset="UTF-8"><script src="https://cdn.tailwindcss.com"></script></head>
        <body class="flex items-center justify-center h-screen">
            <form action="/admin-dashboard" method="POST" class="bg-slate-800 p-8 rounded-xl shadow-2xl border border-slate-700 w-full max-w-xs">
                <h1 class="text-2xl font-bold text-yellow-500 mb-6 text-center text-yellow-500">DESTRAVA ADMIN</h1>
                <input type="password" name="senha" placeholder="Senha Master" class="w-full p-3 rounded bg-slate-900 text-white border border-slate-600 mb-4 outline-none focus:border-yellow-500">
                <button type="submit" class="w-full bg-yellow-600 hover:bg-yellow-500 text-black font-bold py-3 rounded transition">ACESSAR PAINEL</button>
            </form>
        </body>
        </html>
    `);
});

// Mudar Senha do Cofre
app.post('/admin-mudar-senha', (req, res) => {
    const { senha_admin, nova_senha_cofre } = req.body;
    if (senha_admin === SENHA_ADMIN) {
        configCofre.senhaCorreta = nova_senha_cofre;
        salvarArquivo(ARQUIVO_CONFIG, configCofre);
        res.redirect(307, '/admin-dashboard');
    } else {
        res.send("Acesso negado.");
    }
});

// Dashboard Principal
app.post('/admin-dashboard', (req, res) => {
    const { senha } = req.body;
    if (senha !== SENHA_ADMIN) return res.send("Senha incorreta.");

    const leads = lerArquivo(ARQUIVO_LEADS);
    const vendas = lerArquivo(ARQUIVO_FINANCEIRO);
    const totalFaturado = vendas.reduce((acc, v) => acc + (parseFloat(v.valor) || 0), 0);

    res.send(`
    <!DOCTYPE html>
    <html lang="pt-br">
    <head><meta charset="UTF-8"><script src="https://cdn.tailwindcss.com"></script></head>
    <body class="bg-slate-950 text-white min-h-screen p-6 font-sans">
        <div class="max-w-6xl mx-auto">
            <header class="flex justify-between items-center mb-10 border-b border-slate-800 pb-6">
                <h1 class="text-3xl font-black text-yellow-500">DESTRAVA<span class="text-white">CELL</span> <span class="text-xs text-slate-500 block">PAINEL DE CONTROLE v2.0</span></h1>
                <div class="text-right">
                    <p class="text-xs text-slate-500">Prêmio no Cofre</p>
                    <p class="text-xl font-mono font-bold text-green-400">R$ ${configCofre.premioAtual.toFixed(2)}</p>
                </div>
            </header>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div class="bg-slate-900 p-6 rounded-2xl border border-slate-800">
                    <p class="text-slate-500 text-xs font-bold uppercase mb-2">Faturamento Total</p>
                    <p class="text-4xl font-black text-green-500">R$ ${totalFaturado.toFixed(2)}</p>
                </div>
                <div class="bg-slate-900 p-6 rounded-2xl border border-slate-800">
                    <p class="text-slate-500 text-xs font-bold uppercase mb-2">Leads Capturados</p>
                    <p class="text-4xl font-black text-blue-500">${leads.length}</p>
                </div>
                <div class="bg-slate-900 p-6 rounded-2xl border border-yellow-500/30">
                    <p class="text-slate-500 text-xs font-bold uppercase mb-1">Senha do Cofre</p>
                    <form action="/admin-mudar-senha" method="POST" class="flex gap-2">
                        <input type="hidden" name="senha_admin" value="${senha}">
                        <input type="text" name="nova_senha_cofre" maxlength="4" value="${configCofre.senhaCorreta}" class="bg-black border border-slate-700 rounded p-1 w-20 text-center text-xl font-mono text-yellow-500">
                        <button class="bg-yellow-600 text-black px-3 rounded text-xs font-bold">ALTERAR</button>
                    </form>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div class="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                    <div class="p-4 bg-slate-800 font-bold text-xs uppercase tracking-widest text-slate-400">Últimos Leads</div>
                    <div class="max-h-80 overflow-y-auto p-4 space-y-3">
                        ${leads.reverse().map(l => `
                            <div class="flex justify-between items-center border-b border-slate-800 pb-2">
                                <div><p class="font-bold text-sm">${l.nome}</p><p class="text-xs text-slate-500">${l.data}</p></div>
                                <a href="https://wa.me/${l.tel.replace(/\\D/g,'')}" target="_blank" class="text-green-500 text-xs font-mono">${l.tel}</a>
                            </div>
                        `).join('') || 'Nenhum lead.'}
                    </div>
                </div>
                <div class="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                    <div class="p-4 bg-slate-800 font-bold text-xs uppercase tracking-widest text-slate-400">Fluxo de Caixa</div>
                    <div class="max-h-80 overflow-y-auto p-4 space-y-3">
                        ${vendas.reverse().map(v => `
                            <div class="flex justify-between items-center border-b border-slate-800 pb-2">
                                <div><p class="font-bold text-sm text-slate-300">${v.plano}</p><p class="text-[10px] text-slate-600">${v.data}</p></div>
                                <p class="text-green-400 font-bold">R$ ${parseFloat(v.valor).toFixed(2)}</p>
                            </div>
                        `).join('') || 'Sem vendas.'}
                    </div>
                </div>
            </div>
        </div>
    </body>
    </html>
    `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor DestravaCell Online na porta ${PORT}`));
