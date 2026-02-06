const express = require('express');
const app = express();
const fs = require('fs');
const path = require('path');

app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Para ler formulários
app.use(express.static('public'));

// --- CONFIGURAÇÕES DO DONO ---
const SENHA_ADMIN = "admin123"; // <--- SUA SENHA AQUI
const ARQUIVO_LEADS = 'leads.json';
const ARQUIVO_FINANCEIRO = 'financeiro.json';

let cofre = {
    premioAtual: 500.30,
    senhaCorreta: "1234",
    tentativas: 0
};

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

// 1. Salvar Lead (Cadastro)
app.post('/salvar-lead', (req, res) => {
    const novoUsuario = req.body;
    novoUsuario.data = new Date().toLocaleString('pt-BR');
    
    let leads = lerArquivo(ARQUIVO_LEADS);
    leads.push(novoUsuario);
    salvarArquivo(ARQUIVO_LEADS, leads);
    
    res.json({ status: "ok" });
});

// 2. Registrar Venda (Quando escolhe o plano)
app.post('/registrar-venda', (req, res) => {
    const { valor, plano } = req.body;
    const venda = {
        data: new Date().toLocaleString('pt-BR'),
        valor: parseFloat(valor),
        plano: plano
    };

    let vendas = lerArquivo(ARQUIVO_FINANCEIRO);
    vendas.push(venda);
    salvarArquivo(ARQUIVO_FINANCEIRO, vendas);

    res.json({ status: "ok" });
});

// 3. Tentativa de abrir
app.post('/tentar', (req, res) => {
    const { senha } = req.body;
    cofre.tentativas++;
    
    if (senha === cofre.senhaCorreta) {
        res.json({ ganhou: true, premio: cofre.premioAtual });
    } else {
        cofre.premioAtual += 0.50; 
        res.json({ ganhou: false, msg: "Senha incorreta", novoPremio: cofre.premioAtual });
    }
});

// --- ÁREA RESTRITA (ADMIN) ---

// Tela de Login
app.get('/admin', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html class="bg-slate-900">
        <head><meta charset="UTF-8"><script src="https://cdn.tailwindcss.com"></script></head>
        <body class="flex items-center justify-center h-screen">
            <form action="/admin-dashboard" method="POST" class="bg-slate-800 p-8 rounded-xl shadow-2xl border border-slate-700 text-center">
                <h1 class="text-2xl font-bold text-yellow-500 mb-4">🔐 Área Restrita</h1>
                <input type="password" name="senha" placeholder="Digite a senha" class="w-full p-3 rounded bg-slate-900 text-white border border-slate-600 mb-4 focus:border-yellow-500 outline-none">
                <button type="submit" class="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-2 rounded transition">ENTRAR</button>
            </form>
        </body>
        </html>
    `);
});

// Dashboard (Protegido por Senha)
app.post('/admin-dashboard', (req, res) => {
    const { senha } = req.body;

    if (senha !== SENHA_ADMIN) {
        return res.send('<h1 style="color:red; text-align:center; margin-top:50px;">SENHA INCORRETA ❌ <br><a href="/admin">Voltar</a></h1>');
    }

    // Carregar Dados
    const leads = lerArquivo(ARQUIVO_LEADS);
    const vendas = lerArquivo(ARQUIVO_FINANCEIRO);
    
    // Calcular Totais
    const totalLeads = leads.length;
    const totalFaturado = vendas.reduce((acc, item) => acc + (item.valor || 0), 0);
    const ticketMedio = totalFaturado / (vendas.length || 1);

    // Gerar HTML do Dashboard
    let html = `
    <!DOCTYPE html>
    <html lang="pt-br">
    <head>
        <meta charset="UTF-8">
        <title>Painel do Dono | OpenPix</title>
        <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-slate-900 text-white min-h-screen p-6">
        
        <header class="flex justify-between items-center mb-8 border-b border-slate-700 pb-4">
            <h1 class="text-3xl font-black text-yellow-500 tracking-tighter">OPEN<span class="text-white">PIX</span> <span class="text-sm text-slate-500 font-normal ml-2">| Painel do Dono</span></h1>
            <a href="/admin" class="text-red-400 hover:text-red-300 text-sm font-bold">SAIR</a>
        </header>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <div class="bg-slate-800 p-6 rounded-2xl border border-green-500/30 shadow-lg shadow-green-900/20">
                <div class="text-slate-400 text-xs uppercase font-bold tracking-widest mb-2">Faturamento Total</div>
                <div class="text-4xl font-mono font-black text-green-400">R$ ${totalFaturado.toFixed(2)}</div>
                <div class="text-xs text-slate-500 mt-2">${vendas.length} transações realizadas</div>
            </div>

            <div class="bg-slate-800 p-6 rounded-2xl border border-blue-500/30">
                <div class="text-slate-400 text-xs uppercase font-bold tracking-widest mb-2">Total de Leads</div>
                <div class="text-4xl font-mono font-black text-blue-400">${totalLeads}</div>
                <div class="text-xs text-slate-500 mt-2">Pessoas cadastradas</div>
            </div>

            <div class="bg-slate-800 p-6 rounded-2xl border border-yellow-500/30">
                <div class="text-slate-400 text-xs uppercase font-bold tracking-widest mb-2">Ticket Médio</div>
                <div class="text-4xl font-mono font-black text-yellow-500">R$ ${ticketMedio.toFixed(2)}</div>
                <div class="text-xs text-slate-500 mt-2">Valor médio por venda</div>
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div class="bg-slate-800 rounded-xl overflow-hidden shadow-xl border border-slate-700">
                <div class="bg-slate-700/50 p-4 font-bold text-blue-300 border-b border-slate-700">📋 Últimos Cadastros</div>
                <div class="max-h-96 overflow-y-auto">
                    <table class="w-full text-left">
                        <thead class="bg-slate-700 text-slate-300 sticky top-0">
                            <tr><th class="p-3 text-xs">Data</th><th class="p-3 text-xs">Nome</th><th class="p-3 text-xs">WhatsApp</th></tr>
                        </thead>
                        <tbody class="divide-y divide-slate-700 text-sm">
                            ${leads.reverse().map(l => `
                                <tr class="hover:bg-white/5">
                                    <td class="p-3 text-slate-400 text-xs">${l.data.split(' ')[0]}</td>
                                    <td class="p-3 font-bold">${l.nome}</td>
                                    <td class="p-3 text-green-400 font-mono">${l.tel}</td>
                                </tr>
                            `).join('') || '<tr><td colspan="3" class="p-4 text-center text-slate-500">Nada ainda...</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="bg-slate-800 rounded-xl overflow-hidden shadow-xl border border-slate-700">
                <div class="bg-slate-700/50 p-4 font-bold text-green-300 border-b border-slate-700">💸 Últimas Vendas</div>
                <div class="max-h-96 overflow-y-auto">
                    <table class="w-full text-left">
                        <thead class="bg-slate-700 text-slate-300 sticky top-0">
                            <tr><th class="p-3 text-xs">Data</th><th class="p-3 text-xs">Plano</th><th class="p-3 text-xs text-right">Valor</th></tr>
                        </thead>
                        <tbody class="divide-y divide-slate-700 text-sm">
                             ${vendas.reverse().map(v => `
                                <tr class="hover:bg-white/5">
                                    <td class="p-3 text-slate-400 text-xs">${v.data}</td>
                                    <td class="p-3 font-bold">${v.plano || 'Chance Única'}</td>
                                    <td class="p-3 text-green-400 font-mono text-right font-bold">+ R$ ${v.valor.toFixed(2)}</td>
                                </tr>
                            `).join('') || '<tr><td colspan="3" class="p-4 text-center text-slate-500">Sem vendas.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

    </body>
    </html>
    `;
    
    res.send(html);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
