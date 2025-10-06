from utils.ecc_elgamal import *
from utils.ecc.sm2 import *

# 生成私钥
d = GenPrivateKey()
pk = GenPubKey(d)

# 双方进行密钥交换生成共享公私钥对ssk, spk
# 对于要加密的信息m，将m转换到曲线上为M
# 对于方案双方做出选择，若同意加密则选择O点Enc(pk,O)，不同意则选择曲线上的随机点R，End(pk,R)
"""加密 c = (C1, C2)
    C1 = k*G
    C2 = m + k*pk = m + k*d*G
"""
# 同时选定秘密数字v，计算V = v*G
# 服务端计算Enc(spk, M1) + Enc(spk, M2) + Enc(spk, V)
# 客户端解密Dec(ssk, Enc(spk, M1) + Enc(spk, M2) + Enc(spk, V)) = M1 + M2 + V
# 如果选择都为O点，则解密结果为V，否则结果为曲线上的随机点R

O = (0, 0)

# 1. 两人都同意
alice_choice = O
bob_choice = O
virtual_symetric_key = 1919810
virtual_point = multiply(G, virtual_symetric_key)
print(virtual_point)

enc_alice_choice = enc(pk, alice_choice)
enc_bob_choice = enc(pk, bob_choice)

res = he_add(he_add(enc_alice_choice, enc_bob_choice), enc(pk, virtual_point))
print(res)
dec_res = dec(d, res)
print(dec_res)


# 2. Alice 同意，Bob 不同意
alice_choice = O
bob_choice = multiply(G, GenPrivateKey())

enc_alice_choice = enc(pk, alice_choice)
enc_bob_choice = enc(pk, bob_choice)

res = he_add(he_add(enc_alice_choice, enc_bob_choice), enc(pk, virtual_point))
print(res)
dec_res = dec(d, res)
print(dec_res)





