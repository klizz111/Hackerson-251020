<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import SecureElGamal from '../utils/secureElgamal.js'
import { DASHBOARD_URL } from '../config.js'
import sm2 from '../utils/sm2.js'

const secureElgamal = new SecureElGamal(256)

const activeTab = ref('register')
const registerForm = reactive({ username: '', seed: '' })
const loginForm = reactive({ username: '', seed: '' })
const registerResult = reactive({ status: '', message: '', details: null })
const loginResult = reactive({ status: '', message: '' })
const generatedSeed = ref('')
const clipboardMessage = ref('')

const sessionData = ref(null)
const userContent = ref({ type: 'empty', status: '', message: '', data: null })
const sessionCopyStatus = ref('')

const updateForm = reactive({ nickname: '', age: '', contact_info: '', personal_info: '' })

const isLoggedIn = computed(() => !!sessionData.value)

function resetMessages() {
  registerResult.status = ''
  registerResult.message = ''
  registerResult.details = null
  loginResult.status = ''
  loginResult.message = ''
}

function switchTab(tab) {
  activeTab.value = tab
  resetMessages()
}

async function generateSeed() {
  const seed = secureElgamal.generateReadableSeed()
  registerForm.seed = seed
  generatedSeed.value = seed
  clipboardMessage.value = ''

  try {
    await navigator.clipboard.writeText(seed)
    clipboardMessage.value = '已复制到剪贴板'
  } catch (error) {
    console.error('无法复制种子到剪贴板:', error)
    clipboardMessage.value = '复制失败，请手动复制'
  }
}

async function handleRegister() {
  resetMessages()
  const username = registerForm.username.trim()
  const seed = registerForm.seed.trim()

  if (!username || !seed) {
    registerResult.status = 'error'
    registerResult.message = '请填写用户名和密码种子'
    return
  }

  const loginSeedKey = `zk_login_seed_${username}`
  localStorage.setItem(loginSeedKey, seed)

  registerResult.status = 'loading'
  registerResult.message = '正在注册账户，请稍等...'

  try {
    await secureElgamal.register(username, seed)
    registerResult.status = 'success'
    registerResult.message = '✅ 注册成功！'
    registerResult.details = {
      username,
      seed,
      tip: '💡 提示: 请牢记您的用户名和密码种子，这是您登录的唯一凭证。'
    }
  } catch (error) {
    registerResult.status = 'error'
    registerResult.message = `❌ 注册失败: ${error.message}`
  }
}

async function handleLogin() {
  loginResult.status = ''
  loginResult.message = ''

  const username = loginForm.username.trim()
  const seed = loginForm.seed.trim()

  if (!username || !seed) {
    loginResult.status = 'error'
    loginResult.message = '请填写用户名和密码种子'
    return
  }

  loginResult.status = 'loading'
  loginResult.message = '正在登录...'

  try {
    await secureElgamal.zkLogin(username, seed)
    loginResult.status = 'success'
    loginResult.message = '✅ 登录成功！正在跳转到匹配系统...'
    setTimeout(() => {
      window.location.href = DASHBOARD_URL
    }, 1000)
  } catch (error) {
    loginResult.status = 'error'
    loginResult.message = `❌ ${error.message}`
  }
}

function goToDashboard() {
  window.location.href = DASHBOARD_URL
}

function clearUserContent() {
  userContent.value = { type: 'empty', status: '', message: '', data: null }
}

async function loadUserInfo() {
  userContent.value = { type: 'loading', status: 'loading', message: '正在获取用户信息...', data: null }
  try {
    const info = await secureElgamal.getUserInfo()
    userContent.value = { type: 'userInfo', status: 'success', message: '', data: info }
  } catch (error) {
    userContent.value = { type: 'message', status: 'error', message: `❌ ${error.message}`, data: null }
  }
}

function showUpdateProfileForm() {
  updateForm.nickname = ''
  updateForm.age = ''
  updateForm.contact_info = ''
  updateForm.personal_info = ''
  userContent.value = { type: 'updateForm', status: '', message: '', data: null }
}

async function handleUpdateProfile() {
  const payload = {}
  if (updateForm.nickname.trim()) payload.nickname = updateForm.nickname.trim()
  if (updateForm.contact_info.trim()) payload.contact_info = updateForm.contact_info.trim()
  if (updateForm.personal_info.trim()) payload.personal_info = updateForm.personal_info.trim()
  if (updateForm.age !== '') {
    const parsedAge = Number.parseInt(updateForm.age, 10)
    if (!Number.isNaN(parsedAge)) {
      payload.age = parsedAge
    }
  }

  if (Object.keys(payload).length === 0) {
    userContent.value = {
      type: 'message',
      status: 'error',
      message: '请至少填写一个字段',
      data: null
    }
    return
  }

  userContent.value = { type: 'loading', status: 'loading', message: '正在更新资料...', data: null }

  try {
    const result = await secureElgamal.updateProfile(payload)
    userContent.value = { type: 'message', status: 'success', message: `✅ ${result.message}`, data: null }
    setTimeout(() => {
      loadUserInfo()
    }, 1000)
  } catch (error) {
    userContent.value = { type: 'message', status: 'error', message: `❌ ${error.message}`, data: null }
  }
}

async function validateCurrentSession() {
  userContent.value = { type: 'loading', status: 'loading', message: '正在验证Session...', data: null }
  try {
    const isValid = await secureElgamal.validateSession()
    if (isValid) {
      userContent.value = { type: 'message', status: 'success', message: '✅ Session有效，认证状态正常', data: null }
    } else {
      userContent.value = { type: 'message', status: 'error', message: '❌ Session已失效，请重新登录', data: null }
      setTimeout(() => {
        window.location.reload()
      }, 2000)
    }
  } catch (error) {
    userContent.value = { type: 'message', status: 'error', message: `❌ 验证失败: ${error.message}`, data: null }
  }
}

async function logoutUser() {
  if (!window.confirm('确定要登出吗？')) return
  try {
    await secureElgamal.logout()
    sessionData.value = null
    secureElgamal.cleanup()
    clearUserContent()
    registerForm.username = ''
    registerForm.seed = ''
    loginForm.username = ''
    loginForm.seed = ''
    sessionCopyStatus.value = ''
    alert('登出成功！')
    window.location.reload()
  } catch (error) {
    alert(error.message)
    window.location.reload()
  }
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text)
    sessionCopyStatus.value = 'Session ID 已复制'
  } catch (err) {
    const textArea = document.createElement('textarea')
    textArea.value = text
    document.body.appendChild(textArea)
    textArea.select()
    document.execCommand('copy')
    document.body.removeChild(textArea)
    sessionCopyStatus.value = 'Session ID 已复制'
  }
}

onMounted(async () => {
  const currentSession = secureElgamal.getCurrentSession()
  if (currentSession.sessionId && currentSession.username) {
    const isValid = await secureElgamal.validateSession(currentSession.sessionId)
    if (isValid) {
      secureElgamal.currentSessionId = currentSession.sessionId
      sessionData.value = {
        username: currentSession.username,
        sessionId: currentSession.sessionId,
        createdAt: new Date()
      }
      userContent.value = {
        type: 'message',
        status: 'info',
        message: '自动登录成功',
        data: null
      }
    } else {
      secureElgamal.clearSessionFromLocal()
    }
  }
})
</script>

<template>
  <div class="container">
    <div class="left-panel">
      <h1>{{ isLoggedIn ? '🎉 登录成功' : '🔐 login' }}</h1>
      <p v-if="!isLoggedIn">
        🛡️ 私钥永不离开本地设备<br />
        🔑 使用512位私钥
      </p>
      <p v-else>
        ✅ Session已建立<br />
        🔒 24小时有效期
      </p>
    </div>

    <div class="right-panel">
      <div v-if="!isLoggedIn">
        <div class="tabs">
          <button class="tab" :class="{ active: activeTab === 'register' }" @click="switchTab('register')">
            注册
          </button>
          <button class="tab" :class="{ active: activeTab === 'login' }" @click="switchTab('login')">
            登录
          </button>
        </div>

        <div v-show="activeTab === 'register'" class="tab-content active">
          <div class="form-group">
            <label for="regUsername">用户名</label>
            <input id="regUsername" v-model="registerForm.username" type="text" placeholder="输入用户名" />
          </div>

          <div class="form-group">
            <label for="regSeed">密码种子</label>
            <input
              id="regSeed"
              v-model="registerForm.seed"
              type="password"
              placeholder="输入密码种子（或自动生成）"
              class="seed-input"
            />
          </div>

          <button class="btn btn-secondary" type="button" @click="generateSeed">生成随机种子</button>
          <button class="btn" type="button" @click="handleRegister">注册账户</button>

          <div v-if="generatedSeed" class="seed-display">
            <strong>生成的安全种子(已复制到剪贴板):</strong><br />
            {{ generatedSeed }}
            <div v-if="clipboardMessage" class="info message-inline">{{ clipboardMessage }}</div>
          </div>

          <div v-if="registerResult.status" :class="['result', registerResult.status]">
            <div>{{ registerResult.message }}</div>
            <div v-if="registerResult.details" class="info">
              <strong>用户名:</strong> {{ registerResult.details.username }}<br />
              <strong>密码种子:</strong> {{ registerResult.details.seed }}<br />
              {{ registerResult.details.tip }}
            </div>
          </div>
        </div>

        <div v-show="activeTab === 'login'" class="tab-content active">
          <div class="form-group">
            <label for="loginUsername">用户名</label>
            <input id="loginUsername" v-model="loginForm.username" type="text" placeholder="输入用户名" />
          </div>

          <div class="form-group">
            <label for="loginSeed">密码种子</label>
            <input
              id="loginSeed"
              v-model="loginForm.seed"
              type="password"
              placeholder="输入密码种子"
              class="seed-input"
            />
          </div>

          <button class="btn" type="button" @click="handleLogin">登录</button>

          <div v-if="loginResult.status" :class="['result', loginResult.status]">
            {{ loginResult.message }}
          </div>
        </div>
      </div>

      <div v-else>
        <div class="user-header">
          <p>当前用户: <strong>{{ sessionData.username }}</strong></p>
          <p>
            Session ID:
            <span class="session-id">{{ sessionData.sessionId.slice(0, 16) }}...</span>
          </p>
        </div>

        <div class="user-actions">
          <button class="btn" type="button" @click="loadUserInfo">获取用户信息</button>
          <button class="btn" type="button" @click="goToDashboard">进入系统</button>
          <button class="btn" type="button" @click="showUpdateProfileForm">更新资料</button>
          <button class="btn btn-secondary" type="button" @click="validateCurrentSession">验证Session</button>
          <button class="btn btn-danger" type="button" @click="logoutUser">登出</button>
        </div>

        <div id="userContent">
          <div v-if="userContent.type === 'loading'" class="loading">{{ userContent.message }}</div>

          <div v-else-if="userContent.type === 'userInfo'" class="success">
            <h4>用户信息</h4>
            <p><strong>用户名:</strong> {{ userContent.data.username }}</p>
            <p><strong>昵称:</strong> {{ userContent.data.nickname || '未设置' }}</p>
            <p><strong>年龄:</strong> {{ userContent.data.age ?? '未设置' }}</p>
            <p><strong>联系方式:</strong> {{ userContent.data.contact_info || '未设置' }}</p>
            <p><strong>个人信息:</strong> {{ userContent.data.personal_info || '未设置' }}</p>
          </div>

          <div v-else-if="userContent.type === 'updateForm'" class="form-section">
            <h4>更新用户资料</h4>
            <div class="form-group">
              <label for="updateNickname">昵称</label>
              <input id="updateNickname" v-model="updateForm.nickname" type="text" placeholder="输入昵称" />
            </div>
            <div class="form-group">
              <label for="updateAge">年龄</label>
              <input id="updateAge" v-model="updateForm.age" type="number" placeholder="输入年龄" />
            </div>
            <div class="form-group">
              <label for="updateContact">联系方式</label>
              <input id="updateContact" v-model="updateForm.contact_info" type="text" placeholder="输入联系方式" />
            </div>
            <div class="form-group">
              <label for="updatePersonal">个人信息</label>
              <textarea id="updatePersonal" v-model="updateForm.personal_info" placeholder="输入个人信息"></textarea>
            </div>
            <button class="btn" type="button" @click="handleUpdateProfile">保存更新</button>
          </div>

          <div
            v-else-if="userContent.type === 'message' && userContent.message"
            :class="['result', userContent.status]"
          >
            {{ userContent.message }}
          </div>
        </div>

        <div class="session-info">
          <h4>Session信息</h4>
          <p><strong>Session ID:</strong> {{ sessionData.sessionId }}</p>
          <p><strong>创建时间:</strong> {{ sessionData.createdAt.toLocaleString() }}</p>
          <p><strong>有效期:</strong> 24小时</p>
          <button class="btn copy-btn" type="button" @click="copyToClipboard(sessionData.sessionId)">
            复制Session ID
          </button>
          <div v-if="sessionCopyStatus" class="info message-inline">{{ sessionCopyStatus }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.container {
  background: white;
  border-radius: 20px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  width: auto;
  max-width: 900px;
  min-height: 600px;
  display: flex;
  margin: 0 auto;
}

.left-panel {
  flex: 1;
  background: linear-gradient(45deg, #667eea, #764ba2);
  color: white;
  padding: 40px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
}

.left-panel h1 {
  font-size: 2.5em;
  margin-bottom: 20px;
  font-weight: 300;
}

.left-panel p {
  font-size: 1.1em;
  opacity: 0.9;
  line-height: 1.6;
}

.right-panel {
  flex: 1;
  padding: 40px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.tabs {
  display: flex;
  margin-bottom: 30px;
  border-bottom: 1px solid #eee;
}

.tab {
  flex: 1;
  padding: 15px 20px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  color: #666;
  border-bottom: 2px solid transparent;
  transition: all 0.3s ease;
}

.tab.active {
  color: #667eea;
  border-bottom-color: #667eea;
  font-weight: 600;
}

.tab-content {
  display: block;
}

.form-group {
  margin-bottom: 20px;
}

label {
  display: block;
  margin-bottom: 8px;
  color: #333;
  font-weight: 500;
}

input[type='text'],
input[type='password'],
input[type='number'],
textarea {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  font-size: 14px;
  transition: border-color 0.3s ease;
  background: #f8f9fa;
  font-family: 'Courier New', monospace;
  word-break: break-all;
  overflow-wrap: break-word;
}

.seed-input {
  font-family: 'Courier New', monospace;
  font-size: 13px;
  letter-spacing: 0.5px;
  line-height: 1.4;
  height: auto;
  min-height: 45px;
  resize: vertical;
}

.seed-display {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  padding: 8px 12px;
  margin-top: 5px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  word-break: break-all;
  color: #495057;
  line-height: 1.3;
}

.btn {
  width: 100%;
  padding: 14px 20px;
  background: linear-gradient(45deg, #667eea, #764ba2);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s ease;
  margin-bottom: 10px;
}

.btn:hover {
  transform: translateY(-2px);
}

.btn:disabled {
  background: #ccc;
  cursor: not-allowed;
  transform: none;
}

.btn-secondary {
  background: #6c757d;
  margin-bottom: 10px;
}

.result {
  margin-top: 20px;
  padding: 15px;
  border-radius: 8px;
  font-family: monospace;
  font-size: 12px;
  word-break: break-all;
  max-height: 200px;
  overflow-y: auto;
}

.success {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.error {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.info {
  background: #d1ecf1;
  color: #0c5460;
  border: 1px solid #bee5eb;
  margin-top: 10px;
  padding: 10px;
  border-radius: 6px;
}

.loading {
  color: #667eea;
  font-style: italic;
}

.copy-btn {
  width: auto;
  padding: 5px 10px;
  font-size: 12px;
  margin-top: 5px;
  margin-left: 0;
}

.user-header {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  border-left: 4px solid #667eea;
}

.user-header p {
  margin: 5px 0;
  font-size: 14px;
}

.session-id {
  font-family: monospace;
  background: #e9ecef;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 12px;
}

.user-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 20px;
}

.user-actions .btn {
  margin-bottom: 0;
  padding: 12px 16px;
  font-size: 14px;
}

.btn-danger {
  background: linear-gradient(45deg, #dc3545, #c82333);
}

.btn-danger:hover {
  background: linear-gradient(45deg, #c82333, #bd2130);
}

.form-section {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.form-section h4 {
  margin-bottom: 15px;
  color: #333;
}

.form-section .form-group {
  margin-bottom: 15px;
}

.form-section input,
.form-section textarea {
  background: white;
}

.session-info {
  background: #e3f2fd;
  padding: 15px;
  border-radius: 8px;
  margin-top: 20px;
  border: 1px solid #bbdefb;
  font-size: 13px;
}

.session-info h4 {
  color: #1976d2;
  margin-bottom: 10px;
}

.session-info p {
  margin: 5px 0;
  color: #555;
}

.message-inline {
  margin-top: 6px;
  font-size: 12px;
}

@media (max-width: 768px) {
  :global(body) {
    padding: 10px;
  }

  .container {
    flex-direction: column;
    max-width: 500px;
  }

  .left-panel {
    padding: 30px 20px;
  }

  .left-panel h1 {
    font-size: 2em;
  }

  .right-panel {
    padding: 30px 20px;
  }

  .user-actions {
    grid-template-columns: 1fr;
  }

  .user-header {
    padding: 15px;
  }

  .form-section {
    padding: 15px;
  }
}
</style>
