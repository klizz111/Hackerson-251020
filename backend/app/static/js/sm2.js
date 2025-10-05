// 基础 SM2/椭圆曲线（大整数使用 BigInt）数学运算移植自 sm2.py（不包含 ECDSA 签名/恢复）

const P = BigInt('0xFFFFFFFEFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF00000000FFFFFFFFFFFFFFFF');
const N = BigInt('0xFFFFFFFEFFFFFFFFFFFFFFFFFFFFFFFF7203DF6B21C6052B53BBF40939D54123');
const A = BigInt('0xFFFFFFFEFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF00000000FFFFFFFFFFFFFFFC');
const B = BigInt('0x28E9FA9E9D9F5E344D5A9E4BCF6509A7F39789F515AB8F92DDBCBD414D940E93');
const Gx = BigInt('0x32C4AE2C1F1981195F9904466A39C9948FE30BBFF2660BE1715A4589334C74C7');
const Gy = BigInt('0xBC3736A2F4F6779C59BDCEE36B692153D0A9877CC62A474002DF32E52139F0A0');
const G = [Gx, Gy];

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
    let lm = 1n, hm = 0n;
    let low = a, high = n;
    while (low > 1n) {
        const r = high / low;
        const nm = hm - lm * r;
        const newv = high - low * r;
        hm = lm; high = low;
        lm = nm; low = newv;
    }
    return mod(lm, n);
}

// 将二维点转为雅可比坐标 [x,y,z]
function toJacobian(p) {
    return [p[0], p[1], 1n];
}

// 从雅可比坐标转回二维点
function fromJacobian(p) {
    // 如果 z==0 表示无穷点，返回 (0,0)
    if (p[2] === 0n) return [0n, 0n];
    const zInv = inv(p[2], P);
    const zInv2 = mod(zInv * zInv, P);
    const zInv3 = mod(zInv2 * zInv, P);
    const x = mod(p[0] * zInv2, P);
    const y = mod(p[1] * zInv3, P);
    return [x, y];
}

// 雅可比点加倍
function jacobianDouble(p) {
    const [X1, Y1, Z1] = p;
    if (Y1 === 0n || Z1 === 0n && Y1 === 0n) {
        return [0n, 0n, 0n];
    }
    const Y1sq = mod(Y1 * Y1, P);
    const S = mod(4n * X1 * Y1sq, P);
    const M = mod(3n * X1 * X1 + A * (Z1 ** 4n), P);
    const nx = mod(M * M - 2n * S, P);
    const ny = mod(M * (S - nx) - 8n * (Y1sq * Y1sq), P);
    const nz = mod(2n * Y1 * Z1, P);
    return [nx, ny, nz];
}

// 雅可比点相加
function jacobianAdd(p, q) {
    const [X1, Y1, Z1] = p;
    const [X2, Y2, Z2] = q;
    // 处理无穷点
    if (Y1 === 0n) return q;
    if (Y2 === 0n) return p;

    const U1 = mod(X1 * (Z2 ** 2n), P);
    const U2 = mod(X2 * (Z1 ** 2n), P);
    const S1 = mod(Y1 * (Z2 ** 3n), P);
    const S2 = mod(Y2 * (Z1 ** 3n), P);

    if (U1 === U2) {
        if (S1 !== S2) {
            return [0n, 0n, 1n]; // 无穷点
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
    let e = BigInt(n);
    if (e === 0n || a[1] === 0n) return [0n, 0n, 1n];
    e = e % N;
    if (e < 0n) e += N;
    let result = [0n, 0n, 1n];
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
        bytes[i] = Number(num & 0xFFn);
        num >>= 8n;
    }
    return bytes;
}


function generateSeed() {
    // 生成32字节随机数据，转换为Base64格式（更短但仍然安全）
    const array = new Uint8Array(32);  // 32字节 = 256位
    crypto.getRandomValues(array);
    // 使用Base64编码，去掉填充字符，更紧凑
    return btoa(String.fromCharCode(...array)).replace(/[+/=]/g, '').substring(0, 32);
}

function generateReadableSeed() {
    const seed = this.generateSeed();
    // 每8个字符添加一个分隔符
    return seed.match(/.{1,8}/g).join('-');
}

// 使用种子派生256位私钥
async function derivePrivateKey(seed) {
    const encoder = new TextEncoder();
    const data = encoder.encode(seed);
    
    let hashBuffer = await crypto.subtle.digest('SHA-256', data);  
    
    const hashArray = new Uint8Array(hashBuffer);
    
    // 将哈希转换为大整数
    let x = 0n;
    for (let i = 0; i < hashArray.length; i++) {
        x = (x << 8n) + BigInt(hashArray[i]);
    }
    
    // 确保私钥在正确范围内 [1, P]
    return (x % (P - 1n)) + 1n;
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

    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
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
    }

    const response = await fetch('/api/register_ecc', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
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

    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
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
    }

    const response = await fetch('/api/login_ecc', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
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



function  saveSessionToLocal(username, sessionId) {
        try {
            const sessionData = {
                username: username,
                sessionId: sessionId,
                timestamp: Date.now()
            };
            localStorage.setItem(`zk_session_${username}`, JSON.stringify(sessionData));
            localStorage.setItem('zk_current_session', sessionId);
            localStorage.setItem('zk_current_user', username);
        } catch (error) {
            console.warn('无法保存session到本地存储:', error);
        }
    }

// 导出到全局对象
window.sm2 = {
    P, N, A, B, Gx, Gy, G,
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
    genPrivateKey,
    bigIntToBytes,
    generateSeed,
    generateReadableSeed,
    derivePrivateKey,
    register,
    login,
};

