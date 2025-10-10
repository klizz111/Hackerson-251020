from ..ecc.sm2 import *
import random
from typing import Tuple
import hashlib

def GenPrivateKey() -> int:
    """生成私钥 d"""
    d = random.randint(1, N-2)
    return d

def GenFakePrivateKey(username1, username2) -> int:
    """基于用户名生成稳定的随机私钥 d"""
    key = f"{username1}::{username2}"
    h = hashlib.sha256(key.encode("utf-8")).hexdigest()
    d = int(h, 16) % (N - 2) + 1
    return d

def GenPubKey(d: int) -> PlainPoint2D:
    """生成公钥 pk = d*G"""
    pk = multiply(G, d)
    return pk

def enc(pk: PlainPoint2D, m: PlainPoint2D) -> Tuple[PlainPoint2D, PlainPoint2D]:
    """加密 c = (C1, C2)
        C1 = r*G
        C2 = m + r*pk = m + r*d*G
    """
    k = random.randint(1, N-2)
    C1 = multiply(G, k)
    C2 = add(m, multiply(pk, k))
    return (C1, C2)

def dec(d: int, c: Tuple[PlainPoint2D, PlainPoint2D]) -> PlainPoint2D:
    """解密 m = C2 - d*C1"""
    C1, C2 = c
    m = add(C2, multiply(C1, N - d))
    return m

def he_add(c1: Tuple[PlainPoint2D, PlainPoint2D], c2: Tuple[PlainPoint2D, PlainPoint2D]) -> Tuple[PlainPoint2D, PlainPoint2D]:
    """同态加法 c = c1 + c2
        C1 = C1_1 + C1_2
        C2 = C2_1 + C2_2
    """
    C1_1, C2_1 = c1
    C1_2, C2_2 = c2
    C1 = add(C1_1, C1_2)
    C2 = add(C2_1, C2_2)
    return (C1, C2)
