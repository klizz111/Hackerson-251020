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
key_b = 1919810
key_b_point = x_2_point(key_b)
print(key_b_point)

enc_alice_choice = enc(pk, alice_choice)
enc_bob_choice = enc(pk, bob_choice)
enc_key_b_point = enc(pk, key_b_point)

# 同态
r = GenPrivateKey()
res = he_add(enc_alice_choice,enc_bob_choice)
res = [multiply(res[0],r),multiply(res[1],r)]
res = he_add(res,enc_key_b_point)

print(res)
dec_res = dec(d, res)
print(dec_res)


# 2. Alice 同意，Bob 不同意
alice_choice = O
r_b = GenPrivateKey()
r_b_p = x_2_point(r_b)
bob_choice = multiply(G,GenPrivateKey())

enc_alice_choice = enc(pk, alice_choice)
enc_bob_choice = enc(pk, bob_choice)

# 同态
r = GenPrivateKey()
res = he_add(enc_alice_choice,enc_bob_choice)
res = [multiply(res[0],r),multiply(res[1],r)]
res = he_add(res,enc_key_b_point)

print(res)
dec_res = dec(d, res)
print(dec_res)
print(dec_res[0]-r_b_p[0])
print(dec_res[1]-r_b_p[1])





