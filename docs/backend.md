```sh
├── test.py
└── utils
    ├── ecc
    ├── ecc_elgamal
    └── others
```

# 注册登录

## 注册

用户生成用户名`username`和私钥`sk`，计算公钥`pk` = `sk` * G，计算证明`T = r*G`，`c = H(G || pk || T)`，`z = r + c*sk`，将`username, pk, T, z`发送给服务器。`/api/register`
```json
{
    "username": "alice",
    "pk_x": Y_x,
    "pk_y": Y_y,
    "c": c,
    "z": z
}
```

返回

```json
{
    "success":true/false,
    "message":"...",
    "session_id":"..."
}
```

## 登录

POST
```json
{
    "username": "alice",
    "T": [x1, y1],
    "z": z
}
```

RETURN

```json
{
    "success":true/false,
    "message":"...",
    "session_id":"..."
}
```

# done

1. ecc 基础构件
2. ecc_elgamal 同态加密

# todo

1. phe 半同态流程演示
2. flask 后端搭建