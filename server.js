const express = require('express');
const app = express();
const fs = require('fs');
const https = require('https');
const crypto = require('crypto');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// ===================================================
// ⚙️ CONFIGURAÇÕES GERAIS
// ===================================================

// DADOS DO TELEGRAM (Preencha aqui)
const TELEGRAM_BOT_TOKEN = "SEU_TOKEN_AQUI"; 
const TELEGRAM_CHAT_ID = "SEU_CHAT_ID_AQUI"; 

// SENHA DO ADMIN
const SENHA_ADMIN = "admin123"; 

// ARQUIVOS DE DADOS
const ARQUIVO_LEADS = 'leads.json';
const ARQUIVO_FINANCEIRO = 'financeiro.json';
const ARQUIVO_SOLICITACOES = 'solicitacoes.json';
const ARQUIVO_CONFIG = 'config.json';

// Inicializa Configuração se não existir
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

// ===================================================
// 🚀 ROTAS DO CLIENTE (JOGO)
// ===================================================

// Salvar Lead (Cadastro)
app.post('/salvar-lead', (req, res) => {
    const leads = lerArquivo(ARQUIVO_LEADS);
    leads.push({
        ...req.body,
        data: new Date().toLocaleString('pt-BR')
    });
    salvarArquivo(ARQUIVO_LEADS, leads);
    res.json({ status: "ok" });
});

// Registrar Venda (Tentativas)
app.post('/registrar-venda', (req, res) => {
    const vendas = lerArquivo(ARQUIVO_FINANCEIRO);
    vendas.push({
        ...req.body,
        data: new Date().toLocaleString('pt-BR')
    });
    salvarArquivo(ARQUIVO_FINANCEIRO, vendas);
    
    notificarTelegram(`💰 *NOVA VENDA!*\nItem: ${req.body.plano}\nValor: *R$ ${parseFloat(req.body.valor).toFixed(2)}*`);
    
    res.json({ status: "ok" });
});

// Registrar Compra de Dica
app.post('/comprar-dica', (req, res) => {
    const { nivel, valor, plano } = req.body;
    
    const vendas = lerArquivo(ARQUIVO_FINANCEIRO);
    vendas.push({
        plano: plano,
        valor: parseFloat(valor),
        data: new Date().toLocaleString('pt-BR')
    });
    salvarArquivo(ARQUIVO_FINANCEIRO, vendas);
    
    notificarTelegram(`🕵️ *DICA VENDIDA (Nível ${nivel})*\nValor: R$ ${parseFloat(valor).toFixed(2)}`);

    // Lógica da Pista
    const senhaReal = configCofre.senhaCorreta;
    let revelacao = "";

    if (nivel == 1) revelacao = senhaReal[0] + " _ _ _";
    if (nivel == 2) revelacao = senhaReal[0] + " " + senhaReal[1] + " _ _";
    if (nivel == 3) revelacao = senhaReal[0] + " " + senhaReal[1] + " " + senhaReal[2] + " _";

    res.json({ sucesso: true, dica: revelacao });
});

// Tentar abrir o cofre
app.post('/tentar', (req, res) => {
    const { senha } = req.body;
    
    if (senha === configCofre.senhaCorreta) {
        // GANHOU!
        const tokenVitoria = "WIN-" + crypto.randomBytes(3).toString('hex').toUpperCase();
        
        notificarTelegram(`🚨🚨 *O COFRE FOI ABERTO!* 🚨🚨\nSenha: ${senha}\nToken: ${tokenVitoria}\nAguardando solicitação de saque.`);
        
        res.json({
            ganhou: true,
            premio: configCofre.premioAtual,
            token: tokenVitoria
        });
    } else {
        // ERROU: Aumenta o prêmio
        configCofre.premioAtual += 0.50; 
        salvarArquivo(ARQUIVO_CONFIG, configCofre);
        
        res.json({
            ganhou: false,
            novoPremio: configCofre.premioAtual
        });
    }
});

// Solicitar Saque (Novo Fluxo)
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
        data: new Date().toLocaleString('pt-BR')
    });
    
    salvarArquivo(ARQUIVO_SOLICITACOES, solicitacoes);
    notificarTelegram(`💸 *SOLICITAÇÃO DE SAQUE*\nNome: ${nome}\nValor: R$ ${valor}\nPix: ${pix}`);
    
    res.json({ sucesso: true });
});

// ===================================================
// 🔐 ÁREA ADMINISTRATIVA
// ===================================================

// Rota de Login Admin
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

// Rota para Marcar como Pago
app.post('/admin-pagar', (req, res) => {
    const { id } = req.body;
    const solicitacoes = lerArquivo(ARQUIVO_SOLICITACOES);
    
    const index = solicitacoes.findIndex(s => s.id === id);
    if (index !== -1) {
        solicitacoes[index].status = "PAGO";
        salvarArquivo(ARQUIVO_SOLICITACOES, solicitacoes);
        
        // Zera o cofre após pagar
        configCofre.premioAtual = 100.00; 
        salvarArquivo(ARQUIVO_CONFIG, configCofre);
        
        res.json({ sucesso: true });
    } else {
        res.json({ sucesso: false });
    }
});

// Rota para Mudar Senha do Cofre
app.post('/admin-mudar-senha', (req, res) => {
    const { senha_admin, nova_senha_cofre } = req.body;
    
    if (senha_admin === SENHA_ADMIN) {
        configCofre.senhaCorreta = nova_senha_cofre;
        salvarArquivo(ARQUIVO_CONFIG, configCofre);
        
        notificarTelegram(`🔐 *SENHA DO COFRE ALTERADA*\nNova senha: ${nova_senha_cofre}`);
        
        // Redireciona de volta pro dashboard simulando o POST original
        res.send(`<form action="/admin-dashboard" method="POST" id="formRedirect"><input type="hidden" name="senha" value="${SENHA_ADMIN}"></form><script>document.getElementById("formRedirect").submit();</script>`);
    } else {
        res.send("Erro: Senha admin incorreta.");
    }
});

// DASHBOARD COMPLETO (EXPANDIDO)
app.post('/admin-dashboard', (req, res) => {
    const { senha } = req.body;
    
    if (senha !== SENHA_ADMIN) {
        return res.send("<h1>Acesso Negado</h1><a href='/admin'>Voltar</a>");
    }
    
    // Carrega dados atualizados
    const leads = lerArquivo(ARQUIVO_LEADS);
    const vendas = lerArquivo(ARQUIVO_FINANCEIRO);
    const solicitacoes = lerArquivo(ARQUIVO_SOLICITACOES);
    const totalFaturado = vendas.reduce((acc, v) => acc + (parseFloat(v.valor) || 0), 0);

    // HTML do Dashboard Expandido para facilitar leitura
    res.send(`
    <!DOCTYPE html>
    <html lang="pt-br">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Painel Admin - OpenPix</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" />
    </head>
    <body class="bg-slate-950 text-white min-h-screen p-6 font-sans">
        <div class="max-w-6xl mx-auto">
            
            <header class="flex justify-between items-center mb-10 border-b border-slate-800 pb-6">
                <h1 class="text-3xl font-black text-yellow-500">
                    OPEN<span class="text-white">PIX</span> <span class="text-sm font-normal text-slate-500 ml-2">ADMIN V3.0</span>
                </h1>
                <div class="text-right">
                    <p class="text-xs text-slate-500 uppercase tracking-widest">Prêmio Atual no Cofre</p>
                    <p class="text-2xl font-mono font-bold text-green-400">R$ ${configCofre.premioAtual.toFixed(2)}</p>
                </div>
            </header>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div class="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
                    <div class="flex items-center gap-3 mb-2">
                        <div class="bg-green-500/20 p-2 rounded-lg"><i class="fas fa-wallet text-green-500"></i></div>
                        <p class="text-slate-500 text-xs font-bold uppercase">Faturamento Total</p>
                    </div>
                    <p class="text-4xl font-black text-green-500">R$ ${totalFaturado.toFixed(2)}</p>
                </div>

                <div class="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
                    <div class="flex items-center gap-3 mb-2">
                        <div class="bg-blue-500/20 p-2 rounded-lg"><i class="fas fa-users text-blue-500"></i></div>
                        <p class="text-slate-500 text-xs font-bold uppercase">Leads Cadastrados</p>
                    </div>
                    <p class="text-4xl font-black text-blue-500">${leads.length}</p>
                </div>

                <div class="bg-slate-900 p-6 rounded-2xl border border-yellow-500/30 shadow-xl">
                    <div class="flex items-center gap-3 mb-2">
                        <div class="bg-yellow-500/20 p-2 rounded-lg"><i class="fas fa-key text-yellow-500"></i></div>
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
