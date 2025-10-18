from utils.ecc_elgamal import *
from utils.ecc.sm2 import *

def con(input):
    return str(hex(input)[:10])+"..."

print("==================系统初始化=================")
# 生成私钥
d = GenPrivateKey()
print("私钥: ", con(d))
pk = GenPubKey(d)
print(f"公钥: {con(pk[0]), con(pk[1])}")

# 双方进行密钥交换生成共享公私钥对ssk, spk
# 对于要加密的信息m，将m转换到曲线上为M
# 对于方案双方做出选择，若同意加密则选择O点Enc(spk,O)，不同意则选择曲线上的随机点R，End(spk,R)
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
print("==================1、两人都同意=================")
alice_choice = O
print(f"Alice的选择: {con(alice_choice[0]), con(alice_choice[1])}")
bob_choice = O
print("Bob的选择: ", {con(bob_choice[0]), con(bob_choice[1])})
key_b = 1919810 # bob的密钥
key_b_point = x_2_point(key_b)
print("Bob的密钥点（仅在双方都同意时Alice可以获得）: ", con(key_b_point[0]), con(key_b_point[1]))

enc_alice_choice = enc(pk, alice_choice)
print(f"加密的Alice选择: {[con(enc_alice_choice[0][0]), con(enc_alice_choice[0][1])]}, {[con(enc_alice_choice[1][0]), con(enc_alice_choice[1][1])]}")
enc_bob_choice = enc(pk, bob_choice)
print(f"加密的Bob选择: {[con(enc_bob_choice[0][0]), con(enc_bob_choice[0][1])]}, {[con(enc_bob_choice[1][0]), con(enc_bob_choice[1][1])]}")
enc_key_b_point = enc(pk, key_b_point)
print(f"加密的Bob密钥点: {[con(enc_key_b_point[0][0]), con(enc_key_b_point[0][1])]}, {[con(enc_key_b_point[1][0]), con(enc_key_b_point[1][1])]}")

# 同态
r = GenPrivateKey()
res = he_add(enc_alice_choice,enc_bob_choice)
res = [multiply(res[0],r),multiply(res[1],r)]
res = he_add(res,enc_key_b_point)

print(f"同态加密结果: {[con(res[0][0]), con(res[0][1])]}, {[con(res[1][0]), con(res[1][1])]}", end="\n\n")

print("==================解密结果=================")
dec_res = dec(d, res)
print(f"解密结果: {con(dec_res[0]), con(dec_res[1])}")
print(f"解密得到的点是否匹配：{dec_res == key_b_point}")

# 2. Alice 同意，Bob 不同意
print("==================2、Alice 同意，Bob 不同意=================")
alice_choice = O
print("Alice的选择: ", {con(alice_choice[0]), con(alice_choice[1])})
bob_choice = multiply(G,GenPrivateKey())
print(f"Bob的选择: {con(bob_choice[0]), con(bob_choice[1])}")
print("Bob的密钥点（仅在双方都同意时Alice可以获得）: ", con(key_b_point[0]), con(key_b_point[1]))
enc_alice_choice = enc(pk, alice_choice)
print(f"加密的Alice选择: {[con(enc_alice_choice[0][0]), con(enc_alice_choice[0][1])]}, {[con(enc_alice_choice[1][0]), con(enc_alice_choice[1][1])]}")
enc_bob_choice = enc(pk, bob_choice)
print(f"加密的Bob选择: {[con(enc_bob_choice[0][0]), con(enc_bob_choice[0][1])]}, {[con(enc_bob_choice[1][0]), con(enc_bob_choice[1][1])]}")
print(f"加密的Bob密钥点: {[con(enc_key_b_point[0][0]), con(enc_key_b_point[0][1])]}, {[con(enc_key_b_point[1][0]), con(enc_key_b_point[1][1])]}")

# 同态
r = GenPrivateKey()
res = he_add(enc_alice_choice,enc_bob_choice)
res = [multiply(res[0],r),multiply(res[1],r)]
res = he_add(res,enc_key_b_point)
print(f"同态加密结果: {[con(res[0][0]), con(res[0][1])]}, {[con(res[1][0]), con(res[1][1])]}", end="\n\n")

print("==================解密结果=================")
dec_res = dec(d, res)
print(f"解密结果: {con(dec_res[0]), con(dec_res[1])}")
print(f"解密得到的点是否匹配：{dec_res == key_b_point}")
