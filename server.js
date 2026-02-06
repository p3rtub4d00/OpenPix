const express = require('express');
const app = express();
const fs = require('fs');
const path = require('path');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// --- CONFIGURAÇÕES E BANCO DE DADOS ---
const SENHA_ADMIN = "admin123"; 
const ARQUIVO_LEADS = 'leads.json';
const ARQUIVO_FINANCEIRO = 'financeiro.json';
const ARQUIVO_CONFIG = 'config.json'; // Onde salvaremos a senha do cofre

// Inicializa a configuração se não existir
let configCofre = {
    premioAtual: 500.30,
    senhaCorreta: "1234" // Senha padrão inicial
};

if (fs.existsSync(ARQUIVO_CONFIG)) {
    configCofre = JSON.parse(fs.readFileSync(ARQUIVO_CONFIG));
} else {
    fs.writeFileSync(ARQUIVO_CONFIG, JSON.stringify(configCofre, null, 2));
}

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

// --- ROTAS DO JOGO ---

app.post('/salvar-lead', (req, res) => {
    const leads = lerArquivo(ARQUIVO_LEADS);
    leads.push({ ...req.body, data: new Date().toLocaleString('pt-BR') });
    salvarArquivo(ARQUIVO_LEADS, leads);
    res.json({ status: "ok" });
});

app.post('/registrar-venda', (req, res) => {
    const vendas = lerArquivo(ARQUIVO_FINANCEIRO);
    vendas.push({ ...req.body, data: new Date().toLocaleString('pt-BR') });
    salvarArquivo(ARQUIVO_FINANCEIRO, vendas);
    res.json({ status: "ok" });
});

app.post('/tentar', (req, res) => {
    const { senha } = req.body;
    
    if (senha === configCofre.senhaCorreta) {
        res.json({ ganhou: true, premio: configCofre.premioAtual });
    } else {
        configCofre.premioAtual += 0.50; 
        salvarArquivo(ARQUIVO_CONFIG, configCofre); // Salva o novo prêmio acumulado
        res.json({ ganhou: false, msg: "Incorreta", novoPremio: configCofre.premioAtual });
    }
});

// --- ROTA PARA MUDAR A SENHA (POST) ---
app.post('/admin-mudar-senha', (req, res) => {
    const { senha_admin, nova_senha_cofre } = req.body;

    if (senha_admin === SENHA_ADMIN) {
        if (nova_senha_cofre.length === 4) {
            configCofre.senhaCorreta = nova_senha_cofre;
            salvarArquivo(ARQUIVO_CONFIG, configCofre);
            res.redirect(307, '/admin-dashboard'); // Recarrega o painel
        } else {
            res.send("Erro: A senha do cofre deve ter 4 números.");
        }
    } else {
        res.send("Senha Admin Incorreta.");
    }
});

// --- ÁREA RESTRITA (ADMIN) ---

app.get('/admin', (req, res) => {
    res.send(`
        <html class="bg-slate-900"><head><meta charset="UTF-8"><script src="https://cdn.tailwindcss.com"></script></head>
        <body class="flex items-center justify-center h-screen">
            <form action="/admin-dashboard" method="POST" class="bg-slate-800 p-8 rounded-xl border border-slate-700">
                <h1 class="text-2xl font-bold text-yellow-500 mb-4">🔐 Login do Dono</h1>
                <input type="password" name="senha" placeholder="Senha do Painel" class="w-full p-3 rounded bg-slate-900 text-white mb-4 outline-none border border-slate-600 focus:border-yellow-500">
                <button class="w-full bg-yellow-600 py-2 rounded font-bold">ENTRAR</button>
            </form>
        </body></html>
    `);
});

app.post('/admin-dashboard', (req, res) => {
    const { senha } = req.body;
    if (senha !== SENHA_ADMIN) return res.send("Acesso Negado.");

    const leads = lerArquivo(ARQUIVO_LEADS);
    const vendas = lerArquivo(ARQUIVO_FINANCEIRO);
    const totalFaturado = vendas.reduce((acc, v) => acc + (parseFloat(v.valor) || 0), 0);

    res.send(`
    <!DOCTYPE html>
    <html lang="pt-br">
    <head><meta charset="UTF-8"><script src="https://cdn.tailwindcss.com"></script></head>
    <body class="bg-slate-900 text-white p-6">
        <div class="max-w-6xl mx-auto">
            <header class="flex justify-between items-center mb-10 border-b border-slate-700 pb-4">
                <h1 class="text-3xl font-black text-yellow-500">PAINEL <span class="text-white">DESTRAVA CELL</span></h1>
                <a href="/admin" class="text-red-500 text-sm">SAIR</a>
            </header>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                <div class="bg-slate-800 p-6 rounded-2xl border border-yellow-500/50">
                    <h2 class="text-xl font-bold mb-4 flex items-center gap-2">⚙️ Configuração do Cofre</h2>
                    <div class="mb-4">
                        <span class="text-slate-400 text-sm">Senha Atual do Cofre:</span>
                        <span class="text-2xl font-mono font-bold text-yellow-500 ml-2">${configCofre.senhaCorreta}</span>
                    </div>
                    <form action="/admin-mudar-senha" method="POST" class="space-y-4">
                        <input type="hidden" name="senha_admin" value="${senha}">
                        <div>
                            <label class="block text-xs text-slate-500 mb-1">NOVA SENHA (4 DÍGITOS)</label>
                            <input type="text" name="nova_senha_cofre" maxlength="4" placeholder="Ex: 5588" class="w-full p-2 rounded bg-slate-900 border border-slate-600 outline-none focus:border-yellow-500">
                        </div>
                        <button class="w-full bg-yellow-600 hover:bg-yellow-500 text-black font-black py-2 rounded transition">ATUALIZAR SENHA</button>
                    </form>
                </div>

                <div class="bg-slate-800 p-6 rounded-2xl border border-green-500/50">
                    <h2 class="text-xl font-bold mb-4">💰 Resumo Financeiro</h2>
                    <div class="text-4xl font-mono font-black text-green-400">R$ ${totalFaturado.toFixed(2)}</div>
                    <p class="text-slate-500 text-sm mt-2">${vendas.length} vendas realizadas</p>
                    <p class="text-slate-500 text-sm italic mt-4">Prêmio Atual no Cofre: R$ ${configCofre.premioAtual.toFixed(2)}</p>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div class="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                    <div class="p-4 bg-slate-700/50 font-bold">📋 Últimos Leads (${leads.length})</div>
                    <div class="max-h-60 overflow-y-auto p-4 space-y-2">
                        ${leads.reverse().map(l => `<div class="text-sm bg-slate-900 p-2 rounded flex justify-between"><span>${l.nome}</span><span class="text-green-400">${l.tel}</span></div>`).join('') || 'Sem leads'}
                    </div>
                </div>
                <div class="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                    <div class="p-4 bg-slate-700/50 font-bold">💸 Últimas Vendas</div>
                    <div class="max-h-60 overflow-y-auto p-4 space-y-2">
                        ${vendas.reverse().map(v => `<div class="text-sm bg-slate-900 p-2 rounded flex justify-between"><span>${v.plano}</span><span class="text-yellow-500">R$ ${parseFloat(v.valor).toFixed(2)}</span></div>`).join('') || 'Sem vendas'}
                    </div>
                </div>
            </div>
        </div>
    </body></html>
    `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Rodando em: http://localhost:${PORT}`));
