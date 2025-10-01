from ..ecc.sm2 import *
import random
from Crypto.Hash import SHA256

def dlog_proof_ecc(x: int):
    """
    x: private key (integer)
    """
    # Step 1: Compute Y = x*G
    Y = multiply(G, x)
    
    # Step 2: Choose a random value r
    r = random.randint(1, N-1)
    
    # Step 3: Compute T = r*G
    T = multiply(G, r)
    
    # Step 4: Compute c = H(G, Y, T)
    hash_input = str(int(G[0])) + str(int(G[1])) + str(int(Y[0])) + str(int(Y[1])) + str(int(T[0])) + str(int(T[1]))
    c = int(SHA256.new(hash_input.encode()).hexdigest(), 16) % (N-1)
    
    # Step 5: Compute z = r + c*x (mod N-1)
    z = (r + c*x) % N
    
    # Step 6: Return the public key Y and the proof (c, z)
    return Y, (c, z)

def dlog_proof_verify_ecc(Y, proof):
    """
    Y: Public key (Point on the elliptic curve)
    proof: Tuple (c, z)
    """
    # Step 1: Unpack the proof
    c, z = proof
    
    # Step 2: Compute T = z*G - c*Y
    zG = multiply(G, z)
    cY = multiply(Y, c)

    # 计算 cY 的逆
    cY_neg = (cY[0],  -cY[1])
    
    # T = zG + (-cY)
    T = add(zG, cY_neg)
    
    # Step 3: Recompute challenge c' = H(G, Y, T)
    hash_input = str(int(G[0])) + str(int(G[1])) + str(int(Y[0])) + str(int(Y[1])) + str(int(T[0])) + str(int(T[1]))
    c_computed = int(SHA256.new(hash_input.encode()).hexdigest(), 16) % (N-1)
        
    # Step 4: Return True if c == c_computed, else False
    return c == c_computed

if __name__ == "__main__":
    private_key = random.randint(1, N-1)
    public_key = multiply(G, private_key)
    
    print("Private Key:", private_key)
    print("Public Key: (", public_key[0], ",", public_key[1], ")")
    
    Y, proof = dlog_proof_ecc(private_key)
    print("Proof:", proof)
    
    is_valid = dlog_proof_verify_ecc(Y, proof)
    print("Proof valid:", is_valid)