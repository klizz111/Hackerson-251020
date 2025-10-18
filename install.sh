#!/usr/bin/env bash
set -euo pipefail

# 日志
info() { echo "[INFO] $*"; }
warn() { echo "[WARN] $*" >&2; }
err() { echo "[ERROR] $*" >&2; exit 1; }

# 检查权限
SUDO=""
if [ "$(id -u)" -ne 0 ]; then
	SUDO="sudo"
	info "Not running as root - will use sudo where needed"
fi

# 检测包管理器
detect_pkg_mgr() {
	if command -v apt-get >/dev/null 2>&1; then
		echo "apt"
	elif command -v dnf >/dev/null 2>&1; then
		echo "dnf"
	elif command -v yum >/dev/null 2>&1; then
		echo "yum"
	elif command -v pacman >/dev/null 2>&1; then
		echo "pacman"
	elif command -v zypper >/dev/null 2>&1; then
		echo "zypper"
	else
		echo ""
	fi
}

PKG_MGR=$(detect_pkg_mgr)
if [ -z "$PKG_MGR" ]; then
	warn "未检测到支持的包管理器，请手动安装依赖（gmssl/nginx）"
fi

pkg_install() {
	pkgs="$*"
	case "$PKG_MGR" in
		apt) $SUDO apt-get update && $SUDO apt-get install -y $pkgs ;;
		dnf) $SUDO dnf install -y $pkgs ;;
		yum) $SUDO yum install -y $pkgs ;;
		pacman) $SUDO pacman -S --noconfirm $pkgs ;;
		zypper) $SUDO zypper install -y $pkgs ;;
		*) warn "无法自动安装包: $pkgs (无已知包管理器)"; return 1 ;;
	esac
}

# 检查/安装 gmssl
install_gmssl() {
	if command -v gmssl >/dev/null 2>&1; then
		info "gmssl 已存在: $(command -v gmssl)"
		return 0
	fi

	info "尝试通过包管理器安装 gmssl"
	if [ -n "$PKG_MGR" ]; then
		case "$PKG_MGR" in
			apt) pkg_install build-essential git perl pkg-config libssl-dev gmssl || true ;;
			*) pkg_install git perl pkgconfig openssl-devel || true ;;
		esac
	fi

	if command -v gmssl >/dev/null 2>&1; then
		info "gmssl 安装成功（包管理器）"
		return 0
	fi

	warn "包管理器未提供 gmssl，尝试从源码编译安装（需要较长时间）"
	tmpdir=$(mktemp -d)
	trap 'rm -rf "$tmpdir"' EXIT
	# 安装构建依赖
	if [ -n "$PKG_MGR" ]; then
		case "$PKG_MGR" in
			apt) pkg_install build-essential git perl pkg-config libssl-dev || true ;;
			dnf|yum) pkg_install make gcc git perl pkgconfig openssl-devel || true ;;
			pacman) pkg_install base-devel git perl openssl || true ;;
			zypper) pkg_install -y make gcc git perl libopenssl-devel || true ;;
		esac
	fi

	info "克隆 GmSSL 源码到 $tmpdir/GmSSL"
	git clone --depth 1 https://github.com/guanzhi/GmSSL.git "$tmpdir/GmSSL"
	cd "$tmpdir/GmSSL"
	# 初始化子模块（如果有）
	git submodule update --init --recursive || true

	info "配置并编译 GmSSL（请耐心等待）"
	# 尝试常见的构建步骤
	./config || true
	make -j"$(nproc)" || true
	$SUDO make install || true
	$SUDO ldconfig || true

	if command -v gmssl >/dev/null 2>&1; then
		info "gmssl 已从源码编译并安装"
		return 0
	else
		err "gmssl 安装失败，请检查日志或手动安装"
	fi
}

# 检查/安装 openssl
install_openssl() {
	if command -v openssl >/dev/null 2>&1; then
		info "openssl 已存在: $(command -v openssl)"
		return 0
	fi

	if [ -z "$PKG_MGR" ]; then
		warn "无法自动安装 openssl（无已知包管理器），请手动安装"
		return 1
	fi

	info "尝试通过包管理器安装 openssl"
	case "$PKG_MGR" in
		apt) pkg_install openssl ;;
		dnf|yum) pkg_install openssl ;;
		pacman) pkg_install openssl ;;
		zypper) pkg_install openssl ;;
		*) warn "无法自动安装 openssl: 未知包管理器" ;;
	esac

	if command -v openssl >/dev/null 2>&1; then
		info "openssl 安装成功"
		return 0
	else
		warn "通过包管理器未能安装 openssl，请手动安装"
		return 1
	fi
}

# 生成自签证书
generate_certs() {
	dest_dir="$(pwd)/certs"
	mkdir -p "$dest_dir"
	info "证书目录：$dest_dir"

	if ! command -v openssl >/dev/null 2>&1; then
		warn "openssl 未安装，尝试安装"
		install_openssl || warn "无法安装 openssl，请手动安装后重试"
	fi

	info "使用 openssl 生成私钥"
	openssl genrsa -out "$dest_dir/server.key" 2048

	info "生成自签名证书 server.crt"
	openssl req -x509 -nodes -days 365 \
		-new -key "$dest_dir/server.key" \
		-out "$dest_dir/server.crt" \
		-subj "/CN=localhost"

	info "生成证书完成：$dest_dir/server.key, $dest_dir/server.crt"
}

# 检查/安装 nginx
install_nginx() {
	if command -v nginx >/dev/null 2>&1; then
		info "nginx 已存在: $(command -v nginx)"
		return 0
	fi

	if [ -z "$PKG_MGR" ]; then
		err "无法自动安装 nginx（无已知包管理器），请手动安装"
	fi

	info "通过包管理器安装 nginx"
	case "$PKG_MGR" in
		apt) pkg_install nginx ;;
		dnf|yum) pkg_install nginx ;;
		pacman) pkg_install nginx ;;
		zypper) pkg_install nginx ;;
		*) warn "未支持的包管理器：$PKG_MGR";;
	esac

	if ! command -v nginx >/dev/null 2>&1; then
		err "nginx 安装失败，请手动检查"
	fi
	info "nginx 安装完成"
}

# 配置 nginx 文件并启动
configure_nginx() {
	certs_src="$(pwd)/certs"
	if [ ! -d "$certs_src" ]; then
		err "证书目录不存在：$certs_src"
	fi

	# 目标位置
	SSL_CERT_DIR="/etc/ssl/certs"
	SSL_KEY_DIR="/etc/ssl/private"
	$SUDO mkdir -p "$SSL_CERT_DIR" "$SSL_KEY_DIR"
	$SUDO cp -f "$certs_src/server.crt" "$SSL_CERT_DIR/zkmatch.crt"
	$SUDO cp -f "$certs_src/server.key" "$SSL_KEY_DIR/zkmatch.key"
	$SUDO chmod 644 "$SSL_CERT_DIR/zkmatch.crt"
	$SUDO chmod 600 "$SSL_KEY_DIR/zkmatch.key"

	NGINX_CONF="/etc/nginx/conf.d/zkmatch_ssl.conf"
	info "写入 nginx 配置到 $NGINX_CONF"
	$SUDO bash -c "cat > $NGINX_CONF <<'EOF'
server {
	listen 443 ssl;
	server_name localhost;

	ssl_certificate     /etc/ssl/certs/zkmatch.crt;
	ssl_certificate_key /etc/ssl/private/zkmatch.key;

	# 建议的 SSL 配置（可按需调整）
	ssl_protocols TLSv1.2 TLSv1.3;
	ssl_ciphers HIGH:!aNULL:!MD5;

	location / {
        proxy_pass http://0.0.0.0:5000/;
	}
}
EOF"

	# 测试 nginx 配置并重启/启动
	info "测试 nginx 配置"
	if ! $SUDO nginx -t; then
		warn "nginx 配置测试失败，请检查 $NGINX_CONF"
	fi

	info "重启或启动 nginx"
	# 尝试 systemctl，回退到 service 或直接 nginx
	if command -v systemctl >/dev/null 2>&1 && systemctl --version >/dev/null 2>&1; then
		$SUDO systemctl restart nginx || $SUDO systemctl start nginx || true
	else
		$SUDO service nginx restart || $SUDO nginx -s reload || $SUDO nginx || true
	fi

	info "nginx 启动完成，监听 443（如果没有报错）"
}

main() {
	info "开始执行安装脚本"
	install_openssl
	generate_certs
	install_nginx
	configure_nginx
	info "全部完成。"
}

main "$@"