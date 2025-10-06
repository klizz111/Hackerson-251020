/**
 * AES-ECB模式加密函数
 * @param {string} plaintext - 要加密的明文字符串
 * @param {bigint} contact_key_int - 用作密钥的大整数
 * @returns {string} 加密后的十六进制字符串
 */
function aes_enc_ecb(plaintext, contact_key_int) {
    // 将BigInt转换为16字节的Uint8Array (AES-128)
    const contact_key_bytes = new Uint8Array(16);
    let key_temp = contact_key_int;
    for (let i = 15; i >= 0; i--) {
        contact_key_bytes[i] = Number(key_temp & 0xFFn);
        key_temp = key_temp >> 8n;
    }
    
    // 转换为CryptoJS格式的密钥
    const keyHex = Array.from(contact_key_bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    const key = CryptoJS.enc.Hex.parse(keyHex);
    
    // 使用ECB模式加密，PKCS7填充
    const encrypted = CryptoJS.AES.encrypt(plaintext, key, {
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Pkcs7
    });
    
    // 测试解密
    // console.log(`plaintext: ${contact_key_bytes}`);
    const decrypted = aes_dec_ecb(encrypted.ciphertext.toString(), contact_key_int);
    if (decrypted !== plaintext) {
        console.error("AES解密验证失败，可能是加密或解密过程中出现问题");
    } else {
        console.log("AES解密验证成功");
        console.log(`解密结果: ${decrypted}`);
    }
    // 返回加密后的十六进制字符串
    return encrypted.ciphertext.toString();
}

/**
 * AES-ECB模式解密函数
 * @param {string} ciphertext - 要解密的十六进制密文字符串
 * @param {bigint} contact_key_int - 用作密钥的大整数
 * @returns {string} 解密后的明文字符串
 */
function aes_dec_ecb(ciphertext, contact_key_int) {
    // 将BigInt转换为16字节的Uint8Array (AES-128)'
    console.log("call aes_dec_ecb");
    console.log(`contact_key_int: ${contact_key_int}`);
    console.log(`ciphertext: ${ciphertext}`);
    const contact_key_bytes = new Uint8Array(16);
    let key_temp = contact_key_int;
    for (let i = 15; i >= 0; i--) {
        contact_key_bytes[i] = Number(key_temp & 0xFFn);
        key_temp = key_temp >> 8n;
    }
    
    // 转换为CryptoJS格式的密钥
    const keyHex = Array.from(contact_key_bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    const key = CryptoJS.enc.Hex.parse(keyHex);
    
    // 将十六进制密文转换为CryptoJS格式
    const ciphertextObj = CryptoJS.enc.Hex.parse(ciphertext);
    
    // 解密
    const decrypted = CryptoJS.AES.decrypt(
        { ciphertext: ciphertextObj },
        key,
        {
            mode: CryptoJS.mode.ECB,
            padding: CryptoJS.pad.Pkcs7
        }
    );
    
    // 返回解密后的明文字符串
    return decrypted.toString(CryptoJS.enc.Utf8);
}
