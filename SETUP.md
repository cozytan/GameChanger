# GameChanger — Supabase setup checklist

1. **Keys** — In `script.js`, set `SUPABASE_URL` and `SUPABASE_ANON_KEY`
   (Supabase → Project Settings → API). Use the *anon / public* key only.

2. **SQL** — Supabase → SQL Editor:
   - run `supabase/01_setup.sql`
   - edit the email/name at the top of `supabase/02_create_admin.sql`, then run it

3. **Require email confirmation** — Authentication → Sign In / Providers → Email →
   turn ON "Confirm email". This is what stops fake emails: an account can't sign
   in until the link sent to that inbox is clicked.

4. **Redirect URLs** — Authentication → URL Configuration:
   - Site URL: where the app lives (e.g. `https://your-site.netlify.app`)
   - Redirect URLs: add every address you open the app from, e.g.
     `http://127.0.0.1:5500/index.html` and `https://your-site.netlify.app/`

5. **Custom SMTP (required for real users)** — Authentication → Emails → SMTP Settings.
   Supabase's built-in mailer only delivers to members of your Supabase team and
   only ~2 emails/hour. Any SMTP provider works, e.g.
   - Gmail: host `smtp.gmail.com`, port `587`, user = your Gmail, password = a Google
     *App Password* (needs 2-Step Verification)
   - Resend / Brevo / SendGrid: use the SMTP credentials they give you
   Afterwards raise the limit in Authentication → Rate Limits.

6. **Don't open index.html by double-clicking** (`file://`). Email links can't return
   to it. Use VS Code "Live Server" or any static host.

`package.json` note: this is a plain HTML/JS site, so the browser loads Supabase from
the CDN `<script>` tag in `index.html`. The npm packages aren't used by the page, and
`@supabase/ssr` is only for server frameworks like Next.js — you can remove it.
