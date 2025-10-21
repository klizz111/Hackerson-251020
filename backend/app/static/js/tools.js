// 获取用户信息（需要有效session）
async function getUserInfo() {
    try {
        const sessionId = localStorage.getItem("zk_current_session");
        if (!sessionId) {
            throw new Error("未找到有效的session，请先登录");
        }

        const response = await fetch("/api/user_info", {
            method: "GET",
            headers: {
                Authorization: `Bearer ${sessionId}`,
            },
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "获取用户信息失败");
        }

        return await response.json();
    } catch (error) {
        throw new Error(`获取用户信息失败: ${error.message}`);
    }
}

// 更新用户资料
async function updateProfile(profileData) {
    try {
        const sessionId = localStorage.getItem("zk_current_session");
        if (!sessionId) {
            throw new Error("未找到有效的session，请先登录");
        }

        const response = await fetch("/api/update_profile", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${sessionId}`,
            },
            body: JSON.stringify(profileData),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "更新资料失败");
        }

        return await response.json();
    } catch (error) {
        throw new Error(`更新资料失败: ${error.message}`);
    }
}

// 验证session是否有效
async function validateSession(sessionId = null) {
    try {
        const useSessionId =
            sessionId || localStorage.getItem("zk_current_session");
        if (!useSessionId) return false;

        const response = await fetch("/api/validate_session", {
            method: "GET",
            headers: {
                Authorization: `Bearer ${useSessionId}`,
            },
        });

        if (!response.ok) return false;

        const data = await response.json();
        return data.valid;
    } catch (error) {
        console.warn("验证session失败:", error);
        return false;
    }
}

// 用户登出
async function logout() {
    try {
        const sessionId = localStorage.getItem("zk_current_session");
        if (!sessionId) {
            throw new Error("未找到有效的session");
        }

        const response = await fetch("/api/logout", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${sessionId}`,
            },
            body: JSON.stringify({}),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "登出失败");
        }

        // 清除本地存储的session信息
        clearSessionFromLocal();

        return await response.json();
    } catch (error) {
        // 即使服务器端登出失败，也清除本地session
        clearSessionFromLocal();
        throw new Error(`登出失败: ${error.message}`);
    }
}

// 获取当前用户和session
function getCurrentSession() {
    try {
        const sessionId = localStorage.getItem("zk_current_session");
        const username = localStorage.getItem("zk_current_user");
        return { sessionId, username };
    } catch (error) {
        return { sessionId: null, username: null };
    }
}
// 清除本地存储的session信息
function clearSessionFromLocal() {
    try {
        const username = localStorage.getItem("zk_current_user");
        if (username) {
            localStorage.removeItem(`zk_session_${username}`);
        }
        localStorage.removeItem("zk_current_session");
        localStorage.removeItem("zk_current_user");
    } catch (error) {
        console.warn("清除本地session失败:", error);
    }
}

const __SM4_CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-=,.";

/**
 * 生成 16 字符的随机 IV
 */
function gen_iv() {
    const len = 16;
    const chars = __SM4_CHARSET;
    let out = "";

    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
        const buf = new Uint8Array(len);
        crypto.getRandomValues(buf);
        for (let i = 0; i < len; i++) {
            out += chars[buf[i] % chars.length];
        }
    } else {
        // 降级方案（非加密安全）
        for (let i = 0; i < len; i++) {
            const r = Math.floor(Math.random() * chars.length);
            out += chars[r];
        }
    }
    return out;
}

/**
 * @param {bigint} seed
 * @returns {string} 长度为 16 的 key
 */
function gen_symkey(seed) {
    if (typeof seed !== "bigint") {
        throw new TypeError("gen_symkey 需要一个 BigInt 作为入参");
    }

    const MASK64 = 0xFFFFFFFFFFFFFFFFn;
    const chars = __SM4_CHARSET;

    // SplitMix64
    function next64(state) {
        state = (state + 0x9E3779B97F4A7C15n) & MASK64;
        let z = state;
        z = (z ^ (z >> 30n)) * 0xBF58476D1CE4E5B9n & MASK64;
        z = (z ^ (z >> 27n)) * 0x94D049BB133111EBn & MASK64;
        z ^= (z >> 31n);
        return [state, z & MASK64];
    }

    let state = (seed & MASK64);
    let out = "";
    for (let i = 0; i < 16; i++) {
        [state, rnd] = next64(state);
        const idx = Number(rnd % BigInt(chars.length)); 
        out += chars[idx];
    }
    return out;
}

window.gen_iv = gen_iv;
window.gen_symkey = gen_symkey;
window.getUserInfo = getUserInfo;
window.updateProfile = updateProfile;
window.validateSession = validateSession;
window.tools = { logout };
window.getCurrentSession = getCurrentSession;
window.clearSessionFromLocal = clearSessionFromLocal;
