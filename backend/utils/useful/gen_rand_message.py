import random

def generate_random_message(length=16, min_value=0, max_value=255):
    """
    生成随机密文字典
    
    Args:
        length (int): 密文长度，默认16
        min_value (int): 随机值最小值，默认0
        max_value (int): 随机值最大值，默认255
    
    Returns:
        dict: 包含索引和随机值的字典
    """
    message = {}
    for i in range(length):
        message[str(i)] = random.randint(min_value, max_value)
    return message

def generate_random_message_string(length=16, min_value=0, max_value=255):
    """
    生成随机密文字符串格式
    
    Args:
        length (int): 密文长度，默认16
        min_value (int): 随机值最小值，默认0
        max_value (int): 随机值最大值，默认255
    
    Returns:
        str: 字典格式的字符串
    """
    message = generate_random_message(length, min_value, max_value)
    return str(message)

def generate_random_hex_string(length=32):
    if length <= 0:
        return ""
    # 需要的字节数（每字节2个 hex 字符），为保证前导零，使用指定宽度格式化
    nbytes = (length + 1) // 2
    val = random.getrandbits(nbytes * 8)
    hexstr = f"{val:0{nbytes*2}x}"
    return hexstr[:length]

if __name__ == "__main__":
    print(generate_random_hex_string())

