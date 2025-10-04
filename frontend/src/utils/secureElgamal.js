import { resolveApiUrl } from '../config.js';

export default class SecureElGamal {
  constructor(bits = 512) {
    this.bits = 512; // 强制使用512位
    this.p = null;
    this.g = null;
    this.y = null;
    this.x = null;
    this.q = null;
    this.currentSessionId = null;
  }

  generateSeed() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array)).replace(/[+/=]/g, '').substring(0, 32);
  }

  generateReadableSeed() {
    const seed = this.generateSeed();
    return seed.match(/.{1,8}/g).join('-');
  }

  async register(username, seed) {
    const response = await fetch(resolveApiUrl('/api/register'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username })
    });

    if (!response.ok) {
      let errorMessage = '注册失败';
      try {
        const error = await response.json();
        errorMessage = error.error || errorMessage;
      } catch (_) {}
      throw new Error(errorMessage);
    }

    const data = await response.json();
    this.p = BigInt(data.p);
    this.g = BigInt(data.g);
    this.q = BigInt(data.q);

    this.x = await this.derivePrivateKey(seed);
    this.y = this.modPow(this.g, this.x, this.p);

    return await this.completeRegistration(username);
  }

  async completeRegistration(username) {
    const response = await fetch(resolveApiUrl('/api/complete_registration'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username,
        y: this.y.toString(),
      }),
    });

    if (!response.ok) {
      let errorMessage = '完成注册失败';
      try {
        const error = await response.json();
        errorMessage = error.error || errorMessage;
      } catch (_) {}
      throw new Error(errorMessage);
    }

    const data = await response.json();
    this.savePrivateKeyToLocal(username, this.x);

    return {
      success: true,
      message: data.message,
      public_key: {
        p: this.p.toString(),
        g: this.g.toString(),
        y: this.y.toString(),
      },
    };
  }

  async zkLogin(username, seed) {
    try {
      const challengeResponse = await fetch(resolveApiUrl('/api/login_challenge'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username }),
      });

      if (!challengeResponse.ok) {
        let errorMessage = '获取登录挑战失败';
        try {
          const error = await challengeResponse.json();
          errorMessage = error.error || errorMessage;
        } catch (_) {}
        throw new Error(errorMessage);
      }

      const challengeData = await challengeResponse.json();

      this.p = BigInt(challengeData.p);
      this.g = BigInt(challengeData.g);
      this.y = BigInt(challengeData.y);
      this.q = (this.p - 1n) / 2n;

      localStorage.setItem('system_p', this.p.toString());
      localStorage.setItem('system_g', this.g.toString());
      localStorage.setItem('system_y', this.y.toString());
      localStorage.setItem('system_q', this.q.toString());

      this.x = await this.derivePrivateKey(seed);
      this.savePrivateKeyToLocal(username, this.x);

      const proof = await this.generateDLogProof();

      const verifyResponse = await fetch(resolveApiUrl('/api/login_verify'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          proof_c: proof.c.toString(),
          proof_z: proof.z.toString(),
        }),
      });

      if (!verifyResponse.ok) {
        let errorMessage = '登录验证失败';
        try {
          const error = await verifyResponse.json();
          errorMessage = error.error || errorMessage;
        } catch (_) {}
        throw new Error(errorMessage);
      }

      const verifyData = await verifyResponse.json();

      if (verifyData.session_id) {
        this.currentSessionId = verifyData.session_id;
        this.saveSessionToLocal(username, verifyData.session_id);
      }

      return {
        success: true,
        message: verifyData.message,
        session_id: verifyData.session_id,
        user_info: verifyData.user_info,
      };
    } catch (error) {
      throw new Error(`登录失败: ${error.message}`);
    }
  }

  savePrivateKeyToLocal(username, privateKey) {
    try {
      const keyData = {
        username,
        privateKey: privateKey.toString(),
        timestamp: Date.now(),
      };

      const encodedData = btoa(JSON.stringify(keyData));
      localStorage.setItem(`zk_key_${username}`, encodedData);
    } catch (error) {
      console.warn('无法保存私钥到本地存储:', error);
    }
  }

  getPrivateKeyFromLocal(username) {
    try {
      const encodedData = localStorage.getItem(`zk_key_${username}`);
      if (!encodedData) return null;

      const keyData = JSON.parse(atob(encodedData));
      if (keyData.username !== username) return null;

      const maxAge = 30 * 24 * 60 * 60 * 1000;
      if (Date.now() - keyData.timestamp > maxAge) {
        this.clearPrivateKeyFromLocal(username);
        return null;
      }

      return BigInt(keyData.privateKey);
    } catch (error) {
      console.warn('无法从本地存储获取私钥:', error);
      return null;
    }
  }

  clearPrivateKeyFromLocal(username) {
    try {
      localStorage.removeItem(`zk_key_${username}`);
      localStorage.removeItem(`zk_session_${username}`);
      if (localStorage.getItem('zk_current_user') === username) {
        localStorage.removeItem('zk_current_session');
        localStorage.removeItem('zk_current_user');
      }
    } catch (error) {
      console.warn('无法清除本地私钥和session:', error);
    }
  }

  saveSessionToLocal(username, sessionId) {
    try {
      const sessionData = {
        username,
        sessionId,
        timestamp: Date.now(),
      };
      localStorage.setItem(`zk_session_${username}`, JSON.stringify(sessionData));
      localStorage.setItem('zk_current_session', sessionId);
      localStorage.setItem('zk_current_user', username);
    } catch (error) {
      console.warn('无法保存session到本地存储:', error);
    }
  }

  getSessionFromLocal(username) {
    try {
      const sessionDataStr = localStorage.getItem(`zk_session_${username}`);
      if (!sessionDataStr) return null;

      const sessionData = JSON.parse(sessionDataStr);
      if (sessionData.username !== username) return null;

      return sessionData.sessionId;
    } catch (error) {
      console.warn('无法从本地存储获取session:', error);
      return null;
    }
  }

  getCurrentSession() {
    try {
      const sessionId = localStorage.getItem('zk_current_session');
      const username = localStorage.getItem('zk_current_user');
      return { sessionId, username };
    } catch (error) {
      return { sessionId: null, username: null };
    }
  }

  async validateSession(sessionId = null) {
    try {
      const useSessionId = sessionId || this.currentSessionId || localStorage.getItem('zk_current_session');
      if (!useSessionId) return false;

      const response = await fetch(resolveApiUrl('/api/validate_session'), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${useSessionId}`,
        },
      });

      if (!response.ok) return false;

      const data = await response.json();
      return data.valid;
    } catch (error) {
      console.warn('验证session失败:', error);
      return false;
    }
  }

  async getUserInfo() {
    try {
      const sessionId = this.currentSessionId || localStorage.getItem('zk_current_session');
      if (!sessionId) {
        throw new Error('未找到有效的session，请先登录');
      }

      const response = await fetch(resolveApiUrl('/api/user_info'), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${sessionId}`,
        },
      });

      if (!response.ok) {
        let errorMessage = '获取用户信息失败';
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } catch (_) {}
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`获取用户信息失败: ${error.message}`);
    }
  }

  async updateProfile(profileData) {
    try {
      const sessionId = this.currentSessionId || localStorage.getItem('zk_current_session');
      if (!sessionId) {
        throw new Error('未找到有效的session，请先登录');
      }

      const response = await fetch(resolveApiUrl('/api/update_profile'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionId}`,
        },
        body: JSON.stringify(profileData),
      });

      if (!response.ok) {
        let errorMessage = '更新资料失败';
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } catch (_) {}
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`更新资料失败: ${error.message}`);
    }
  }

  async logout() {
    try {
      const sessionId = this.currentSessionId || localStorage.getItem('zk_current_session');
      if (!sessionId) {
        throw new Error('未找到有效的session');
      }

      const response = await fetch(resolveApiUrl('/api/logout'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionId}`,
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        let errorMessage = '登出失败';
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } catch (_) {}
        throw new Error(errorMessage);
      }

      this.clearSessionFromLocal();
      return await response.json();
    } catch (error) {
      this.clearSessionFromLocal();
      throw new Error(`登出失败: ${error.message}`);
    }
  }

  clearSessionFromLocal() {
    try {
      const username = localStorage.getItem('zk_current_user');
      if (username) {
        localStorage.removeItem(`zk_session_${username}`);
      }
      localStorage.removeItem('zk_current_session');
      localStorage.removeItem('zk_current_user');
      this.currentSessionId = null;
    } catch (error) {
      console.warn('清除本地session失败:', error);
    }
  }

  async generateDLogProof() {
    if (!this.x || !this.g || !this.p) {
      throw new Error('Missing required parameters for proof generation');
    }

    const r = this.randomBigInt(1n, this.p - 1n);
    const t = this.modPow(this.g, r, this.p);

    const hashInput = this.g.toString() + this.y.toString() + t.toString();
    const c = await this.hashToBigInt(hashInput, this.p - 1n);

    const z = (r + c * this.x) % (this.p - 1n);

    return { c, z };
  }

  async derivePrivateKey(seed) {
    const encoder = new TextEncoder();
    const data = encoder.encode(seed + this.p.toString() + this.g.toString() + this.q.toString());

    const hashBuffer = await crypto.subtle.digest('SHA-512', data);
    const hashArray = new Uint8Array(hashBuffer);

    let x = 0n;
    for (let i = 0; i < hashArray.length; i++) {
      x = (x << 8n) + BigInt(hashArray[i]);
    }

    return (x % (this.q - 1n)) + 1n;
  }

  async hashSeed(seed) {
    const encoder = new TextEncoder();
    const data = encoder.encode(seed);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hashBuffer);
    return Array.from(hashArray, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  async hashToBigInt(input, modulus) {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hashBuffer);

    let result = 0n;
    for (let i = 0; i < hashArray.length; i++) {
      result = (result << 8n) + BigInt(hashArray[i]);
    }

    return result % modulus;
  }

  randomBigInt(min, max) {
    const range = max - min + 1n;
    const bitLength = range.toString(2).length;
    const byteLength = Math.ceil(bitLength / 8);

    while (true) {
      const randomBytes = new Uint8Array(byteLength);
      crypto.getRandomValues(randomBytes);

      let randomBigInt = 0n;
      for (let i = 0; i < randomBytes.length; i++) {
        randomBigInt = (randomBigInt << 8n) + BigInt(randomBytes[i]);
      }

      randomBigInt = randomBigInt % range;
      const result = min + randomBigInt;
      if (result <= max) {
        return result;
      }
    }
  }

  modPow(base, exponent, modulus) {
    if (modulus === 1n) return 0n;

    let result = 1n;
    base = base % modulus;

    while (exponent > 0n) {
      if (exponent % 2n === 1n) {
        result = (result * base) % modulus;
      }
      exponent = exponent >> 1n;
      base = (base * base) % modulus;
    }

    return result;
  }

  cleanup() {
    this.x = null;
    this.p = null;
    this.g = null;
    this.y = null;
    this.q = null;
  }
}
