# VPS 배포 (Vultr 서울 기준) — 앱 + Redis + Caddy(HTTPS) 한 서버

한 서버에서 `docker compose` 로 세 컨테이너를 띄웁니다.
- **app**: 게임 서버 (외부에 포트를 열지 않음)
- **redis**: 비밀번호 보호, 외부에 포트를 열지 않음, 디스크 저장 없음
- **caddy**: 80/443 을 받아 HTTPS 인증서를 자동 발급/갱신하고 app 으로 전달 (WebSocket 포함)

> 서비스 화면/요금은 바뀔 수 있습니다. 서버 크기는 **1GB RAM** 으로 시작하면 충분합니다.
> (이 규모에서 메모리를 직접 측정하지는 않았습니다. 부족하면 한 단계 올리세요.)

## 1. 서버 만들기
1. VPS 업체(예: Vultr)에서 **리전: 서울**, OS: **Ubuntu 24.04 LTS**(또는 22.04), 플랜: **1GB RAM** 으로 생성.
   결제 화면에서 **서울 리전의 월 요금과 포함 트래픽을 확인**하세요.
2. SSH 키를 등록하거나 root 비밀번호를 받아 접속: `ssh root@서버IP`
3. 서버 IP(IPv4)를 메모합니다.

## 2. 서버 기본 세팅
```bash
# 패키지 업데이트
apt update && apt upgrade -y

# 일반 사용자 만들기 (root 로 계속 쓰지 않기)
adduser deploy            # 비밀번호 설정
usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy   # root 의 SSH 키를 복사 (키로 접속 중이라면)

# 방화벽: SSH/HTTP/HTTPS 만 허용
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw enable

# Docker 설치 (공식 설치 스크립트)
curl -fsSL https://get.docker.com | sh
usermod -aG docker deploy
```
이후 `deploy` 계정으로 다시 접속합니다: `ssh deploy@서버IP`

> ⚠ **Docker 는 ufw 규칙을 우회**해서 컨테이너 포트를 직접 엽니다. 그래서 이 compose 는
> app/redis 에 `ports:` 를 아예 두지 않고 caddy 만 80/443 을 공개합니다. 이 파일을 고칠 때
> app/redis 에 `ports:` 를 추가하면 인터넷에 그대로 노출되니 추가하지 마세요.

## 3. 코드 받기와 설정
```bash
git clone https://github.com/dev-Rluan/touch_down_card_game.git
cd touch_down_card_game
cp .env.vps.example .env
nano .env
```
`.env` 에 채울 값:
- `DOMAIN` : 서비스 주소 (예: `play.rluan.dev`)
- `REDIS_PASSWORD` : `openssl rand -hex 24` 로 만든 값 (영문/숫자만)
- `COMPOSE_FILE=docker-compose.vps.yml` 은 예시 파일에 이미 들어 있으니 지우지 마세요. (저장소의 `docker-compose.yml` 은
  로컬 단독 실행용이라 VPS 에서는 `docker-compose.vps.yml` 을 써야 합니다.)
- 광고 값은 승인 전에는 비워둡니다.

값이 비어 있으면 `docker compose` 가 시작을 거부합니다(비밀번호 없는 Redis 가 뜨는 것을 막기 위함).

## 4. Cloudflare DNS 연결
Cloudflare → `rluan.dev` → DNS → Add record
- Type **A**, Name **play**, IPv4 address: 서버 IP
- **Proxy status: DNS only(회색 구름)** — Caddy 가 인증서를 발급하려면 요청이 서버로 바로 와야 합니다.
- 반영 확인: `dig +short play.rluan.dev` 가 서버 IP 를 반환.

(프록시 주황 구름은 처음에는 켜지 마세요. 켠 뒤에는 SSL/TLS 모드를 Full (strict) 로 두고
WebSocket 이 5분 이상 유지되는지 확인해야 합니다.)

## 5. 실행
```bash
docker compose up -d --build
docker compose ps                 # 세 서비스가 Up/healthy 인지
docker compose logs -f app        # [Startup] ... , 서버가 3000번 포트에서 시작되었습니다
docker compose logs -f caddy      # certificate obtained successfully
```
처음 빌드는 몇 분 걸립니다. DNS 가 반영된 뒤에 실행해야 인증서 발급이 성공합니다.
확인: 브라우저에서 `https://play.rluan.dev`, 그리고 `https://play.rluan.dev/healthz` → `{"status":"ok"}`.

## 6. 업데이트(재배포)
```bash
cd ~/touch_down_card_game
git pull
docker compose up -d --build
```
**재배포하면 진행 중인 방은 모두 사라집니다** (시작 시 방/접속자 정리). 사용자가 적은 시간대에 하세요.

## 7. 운영 메모
- **로그 보기**: `docker compose logs --tail=100 app`
- **재시작**: `docker compose restart app` / 서버 재부팅 시 `restart: unless-stopped` 로 자동 복구됩니다.
- **자동 보안 업데이트**: `sudo apt install unattended-upgrades` 후 `sudo dpkg-reconfigure -plow unattended-upgrades`
- **디스크 정리**: 가끔 `docker image prune -f`
- **백업**: Redis 는 디스크에 저장하지 않으므로 백업 대상이 없습니다. 인증서(`caddy_data` 볼륨)는
  삭제해도 자동 재발급되지만, 짧은 시간에 반복 삭제하면 발급 한도에 걸릴 수 있습니다.
- **서버 1대 전제**: 여러 대로 늘리려면 Socket.IO Redis 어댑터, 스티키 세션, Redis 락이 먼저 필요합니다.
- **도메인 변경**: `.env` 의 `DOMAIN` 만 바꾸고 `docker compose up -d` (코드 수정 불필요).

## 8. 문제 해결
| 증상 | 확인 |
|---|---|
| `https://` 접속이 안 되고 caddy 로그에 인증서 오류 | DNS 가 서버 IP 를 가리키는지(`dig`), Cloudflare 가 DNS only 인지, 80/443 방화벽 |
| app 이 계속 재시작 | `docker compose logs app` — `Redis 연결 시간 초과` 면 `.env` 의 `REDIS_PASSWORD` 확인 |
| `required variable ... is missing` | `.env` 파일이 같은 폴더에 있고 값이 채워져 있는지 |
| 접속은 되는데 게임이 끊김 | Cloudflare 프록시를 켰다면 DNS only 로 되돌려 비교 |
