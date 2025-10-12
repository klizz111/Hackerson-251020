function sm4_enc_ecb(plaintext, contact_key_int) {
    const contact_key_bytes = new Uint8Array(16);
    let key_temp = contact_key_int;
    for (let i = 15; i >= 0; i--) {
        contact_key_bytes[i] = Number(key_temp & 0xFFn);
        key_temp = key_temp >> 8n;
    }

    const keyHex = Array.from(contact_key_bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    return sm4.encrypt(plaintext, keyHex);
}

function sm4_dec_ecb(ciphertext, contact_key_int) {
    const contact_key_bytes = new Uint8Array(16);
    let key_temp = contact_key_int;
    for (let i = 15; i >= 0; i--) {
        contact_key_bytes[i] = Number(key_temp & 0xFFn);
        key_temp = key_temp >> 8n;
    }

    const keyHex = Array.from(contact_key_bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    try {
        return sm4.decrypt(ciphertext, keyHex) || false;
    } catch (error) {
        console.error("解密过程中发生错误:", error);
        return false;
    }
}


window.sm4_enc_ecb = sm4_enc_ecb;
window.sm4_dec_ecb = sm4_dec_ecb;