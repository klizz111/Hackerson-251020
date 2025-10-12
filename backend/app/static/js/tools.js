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

window.getUserInfo = getUserInfo;
window.updateProfile = updateProfile;
window.validateSession = validateSession;
window.tools = { logout };
window.getCurrentSession = getCurrentSession;
window.clearSessionFromLocal = clearSessionFromLocal;
