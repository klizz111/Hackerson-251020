import random
import hashlib
import secrets

def generate_random_message(length=16, min_value=0, max_value=255):
    message = {}
    for i in range(length):
        message[str(i)] = random.randint(min_value, max_value)
    return message

def generate_random_message_string(length=16, min_value=0, max_value=255):
    message = generate_random_message(length, min_value, max_value)
    return str(message)

def generate_random_hex_string(username1: str = "", username2: str = "", length=32):
    if length <= 0:
        return ""
    key = f"{username1}::{username2}"
    # 每次 SHA-256 产生 64 个 hex 字符，按需拼接直到满足长度
    parts = []
    counter = 0
    while sum(len(p) for p in parts) < length:
        h = hashlib.sha256(f"{key}|{counter}".encode("utf-8")).hexdigest()
        parts.append(h)
        counter += 1
    return ("".join(parts))[:length]

__SM4_CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-=,.";

def gen_iv():
    """
    生成 16 字符的随机 IV
    """
    length = 16
    chars = __SM4_CHARSET
    out = ""

    try:
        # 使用加密安全的随机数生成器
        out = ''.join(secrets.choice(chars) for _ in range(length))
    except NotImplementedError:
        # 降级方案（非加密安全）
        import random
        out = ''.join(random.choice(chars) for _ in range(length))
    
    return out

def gen_symkey(username1: str, username2: str, seed: int) -> str:
    """
    :param username1: 第一个用户名
    :param username2: 第二个用户名
    :param seed: 整数种子
    :return: 长度为 16 的对称密钥
    """
    if not isinstance(seed, int):
        raise TypeError("gen_symkey 需要一个整数作为入参")

    MASK64 = (1 << 64) - 1
    chars = __SM4_CHARSET

    # 将用户名和种子组合成初始状态
    key = f"{username1}::{username2}"
    initial_state = int(hashlib.sha256(key.encode("utf-8")).hexdigest(), 16) ^ seed

    def next64(state):
        state = (state + 0x9E3779B97F4A7C15) & MASK64
        z = state
        z = (z ^ (z >> 30)) * 0xBF58476D1CE4E5B9 & MASK64
        z = (z ^ (z >> 27)) * 0x94D049BB133111EB & MASK64
        z ^= (z >> 31)
        return state, z & MASK64

    state = initial_state & MASK64
    out = ""
    for _ in range(16):
        state, rnd = next64(state)
        idx = rnd % len(chars)
        out += chars[idx]
    
    return out

if __name__ == "__main__":
    print(generate_random_hex_string())
    print(gen_iv())
    print(gen_symkey("user1", "user2", 123456789))

