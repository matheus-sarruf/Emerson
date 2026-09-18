const bcrypt = require('bcrypt');

async function gerar() {
    const senha1 = '123';
    const senha2 = '123';
    const hash1 = await bcrypt.hash(senha1, 10);
    const hash2 = await bcrypt.hash(senha2, 10);

    console.log('Hash 1:', hash1);
    console.log('Hash 2:', hash2);
}

gerar();