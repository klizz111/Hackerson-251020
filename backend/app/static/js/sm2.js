// 椭圆曲线参数

const P = BigInt(
    "0xFFFFFFFEFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF00000000FFFFFFFFFFFFFFFF"
);
const N = BigInt(
    "0xFFFFFFFEFFFFFFFFFFFFFFFFFFFFFFFF7203DF6B21C6052B53BBF40939D54123"
);
const A = BigInt(
    "0xFFFFFFFEFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF00000000FFFFFFFFFFFFFFFC"
);
const B = BigInt(
    "0x28E9FA9E9D9F5E344D5A9E4BCF6509A7F39789F515AB8F92DDBCBD414D940E93"
);
const Gx = BigInt(
    "0x32C4AE2C1F1981195F9904466A39C9948FE30BBFF2660BE1715A4589334C74C7"
);
const Gy = BigInt(
    "0xBC3736A2F4F6779C59BDCEE36B692153D0A9877CC62A474002DF32E52139F0A0"
);
const G = [Gx, Gy];
const O = [0n, 0n];
const INFINITY = [0n, 1n, 0n];

function isInfinityAffine(p) {
    return Array.isArray(p) && p.length === 2 && p[0] === 0n && p[1] === 0n;
}

function mod(x, m = P) {
    const r = x % m;
    return r >= 0n ? r : r + m;
}

// bytes/Uint8Array -> BigInt
function bytesToBigInt(bytes) {
    let o = 0n;
    for (let b of bytes) {
        o = (o << 8n) + BigInt(b);
    }
    return o;
}

// 模逆（扩展欧几里得）
function inv(a, n) {
    a = mod(a, n);
    if (a === 0n) return 0n;
    let lm = 1n,
        hm = 0n;
    let low = a,
        high = n;
    while (low > 1n) {
        const r = high / low;
        const nm = hm - lm * r;
        const newv = high - low * r;
        hm = lm;
        high = low;
        lm = nm;
        low = newv;
    }
    return mod(lm, n);
}

// 将二维点转为雅可比坐标 [x,y,z]
function toJacobian(p) {
    if (!p) return INFINITY.slice();
    if (Array.isArray(p) && p.length === 3) {
        return p[2] === 0n ? INFINITY.slice() : p.slice();
    }
    if (isInfinityAffine(p)) return INFINITY.slice();
    return [p[0], p[1], 1n];
}

// 从雅可比坐标转回二维点
function fromJacobian(p) {
    if (!p || p[2] === 0n) return O.slice();
    const zInv = inv(p[2], P);
    const zInv2 = mod(zInv * zInv, P);
    const zInv3 = mod(zInv2 * zInv, P);
    return [mod(p[0] * zInv2, P), mod(p[1] * zInv3, P)];
}

// 雅可比点加倍
function jacobianDouble(p) {
    const [X1, Y1, Z1] = p;
    if (Z1 === 0n || Y1 === 0n) return INFINITY.slice();
    const Y1sq = mod(Y1 * Y1, P);
    const S = mod(4n * X1 * Y1sq, P);
    const M = mod(3n * X1 * X1 + A * Z1 ** 4n, P);
    const nx = mod(M * M - 2n * S, P);
    const ny = mod(M * (S - nx) - 8n * (Y1sq * Y1sq), P);
    const nz = mod(2n * Y1 * Z1, P);
    return [nx, ny, nz];
}

// 雅可比点相加
function jacobianAdd(p, q) {
    if (p[2] === 0n) return q.slice();
    if (q[2] === 0n) return p.slice();
    const [X1, Y1, Z1] = p;
    const [X2, Y2, Z2] = q;

    const U1 = mod(X1 * Z2 ** 2n, P);
    const U2 = mod(X2 * Z1 ** 2n, P);
    const S1 = mod(Y1 * Z2 ** 3n, P);
    const S2 = mod(Y2 * Z1 ** 3n, P);

    if (U1 === U2) {
        if (S1 !== S2) {
            return INFINITY.slice(); 
        }
        return jacobianDouble(p);
    }

    const H = mod(U2 - U1, P);
    const R = mod(S2 - S1, P);
    const H2 = mod(H * H, P);
    const H3 = mod(H * H2, P);
    const U1H2 = mod(U1 * H2, P);

    const nx = mod(R * R - H3 - 2n * U1H2, P);
    const ny = mod(R * (U1H2 - nx) - S1 * H3, P);
    const nz = mod(H * Z1 * Z2, P);

    return [nx, ny, nz];
}

// 雅可比点按整数乘（使用平方-加算法）
function jacobianMultiply(a, n) {
    let e = mod(BigInt(n), N);
    if (e === 0n) return INFINITY.slice(); 
    let result = INFINITY.slice();
    let addend = a.slice();
    while (e > 0n) {
        if (e & 1n) result = jacobianAdd(result, addend);
        addend = jacobianDouble(addend);
        e >>= 1n;
    }
    return result;
}

// 纯坐标点乘（二维点）
function multiply(a, n) {
    const A_j = toJacobian(a);
    const R_j = jacobianMultiply(A_j, n);
    return fromJacobian(R_j);
}

// 纯坐标点加
function add(a, b) {
    const A_j = toJacobian(a);
    const B_j = toJacobian(b);
    const R_j = jacobianAdd(A_j, B_j);
    return fromJacobian(R_j);
}

// 生成256位随机数私钥
function genPrivateKey() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return bytesToBigInt(array) % N;
}

// BigIntToBytes
function bigIntToBytes(num, length) {
    const bytes = new Uint8Array(length);
    for (let i = length - 1; i >= 0; i--) {
        bytes[i] = Number(num & 0xffn);
        num >>= 8n;
    }
    return bytes;
}

function generateSeed() {
    // 生成32字节随机数据，转换为Base64格式（更短但仍然安全）
    const array = new Uint8Array(32); // 32字节 = 256位
    crypto.getRandomValues(array);
    // 使用Base64编码，去掉填充字符，更紧凑
    return btoa(String.fromCharCode(...array))
        .replace(/[+/=]/g, "")
        .substring(0, 32);
}

function generateReadableSeed() {
    const seed = this.generateSeed();
    // 每8个字符添加一个分隔符
    return seed.match(/.{1,8}/g).join("-");
}

// 使用种子派生256位私钥
async function derivePrivateKey(seed) {
    const encoder = new TextEncoder();
    const data = encoder.encode(seed);
    let hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = new Uint8Array(hashBuffer);
    let x = 0n;
    for (let i = 0; i < hashArray.length; i++) {
        x = (x << 8n) + BigInt(hashArray[i]);
    }
    // [1, N-1]
    return (x % (N - 1n)) + 1n;
}

async function register(username, seed) {
    // 1. 生成用户私钥
    const d = await derivePrivateKey(seed);

    // 2. 计算用户公钥
    const P = multiply(G, d);

    // 3. 生成随机数 r
    const r = genPrivateKey();

    // 4. T = r * G
    const T = multiply(G, r);

    // 使用 32 字节大端序列化每个坐标并拼接，然后做 SHA-256
    const parts = [Gx, Gy, P[0], P[1], T[0], T[1]];
    const data = new Uint8Array(32 * parts.length);
    for (let i = 0; i < parts.length; i++) {
        data.set(bigIntToBytes(parts[i], 32), i * 32);
    }

    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = new Uint8Array(hashBuffer);
    let c = 0n;
    for (let i = 0; i < hashArray.length; i++) {
        c = (c << 8n) + BigInt(hashArray[i]);
    }

    c = c % N; // 使用 N

    // 6. 计算 z = (r + c * d) mod N
    const z = mod(r + c * d, N);

    const postdata = {
        username: username,
        pk_x: P[0].toString(),
        pk_y: P[1].toString(),
        c: c.toString(),
        z: z.toString(),
    };

    const response = await fetch("/api/register_ecc", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(postdata),
    });

    return await response.json();
}

async function login(username, seed) {
    // 1. 生成用户私钥
    const d = await derivePrivateKey(seed);
    // 2. 计算用户公钥
    const P = multiply(G, d);
    // 3. 生成随机数 r
    const r = genPrivateKey();
    // 4. T = r * G
    const T = multiply(G, r);
    // 使用 32 字节大端序列化每个坐标并拼接，然后做 SHA-256
    const parts = [Gx, Gy, P[0], P[1], T[0], T[1]];
    const data = new Uint8Array(32 * parts.length);
    for (let i = 0; i < parts.length; i++) {
        data.set(bigIntToBytes(parts[i], 32), i * 32);
    }

    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = new Uint8Array(hashBuffer);
    let c = 0n;
    for (let i = 0; i < hashArray.length; i++) {
        c = (c << 8n) + BigInt(hashArray[i]);
    }

    const z = mod(r + c * d, N);

    const postdata = {
        username: username,
        c: c.toString(),
        z: z.toString(),
    };

    const response = await fetch("/api/login_ecc", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(postdata),
    });

    const result = await response.json();

    if (result.success) {
        saveSessionToLocal(username, result.session_id);
        return result;
    } else {
        return result;
    }
}

function saveSessionToLocal(username, sessionId) {
    try {
        const sessionData = {
            username: username,
            sessionId: sessionId,
            timestamp: Date.now(),
        };
        localStorage.setItem(
            `zk_session_${username}`,
            JSON.stringify(sessionData)
        );
        localStorage.setItem("zk_current_session", sessionId);
        localStorage.setItem("zk_current_user", username);
    } catch (error) {
        console.warn("无法保存session到本地存储:", error);
    }
}

async function GenPK(username) {
    const seed = localStorage.getItem(`${username}_seed`);
    if (!seed) {
        throw new Error("用户种子不存在");
    }
    return derivePrivateKey(seed).then((d) => multiply(G, d));
}

async function enc(pk, m) {
    // 1. 生成随机数 k
    const k = genPrivateKey();

    // 2. 计算 C1 = k * G
    const C1 = multiply(G, k);

    // 3. 计算 S = k * pk
    const S = multiply(pk, k);

    // 4. 计算 C2 = m + S
    const C2 = add(m, S);

    return { C1, C2 };
}

async function dec(d, C1, C2) {
    const S = multiply(C1, d);
    return add(C2, negate(S));
}

function negate(p) {
    if (!p || (p[0] === 0n && p[1] === 0n)) return O.slice();
    return [p[0], mod(-p[1], P)];
}

// 生成共享密钥
async function gen_shared_key(currentUser, other_username) {
    const seed = localStorage.getItem(`zk_login_seed_${currentUser}`);
    if (!seed) {
        throw new Error("用户种子不存在");
    }

    const user_x = localStorage.getItem(`${other_username}_x`);
    const user_y = localStorage.getItem(`${other_username}_y`);

    const d = await derivePrivateKey(seed);
    // 计算共享密钥
    // 计算 S = d * pk_other
    const other_pk = [BigInt(user_x), BigInt(user_y)];
    const S = multiply(other_pk, d);

    // 共享私钥为S的x坐标
    return S[0].toString();
}

// 加密联系方式与选择
async function prepare_response_info(
    contact_info,
    currentUser,
    other_username,
    response
) {
    // 1. 生成联系方式加密密钥m
    const contact_key_int = genPrivateKey();

    // 2. 生成点M
    const M = multiply(G, contact_key_int);
    const symmetric_key = M[0];
    localStorage.setItem(
        `contact_key_${currentUser}_to_${other_username}`,
        symmetric_key.toString()
    );
    console.log("M:", M);

    // 3. AES加密
    const encryptedHex = sm4_enc_ecb(contact_info, symmetric_key);

    // 转换为Uint8Array
    const encrypted_contact = new Uint8Array(
        encryptedHex.match(/.{2}/g).map((byte) => parseInt(byte, 16))
    );

    // 3. 加密contact_key_int
    const user_shared_key = localStorage.getItem(
        `${currentUser}_${other_username}_shared_key`
    );
    if (!user_shared_key) {
        throw new Error("共享密钥不存在");
    }

    const pk = multiply(G, BigInt(user_shared_key));
    const encrypt_message = await enc(pk, M);

    // 4. 加密选择
    const choice = response === "accept" ? 1n : 0n;

    let choice_point;
    if (choice === 1n) {
        choice_point = O; // 如果同意加密无穷点
    } else {
        choice_point = multiply(G, genPrivateKey()); // 如果拒绝加密随机点
    }
    const encrypt_choice = await enc(pk, choice_point);

    const response_data = {
        encrypt_message_C1_x: encrypt_message.C1[0].toString(),
        encrypt_message_C1_y: encrypt_message.C1[1].toString(),
        encrypt_message_C2_x: encrypt_message.C2[0].toString(),
        encrypt_message_C2_y: encrypt_message.C2[1].toString(),
        encrypt_choice_C1_x: encrypt_choice.C1[0].toString(),
        encrypt_choice_C1_y: encrypt_choice.C1[1].toString(),
        encrypt_choice_C2_x: encrypt_choice.C2[0].toString(),
        encrypt_choice_C2_y: encrypt_choice.C2[1].toString(),
        encrypted_contact: Array.from(encrypted_contact)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join(""),
    };

/*     // 尝试解密
    var dec_res = await dec(
        BigInt(user_shared_key),
        add(encrypt_message.C1, encrypt_choice.C1),
        add(encrypt_message.C2, encrypt_choice.C2)
    );
    console.log("尝试解密结果:", dec_res);
    if (dec_res[0] === M[0]) console.log("解密成功，点匹配");
    else console.log("解密失败，点不匹配"); */
    
/*         // ===== 自测：双方都同意（Choice=O） =====
    if (choice === 1n) {
        try {
            // 模拟“对方也选择 O”的密文
            const enc_choice_peer = await enc(pk, O);

            // 情况一：平台不乘 r，只做 Enc(M) + Enc(O) + Enc(O)
            const sumC1_no_r = add(add(encrypt_message.C1, encrypt_choice.C1), enc_choice_peer.C1);
            const sumC2_no_r = add(add(encrypt_message.C2, encrypt_choice.C2), enc_choice_peer.C2);
            const dec_no_r = await dec(BigInt(user_shared_key), sumC1_no_r, sumC2_no_r);
            const ok_no_r = dec_no_r[0] === M[0] && dec_no_r[1] === M[1];
            console.log("[自测][双方同意][no-r] =>", ok_no_r ? "PASS" : "FAIL", { dec: dec_no_r, M });

            // 情况二：平台按 r 做 r*(Enc(O)+Enc(O)) + Enc(M)
            let r_test = 0n;
            do { r_test = genPrivateKey(); } while (r_test === 0n); // 确保 r ≠ 0
            const choiceSumC1 = add(encrypt_choice.C1, enc_choice_peer.C1);
            const choiceSumC2 = add(encrypt_choice.C2, enc_choice_peer.C2);
            const rC1 = multiply(choiceSumC1, r_test);
            const rC2 = multiply(choiceSumC2, r_test);
            const sumC1_with_r = add(encrypt_message.C1, rC1);
            const sumC2_with_r = add(encrypt_message.C2, rC2);
            const dec_with_r = await dec(BigInt(user_shared_key), sumC1_with_r, sumC2_with_r);
            const ok_with_r = dec_with_r[0] === M[0] && dec_with_r[1] === M[1];
            console.log("[自测][双方同意][with-r] =>", ok_with_r ? "PASS" : "FAIL", { dec: dec_with_r, M });
        } catch (e) {
            console.warn("[自测][双方同意] 异常:", e);
        }
    } */
    
    return response_data;
}

// 导出到全局对象
window.sm2 = {
    P,
    N,
    A,
    B,
    Gx,
    Gy,
    G,
    bytesToBigInt,
    mod,
    inv,
    toJacobian,
    fromJacobian,
    jacobianDouble,
    jacobianAdd,
    jacobianMultiply,
    multiply,
    add,
    negate,
    genPrivateKey,
    bigIntToBytes,
    generateSeed,
    generateReadableSeed,
    derivePrivateKey,
    register,
    login,
    enc,
    dec,
    gen_shared_key,
    prepare_response_info,
    GenPK,
};
