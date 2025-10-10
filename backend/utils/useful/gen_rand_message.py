import random
import hashlib

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

if __name__ == "__main__":
    print(generate_random_hex_string())

