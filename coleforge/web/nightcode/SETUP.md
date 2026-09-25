# NightCode Net: switching it on

nightcode.coletechsystems.com boots NightCode-DOS (BIOS, CONFIG.SYS, AUTOEXEC.BAT), then logs you in to
NightCode Net: accounts, a message board, WHO, FINGER and profiles. ColeForge.exe's **NightCode Net**
program runs the same terminal against the same accounts.

```
web/nightcode/
  index.html, css/, js/          the site (no build step, no dependencies)
    js/nc-api.js                 Supabase Auth + REST client
    js/nc-terminal.js            NightCode-DOS: boot, login, shell
  build-config.js                Netlify build: writes config.js / config.json from environment variables
  netlify.toml                   headers (CSP), backend source kept off the site
  sync-shell.js                  copies the engine into ColeForge (shell/js/nightcode-net/)
  supabase/migrations/…sql       tables, row level security, functions
  supabase/functions/nightcode-login/   username sign-in
```

Four steps, in order. Each one is done once.

## 1. A Supabase project of its own

Use a **new** Supabase project for NightCode (Supabase > New project, e.g. `nightcode`). Don't use the
Nexus II project: Nexus II approves every new sign-up as a Nexus viewer, so
anyone who made a NightCode account there could read Nexus data. The migration checks for this and stops
if it finds Nexus tables.

In the new project:

1. **SQL Editor > New query**: paste all of `supabase/migrations/20260925000000_nightcode_net.sql` and
   run it. It's safe to run twice.
2. **Authentication > URL Configuration**
   - Site URL: `https://nightcode.coletechsystems.com/`
   - Redirect URLs: `https://nightcode.coletechsystems.com/`
3. **Authentication > Sign In / Providers > Email**: leave **Confirm email** on. New accounts get an
   activation link, which opens the site and signs them in.
4. Username sign-in (optional, recommended). With the [Supabase CLI](https://supabase.com/docs/guides/cli)
   in `coleforge/web/nightcode`:

   ```bash
   supabase link --project-ref <your-nightcode-project-ref>
   supabase functions deploy nightcode-login --no-verify-jwt
   ```

   Until it's deployed, people sign in with their email address instead of their username.

**Project Settings > API** has the two values Netlify needs: the Project URL and the `anon` `public` key.
Never use the `service_role` key anywhere in the site; the build refuses it.

## 2. The Netlify site

coletechsystems.com's DNS is already on Netlify DNS, so the subdomain is set up in Netlify too.

1. **Add new site > Import an existing project > GitHub > NexusWebOS/SFXGenerator.**
2. Branch: the branch this is merged into. **Base directory:** `coleforge/web/nightcode`. Build command
   and publish directory come from `netlify.toml`.
3. **Site configuration > Environment variables:**

   | Key | Value |
   | --- | --- |
   | `NIGHTCODE_SUPABASE_URL` | `https://<ref>.supabase.co` |
   | `NIGHTCODE_SUPABASE_ANON_KEY` | the anon public key |

4. Deploy. Without the variables the site still boots, in guest mode.

## 3. nightcode.coletechsystems.com

**Domain management > Add a domain** > `nightcode.coletechsystems.com`. Because Netlify DNS hosts
coletechsystems.com, Netlify adds the record and issues the HTTPS certificate itself. A wildcard `*` record, if there is one, doesn't get in the way: the specific `nightcode` record wins.

## 4. You as sysop

Open the site, type `NEW` at `login:`, and make your account. Then in the Supabase SQL Editor:

```sql
update public.nc_profiles set role = 'sysop' where lower(username) = 'yourname';
```

Sysops can `DEL` anyone's post.

## ColeForge.exe

Start > Programs > **NightCode Net** (or type `nightcode` in Run). It fetches
`https://nightcode.coletechsystems.com/config.json` to learn which Supabase project to use, so it follows
the site with nothing to set up. Right-click the terminal for **Server settings** (a different project)
and **Reconnect**. EXIT closes it.

After changing `js/nc-api.js`, `js/nc-terminal.js` or `css/nightcode-dos.css`, run
`node coleforge/web/nightcode/sync-shell.js` so ColeForge gets the same code; `tests/nightcode.test.js`
fails if they differ.

## Trying it without Supabase

```bash
node coleforge/tests/mock-supabase.js 54321
printf 'window.NIGHTCODE_CONFIG = { supabaseUrl: "http://127.0.0.1:54321", supabaseAnonKey: "mock-anon-key" };\n' > coleforge/web/nightcode/config.js
cd coleforge/web/nightcode && python3 -m http.server 8200
```

Then open http://127.0.0.1:8200/. (`config.js` is git-ignored.)

## Commands

`HELP`, `CLS`, `DIR`, `TYPE file`, `BOARD [name]`, `BOARDS`, `POST [text]`, `DEL id`, `WHO`,
`FINGER user`, `WHOAMI`, `PROFILE [NAME|BIO text]`, `PASSWD`, `COLOR night|green|amber|white`, `MATRIX`,
`VER`, `DATE`, `TIME`, `ECHO`, `LOGOUT`, `REBOOT`. At `login:`: a username or email, `NEW`, `RESET`,
`GUEST`. Esc or a click skips the boot; Tab completes commands; Up/Down recall them.
