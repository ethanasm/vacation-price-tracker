# Production Deployment

Self-hosted production runbook for Vacation Price Tracker (Compose project
`vpt-prod`). CI builds the images on merge to `main`; the `Deploy` workflow rolls
the self-hosted host forward. Everything below targets an **Ubuntu 22.04/24.04**
host. Run as a sudo-capable user and replace `app.example.com` and the placeholder
secrets.

The deploy directory is hardcoded to **`/opt/vacation-price-tracker`** (a git
checkout holding the gitignored `.env.prod`). The `Deploy` workflow runs
`runs-on: [self-hosted, vpt-prod]` and, for each deploy: verifies the tree → fetch
+ `git reset --hard <sha>` → GHCR login → `pnpm prod:pull` → `pnpm prod:up` →
`pnpm prod:db:migrate` → prune.

---

## 1. Install host tooling

```bash
# --- system packages ---
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg git

# --- Docker Engine + Compose v2 (official apt repo) ---
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# --- Node 20 (NodeSource) + pnpm via corepack ---
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo corepack enable
corepack prepare pnpm@9.12.1 --activate

# --- verify ---
docker --version && docker compose version
node --version && pnpm --version && git --version
```

## 2. Register the self-hosted runner (labels `self-hosted` + `vpt-prod`)

Get a registration **token**: GitHub → repo **Settings → Actions → Runners → New
self-hosted runner** (copy the `--token` value; it is short-lived). Then, on the
host:

```bash
# dedicated, non-root runner user that can talk to docker
sudo useradd -m -s /bin/bash ghrunner && sudo usermod -aG docker ghrunner
sudo su - ghrunner

mkdir actions-runner && cd actions-runner
# use the version/URL shown on the Runners page
curl -o actions-runner-linux-x64.tar.gz -L \
  https://github.com/actions/runner/releases/download/v2.330.0/actions-runner-linux-x64-2.330.0.tar.gz
tar xzf actions-runner-linux-x64.tar.gz

./config.sh \
  --url https://github.com/ethanasm/vacation-price-tracker \
  --token <RUNNER_TOKEN_FROM_GITHUB> \
  --name vpt-prod-1 \
  --labels vpt-prod \
  --work _work \
  --unattended
exit   # back to the sudo user

# install + start as a systemd service so it survives reboots
cd /home/ghrunner/actions-runner
sudo ./svc.sh install ghrunner
sudo ./svc.sh start
sudo ./svc.sh status
```

`self-hosted` is applied automatically; `--labels vpt-prod` adds the second label
the `Deploy` job matches on.

## 3. Clone the repo and create `.env.prod`

```bash
sudo mkdir -p /opt/vacation-price-tracker
sudo chown ghrunner:ghrunner /opt/vacation-price-tracker
sudo -u ghrunner git clone https://github.com/ethanasm/vacation-price-tracker /opt/vacation-price-tracker
cd /opt/vacation-price-tracker
sudo -u ghrunner cp .env.prod.example .env.prod

# generate the two required random secrets (>= 32 chars each)
echo "SECRET_KEY=$(openssl rand -hex 32)"
echo "ADMIN_QUERY_TOKEN=$(openssl rand -hex 32)"

# edit .env.prod and fill in:
#   POSTGRES_PASSWORD + matching DATABASE_URL (same password, host "db")
#   SECRET_KEY, ADMIN_QUERY_TOKEN (from above)
#   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET (step 5)
#   GROQ_API_KEY
#   FRONTEND_URL / BACKEND_URL / CORS_ALLOWED_ORIGINS (step 4)
sudo -u ghrunner nano .env.prod
```

GHCR login as the runner user (only needed for **manual** `pnpm prod:pull`; the
`Deploy` job logs in with its own `GITHUB_TOKEN`). `<GHCR_PAT>` is a classic PAT
with `read:packages`:

```bash
echo <GHCR_PAT> | sudo -u ghrunner docker login ghcr.io -u <github-user> --password-stdin
```

## 4. Public ingress via Cloudflare Tunnel

Single hostname with **path-based** routing: `/v1/*` → API container (loopback
`127.0.0.1:8001`), everything else → web container (`127.0.0.1:3001`). This makes
the OAuth callback `https://app.example.com/v1/auth/google/callback`.

```bash
# install cloudflared
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | \
  sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] \
  https://pkg.cloudflare.com/cloudflared any main" | \
  sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt-get update && sudo apt-get install -y cloudflared

# authenticate (opens a browser link; pick your zone), then create + route
cloudflared tunnel login
cloudflared tunnel create vpt-prod
cloudflared tunnel route dns vpt-prod app.example.com
cloudflared tunnel list   # note the tunnel UUID for the config below
```

Write `/etc/cloudflared/config.yml`:

```yaml
tunnel: <TUNNEL_UUID>
credentials-file: /root/.cloudflared/<TUNNEL_UUID>.json

ingress:
  # API: anything under /v1 (auth callback, SSE, trips API) → api container
  - hostname: app.example.com
    path: ^/v1/.*
    service: http://127.0.0.1:8001
  # everything else → Next.js web container
  - hostname: app.example.com
    service: http://127.0.0.1:3001
  - service: http_status:404
```

Install as a service:

```bash
sudo cloudflared service install
sudo systemctl enable --now cloudflared
sudo systemctl status cloudflared
```

Set the matching origins in `.env.prod`:

```
FRONTEND_URL=https://app.example.com
BACKEND_URL=https://app.example.com
CORS_ALLOWED_ORIGINS=https://app.example.com
```

## 5. Google OAuth credentials

OAuth web-client creation is console-only. In the
[Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials):

1. **OAuth consent screen** (if not done): External → add your email as a test
   user → save.
2. **Create credentials → OAuth client ID → Web application.**
3. **Authorized JavaScript origins:**
   ```
   https://app.example.com
   ```
4. **Authorized redirect URIs** (must equal `<BACKEND_URL>/v1/auth/google/callback`):
   ```
   https://app.example.com/v1/auth/google/callback
   ```
5. **Create**, then copy into `.env.prod`:
   ```
   GOOGLE_CLIENT_ID=...apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=...
   ```

## 6. First deploy (ordering matters)

Images don't exist until `Build Prod Images` runs on `main`:

1. Merge to `main`.
2. Wait for **Build Prod Images** to go green (pushes
   `ghcr.io/ethanasm/vpt-{web,api,worker}:{latest,<sha>}`).
3. **Deploy** then fires automatically (`workflow_run` after Build Prod Images on
   `main`) on the `vpt-prod` runner.

Deploy a specific commit manually: GitHub → Actions → **Deploy** → *Run workflow* →
enter the SHA. Or run it by hand on the host:

```bash
cd /opt/vacation-price-tracker
git fetch --all && git reset --hard <sha>
IMAGE_TAG=<sha> pnpm prod:pull
IMAGE_TAG=<sha> pnpm prod:up
IMAGE_TAG=<sha> pnpm prod:db:migrate
```

## 7. Verify

```bash
cd /opt/vacation-price-tracker
pnpm prod:ps                                    # all services healthy
curl -fsS http://127.0.0.1:8001/ready           # {"database":"ok","redis":"ok","temporal":"ok"}
curl -I https://app.example.com/v1/auth/google/login   # 3xx → accounts.google.com
pnpm prod:query "SELECT count(*) FROM trips"     # admin SQL endpoint works
```

## Ongoing ops

- **Logs / debugging:** see `.claude/skills/debugging-prod/SKILL.md`.
- **Image cleanup:** `prune-ghcr.yml` reaps old untagged image versions weekly — no
  action needed.
- **Loopback ports:** db `5434`, redis `6381`, temporal `7235`, api `8001`, web
  `3001` (bound to `127.0.0.1` — only reachable through the tunnel).

> Not yet implemented (robustness gap vs. the sibling stack): pre-migration DB
> backup, post-deploy health gate, and automatic image rollback on failure.
