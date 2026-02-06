const express = require('express');
const app = express();
const fs = require('fs');
const https = require('https');
const crypto = require('crypto'); // Para gerar o código único

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// --- CONFIGURAÇÕES ---
const TELEGRAM_BOT_TOKEN = "SEU_TOKEN_AQUI"; 
const TELEGRAM_CHAT_ID = "SEU_CHAT_ID_AQUI"; 
const SENHA_ADMIN = "admin123"; 

const ARQUIVO_LEADS = 'leads.json';
const ARQUIVO_FINANCEIRO = 'financeiro.json';
const ARQUIVO_SOLICITACOES = 'solicitacoes.json'; // NOVO ARQUIVO
const ARQUIVO_CONFIG = 'config.json';

// Inicialização
let configCofre = { premioAtual: 500.30, senhaCorreta: "1234" };
if (fs.existsSync(ARQUIVO_CONFIG)) configCofre = JSON.parse(fs.readFileSync(ARQUIVO_CONFIG));
else fs.writeFileSync(ARQUIVO_CONFIG, JSON.stringify(configCofre, null, 2));

// --- FUNÇÕES ---
function lerArquivo(arquivo) {
    if (fs.existsSync(arquivo)) {
        try { return JSON.parse(fs.readFileSync(arquivo)); } catch (e) { return []; }
    }
    return [];
}

function salvarArquivo(arquivo, dados) {
    fs.writeFileSync(arquivo, JSON.stringify(dados, null, 2));
}

function notificarTelegram(mensagem) {
    if (TELEGRAM_BOT_TOKEN === "SEU_TOKEN_AQUI") return;
    const data = JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: mensagem, parse_mode: 'Markdown' });
    const options = { hostname: 'api.telegram.org', port: 443, path: `/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': data.length } };
    const req = https.request(options, res => { res.on('data', () => {}); });
    req.write(data); req.end();
}

// --- ROTAS ---

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
    notificarTelegram(`💰 *VENDA:* ${req.body.plano} - R$ ${parseFloat(req.body.valor).toFixed(2)}`);
    res.json({ status: "ok" });
});

app.post('/tentar', (req, res) => {
    const { senha } = req.body;
    
    if (senha === configCofre.senhaCorreta) {
        // Gera um token único de vitória
        const tokenVitoria = "WIN-" + crypto.randomBytes(3).toString('hex').toUpperCase();
        
        notificarTelegram(`🚨 *GANHADOR DETECTADO!* 🚨\nSenha: ${senha}\nToken: ${tokenVitoria}\nAguardando solicitação de saque.`);
        
        res.json({ ganhou: true, premio: configCofre.premioAtual, token: tokenVitoria });
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
    
    const senhaReal = configCofre.senhaCorreta;
    let revelacao = "";
    if (nivel == 1) revelacao = senhaReal[0] + " _ _ _";
    if (nivel == 2) revelacao = senhaReal[0] + " " + senhaReal[1] + " _ _";
    if (nivel == 3) revelacao = senhaReal[0] + " " + senhaReal[1] + " " + senhaReal[2] + " _";
    
    res.json({ sucesso: true, dica: revelacao });
});

// --- NOVO: ROTA DE SOLICITAÇÃO DE SAQUE ---
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
        status: "PENDENTE", // PENDENTE ou PAGO
        data: new Date().toLocaleString('pt-BR')
    });
    
    salvarArquivo(ARQUIVO_SOLICITACOES, solicitacoes);
    notificarTelegram(`💸 *SOLICITAÇÃO DE SAQUE*\nNome: ${nome}\nValor: R$ ${valor}\nPix: ${pix}`);
    
    res.json({ sucesso: true });
});

// --- NOVO: ROTA PARA O ADMIN PAGAR ---
app.post('/admin-pagar', (req, res) => {
    const { id } = req.body;
    const solicitacoes = lerArquivo(ARQUIVO_SOLICITACOES);
    
    const index = solicitacoes.findIndex(s => s.id === id);
    if (index !== -1) {
        solicitacoes[index].status = "PAGO";
        salvarArquivo(ARQUIVO_SOLICITACOES, solicitacoes);
        
        // Zera o cofre ou reinicia valor (Opcional, aqui estou reiniciando para 100)
        configCofre.premioAtual = 100.00; 
        salvarArquivo(ARQUIVO_CONFIG, configCofre);
        
        res.json({ sucesso: true });
    } else {
        res.json({ sucesso: false });
    }
});

// --- ADMIN DASHBOARD ATUALIZADO ---
app.post('/admin-dashboard', (req, res) => {
    const { senha } = req.body;
    if (senha !== SENHA_ADMIN) return res.send("Senha incorreta.");
    
    const leads = lerArquivo(ARQUIVO_LEADS);
    const vendas = lerArquivo(ARQUIVO_FINANCEIRO);
    const solicitacoes = lerArquivo(ARQUIVO_SOLICITACOES);
    const totalFaturado = vendas.reduce((acc, v) => acc + (parseFloat(v.valor) || 0), 0);

    res.send(`
    <!DOCTYPE html><html lang="pt-br"><head><meta charset="UTF-8"><script src="https://cdn.tailwindcss.com"></script><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" /></head>
    <body class="bg-slate-950 text-white min-h-screen p-6 font-sans">
        <div class="max-w-6xl mx-auto">
            <header class="flex justify-between items-center mb-10 border-b border-slate-800 pb-6">
                <h1 class="text-3xl font-black text-yellow-500">OPEN<span class="text-white">PIX</span> ADM</h1>
                <div class="text-right">
                    <p class="text-xs text-slate-500">Cofre Atual</p>
                    <p class="text-xl font-mono font-bold text-green-400">R$ ${configCofre.premioAtual.toFixed(2)}</p>
                </div>
            </header>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div class="bg-slate-900 p-6 rounded-2xl border border-slate-800">
                    <p class="text-slate-500 text-xs font-bold uppercase mb-2">Faturamento</p>
                    <p class="text-4xl font-black text-green-500">R$ ${totalFaturado.toFixed(2)}</p>
                </div>
                <div class="bg-slate-900 p-6 rounded-2xl border border-slate-800">
                    <p class="text-slate-500 text-xs font-bold uppercase mb-2">Leads</p>
                    <p class="text-4xl font-black text-blue-500">${leads.length}</p>
                </div>
                <div class="bg-slate-900 p-6 rounded-2xl border border-yellow-500/30">
                    <p class="text-slate-500 text-xs font-bold uppercase mb-1">Alterar Senha</p>
                    <form action="/admin-mudar-senha" method="POST" class="flex gap-2">
                        <input type="hidden" name="senha_admin" value="${senha}">
                        <input type="text" name="nova_senha_cofre" maxlength="4" value="${configCofre.senhaCorreta}" class="bg-black border border-slate-700 rounded p-1 w-20 text-center text-xl font-mono text-yellow-500">
                        <button class="bg-yellow-600 text-black px-3 rounded text-xs font-bold">OK</button>
                    </form>
                </div>
            </div>

            <div class="bg-slate-900 rounded-xl border border-yellow-500/50 overflow-hidden mb-8 shadow-2xl shadow-yellow-500/10">
                <div class="p-4 bg-yellow-900/20 border-b border-yellow-500/20 font-bold text-sm uppercase tracking-widest text-yellow-500 flex items-center gap-2">
                    <i class="fas fa-hand-holding-usd"></i> Solicitações de Prêmios
                </div>
                <div class="p-4 space-y-3">
                    ${solicitacoes.length === 0 ? '<p class="text-slate-500 text-sm">Nenhuma solicitação ainda.</p>' : ''}
                    ${solicitacoes.reverse().map(s => `
                        <div class="flex flex-col md:flex-row justify-between items-center bg-black/40 p-4 rounded-lg border ${s.status === 'PAGO' ? 'border-green-900' : 'border-yellow-600'}">
                            <div class="mb-2 md:mb-0">
                                <p class="font-bold text-white text-lg">${s.nome}</p>
                                <p class="text-xs text-slate-400">CPF: ${s.cpf} | Data: ${s.data}</p>
                                <p class="text-sm font-mono text-yellow-400 mt-1">PIX: ${s.pix}</p>
                                <p class="text-[10px] text-slate-600 mt-1">TOKEN: ${s.token}</p>
                            </div>
                            <div class="text-right flex flex-col items-end gap-2">
                                <p class="text-2xl font-black text-white">R$ ${s.valor.toFixed(2)}</p>
                                ${s.status === 'PENDENTE' ? `
                                    <button onclick="pagar('${s.id}')" class="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded text-xs font-bold transition">MARCAR COMO PAGO</button>
                                ` : `
                                    <span class="bg-green-900 text-green-400 px-3 py-1 rounded text-xs font-bold border border-green-700">PAGO ✅</span>
                                `}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div class="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                    <div class="p-4 bg-slate-800 font-bold text-xs uppercase tracking-widest text-slate-400">Últimos Leads</div>
                    <div class="max-h-60 overflow-y-auto p-4 space-y-3">
                        ${leads.reverse().map(l => `<div class="flex justify-between items-center border-b border-slate-800 pb-2"><div><p class="font-bold text-sm">${l.nome}</p><p class="text-xs text-slate-500">${l.data}</p></div><p class="text-xs font-mono">${l.tel}</p></div>`).join('')}
                    </div>
                </div>
                <div class="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                    <div class="p-4 bg-slate-800 font-bold text-xs uppercase tracking-widest text-slate-400">Fluxo de Caixa</div>
                    <div class="max-h-60 overflow-y-auto p-4 space-y-3">
                        ${vendas.reverse().map(v => `<div class="flex justify-between items-center border-b border-slate-800 pb-2"><div><p class="font-bold text-sm text-slate-300">${v.plano}</p><p class="text-[10px] text-slate-600">${v.data}</p></div><p class="text-green-400 font-bold">R$ ${parseFloat(v.valor).toFixed(2)}</p></div>`).join('')}
                    </div>
                </div>
            </div>
        </div>

        <script>
            async function pagar(id) {
                if(confirm('Confirmar que você realizou o PIX para o ganhador?')) {
                    await fetch('/admin-pagar', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ id })
                    });
                    location.reload();
                }
            }
        </script>
    </body></html>
    `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor Online na porta ${PORT}`));
