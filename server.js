const express = require('express');
const app = express();
const path = require('path');

app.use(express.json());
app.use(express.static('public'));

let cofre = {
    premioAtual: 500.00,
    senhaCorreta: "1234", // Você pode gerar isso aleatoriamente
    tentativas: 0
};

// Rota para tentar abrir o cofre
app.post('/tentar', (req, res) => {
    const { senha } = req.body;
    cofre.tentativas++;
    
    if (senha === cofre.senhaCorreta) {
        res.json({ ganhou: true, premio: cofre.premioAtual });
        // Lógica para resetar o cofre aqui
    } else {
        res.json({ ganhou: false, msg: "Senha incorreta. O prêmio acumulou!" });
        cofre.premioAtual += 0.30; // Aumenta o prêmio a cada erro
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`OpenPix rodando na porta ${PORT}`));
