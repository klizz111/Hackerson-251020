from utils.ecc_elgamal import *
from utils.ecc.sm2 import *

# 生成私钥
d = GenPrivateKey()
pk = GenPubKey(d)

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





