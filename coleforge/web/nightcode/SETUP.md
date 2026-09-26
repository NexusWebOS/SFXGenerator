# NightCode Net: switching it on

nightcode.coletechsystems.com boots NightCode-DOS (BIOS, CONFIG.SYS, AUTOEXEC.BAT) and logs you in to
NightCode Net: accounts, a message board, WHO, FINGER and profiles. From the DOS prompt:

- `WIN` starts **NightCode Windows**, the whole NightCode desktop (NightAmp, WinNight, NightBrowser,
  NightOps, ...) in the browser, logged on as you. Your desktop (settings, My Documents, NightAmp
  playlists, ...) is saved in Supabase and follows you to any browser.
- `WEB address` opens NightBrowser on the desktop; `OPS` opens NightOps (Supabase, GitHub, Netlify).
- Shut Down on the desktop comes back to DOS; Log Off signs you out.

ColeForge.exe runs the same NightCode-DOS (NightCode Net program) and NightOps with the same account.

```
web/nightcode/
  index.html, css/, js/          NightCode-DOS (no build step, no dependencies)
    js/nc-api.js                 Supabase Auth + REST client
    js/nc-terminal.js            boot, login, shell, WIN / WEB / OPS
  build-config.js                Netlify build: assembles dist/ (the published site): config.js / config.json and the desktop
  netlify.toml                   CSPs, what's published, the function directory
  netlify/functions/ops.mjs      NightOps' GitHub + Netlify access (/api/ops), sysop only
  netlify/functions/albert.mjs   Albert's turns on the website (/api/albert): Claude (official SDK) or Groq
  package.json                   the functions' one dependency (@anthropic-ai/sdk)
  sync-shell.js                  copies the DOS engine into ColeForge (shell/js/nightcode-net/)
  supabase/migrations/           run both, in order
  supabase/functions/nightcode-login/   username sign-in
```

## 1. Supabase (project `NightCode`, wjfzxeqztbvnrnlgarvn)

1. **SQL Editor > New query**: paste and run `supabase/migrations/20260925000000_nightcode_net.sql`,
   then `supabase/migrations/20260925010000_nightcode_desktop.sql`. Both are safe to run again.
2. **Authentication > URL Configuration**
   - Site URL: `https://nightcode.coletechsystems.com/`
   - Redirect URLs: `https://nightcode.coletechsystems.com/`
3. **Authentication > Sign In / Providers > Email**: leave **Confirm email** on.
4. Username sign-in (recommended). With the [Supabase CLI](https://supabase.com/docs/guides/cli), in
   `coleforge/web/nightcode`:

   ```bash
   supabase link --project-ref wjfzxeqztbvnrnlgarvn
   supabase functions deploy nightcode-login --no-verify-jwt
   ```

   Until then, people sign in with their email address.
5. Sign in with GitHub (optional: `GITHUB` at the login prompt).
   - On GitHub: **Settings > Developer settings > OAuth Apps > New OAuth App**. Homepage
     `https://nightcode.coletechsystems.com`, callback `https://wjfzxeqztbvnrnlgarvn.supabase.co/auth/v1/callback`.
   - In Supabase: **Authentication > Sign In / Providers > GitHub**: on, with that app's Client ID and secret.
   - A GitHub sign-in makes a NightCode account named after the GitHub login.

**Project Settings > API Keys** has the `anon` `public` key Netlify needs. Never put the `service_role`
key in the site; the build refuses it.

## Fastest: deploy from GitHub Actions

`.github/workflows/nightcode-web.yml` builds and deploys the site and its functions to Netlify on every push
(or Actions > NightCode website > Run workflow). Add two repository secrets on GitHub (Settings > Secrets and
variables > Actions): `NETLIFY_AUTH_TOKEN` (Netlify > User settings > Applications > Personal access tokens) and
`NIGHTCODE_SUPABASE_ANON_KEY`. It creates the Netlify site `nightcode-coletech` if needed, attaches
nightcode.coletechsystems.com, and prints the live URL. Then point DNS at it: CNAME `nightcode` →
`nightcode-coletech.netlify.app` at your DNS host.

## 2. Netlify

coletechsystems.com's DNS is on Netlify DNS, so everything is done in Netlify.

1. **Add new site > Import an existing project > GitHub > NexusWebOS/SFXGenerator.** Branch: the one
   this is merged into. **Base directory:** `coleforge/web/nightcode`. The rest comes from `netlify.toml`
   (the Supabase URL is already in it).
2. **Site configuration > Environment variables:**

   | Key | Value | For |
   | --- | --- | --- |
   | `NIGHTCODE_SUPABASE_ANON_KEY` | the anon public key | everything |
   | `GITHUB_TOKEN` | a GitHub fine-grained token, read-only | NightOps: private repos (public ones work without it) |
   | `NETLIFY_API_TOKEN` | a Netlify personal access token | NightOps: sites, deploys, "Trigger deploy" |
   | `NIGHTOPS_GITHUB_OWNER` | optional, default `NexusWebOS` | which account's repos NightOps lists |
   | `ANTHROPIC_API_KEY` | an Anthropic API key (console.anthropic.com) | Albert on the website's desktop |
   | `GROQ_API_KEY` | optional: a free Groq API key (console.groq.com → API Keys) | Albert on free open models (GPT-OSS, Llama 4, ...) |
   | `ALBERT_ACCESS` | optional: `members` lets every signed-in member use Albert (default: sysop only) | Albert |

   The GitHub token: **GitHub > Settings > Developer settings > Fine-grained tokens**, resource owner
   NexusWebOS, only the repositories you want NightOps to show, permissions Contents: read and Metadata:
   read. Leave out repositories that hold private work data (Nexus II's staff records, for example):
   NightOps would show their files to whoever holds the sysop account.
   The Netlify token: **User settings > Applications > Personal access tokens**.
   Albert's turns run in a Netlify function and stream to the page as Claude writes them. Netlify still
   limits how long a function runs (about 10 seconds on the free plan, 26 s on paid plans), so very long
   answers or Deep/Deepest thinking can be cut off there; each tool step is its own request. ColeForge.exe
   has no such limit.
   Both stay on Netlify's servers; the browser never sees them.
3. **Domain management > Add a domain**: `nightcode.coletechsystems.com`. Netlify adds the DNS record
   and the HTTPS certificate.
4. Deploy.

## 3. You as sysop

Open the site, type `NEW` at `login:` and make your account. Then in the Supabase SQL Editor:

```sql
update public.nc_profiles set role = 'sysop' where lower(username) = 'yourname';
```

Sysops can `DEL` anyone's post and open NightOps.

## ColeForge.exe

Start > Programs > **NightCode Net** (Run: `nightcode`) and **NightOps** (Run: `ops`). NightCode Net reads
`https://nightcode.coletechsystems.com/config.json`, so it follows the site; NightOps uses the site's
`/api/ops`. Sign in once in NightCode Net and NightOps uses that session.

After changing `js/nc-api.js`, `js/nc-terminal.js` or `css/nightcode-dos.css`, run
`node coleforge/web/nightcode/sync-shell.js`; `tests/nightcode.test.js` fails if the copies differ.

## Trying it all locally (no Supabase, GitHub or Netlify needed)

```bash
cd coleforge
MOCK_SYSOPS=YourName node tests/mock-supabase.js 54321 &
(cd web/nightcode && NIGHTCODE_SUPABASE_URL=http://127.0.0.1:54321 NIGHTCODE_ALLOW_CUSTOM_URL=1 NIGHTCODE_SUPABASE_ANON_KEY=mock-anon-key node build-config.js)
NETLIFY_DEV_CONNECT=http://127.0.0.1:54321 NIGHTCODE_SUPABASE_URL=http://127.0.0.1:54321 NIGHTCODE_SUPABASE_ANON_KEY=mock-anon-key \
  node tests/netlify-dev.js 8200 --fake-upstreams
```

Open http://127.0.0.1:8200/. `netlify-dev.js` serves the site with `netlify.toml`'s headers and runs
`/api/ops`; `--fake-upstreams` answers GitHub and Netlify with sample data. (`dist/` is build output and git-ignored.)

## Commands

At `login:`: a username or email, `NEW`, `GITHUB`, `RESET`, `GUEST`.
Then: `WIN`, `WEB [address]`, `OPS`, `HELP`, `CLS`, `DIR`, `TYPE file`, `BOARD [name]`, `BOARDS`,
`POST [text]`, `DEL id`, `WHO`, `FINGER user`, `WHOAMI`, `PROFILE [NAME|BIO text]`, `PASSWD`,
`COLOR night|green|amber|white`, `MATRIX`, `VER`, `DATE`, `TIME`, `ECHO`, `LOGOUT`, `REBOOT`.
Esc or a click skips the boot; Tab completes commands; Up/Down recall them.
