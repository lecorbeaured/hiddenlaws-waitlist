// POST /api/welcome  { email, name?, company (honeypot), t (ms form was open) }
// Signup endpoint for the HLOM 5-day welcome sequence ("5 Hidden Laws in 5 days").
// Saves the visitor to Resend, sends Email 1 immediately, and fires the
// hlom.welcome_signup event so the Resend Automation "HLOM Welcome Sequence"
// delivers Emails 2-5 on a 1-day drip.
//
// Drop-in: copy to api/welcome.js in the hiddenlawsofmoney repo (same folder
// as api/sample.js). Vercel picks it up as a serverless function automatically.
//
// Vercel environment variables:
//   RESEND_API_KEY      required  re_...
//   WELCOME_FROM        required  e.g. "Eric Coste <guides@hiddenlawsofmoney.com>"
//                                    (domain must be verified in Resend)
//   WELCOME_REPLY_TO    optional  reply-to address
//   WELCOME_AUDIENCE_ID optional  Resend audience id for the welcome list
//                                    (created via curl, see automation-setup.md)
//   WELCOME_SEGMENT_ID  optional  segment that collects welcome subscribers
//
// Pairs with the Resend Automation (see automation-setup.md):
//   trigger: event "hlom.welcome_signup"
//   steps:   delay 1 day -> send Email 2 -> delay 1 day -> send Email 3
//            -> delay 1 day -> send Email 4 -> delay 1 day -> send Email 5
// Email 1 is sent here, directly, so the signup promise is kept even if the
// automation is not configured yet. No double-send: the automation starts
// with Email 2.

const SITE = "https://hiddenlawsofmoney.com";
const BOOK = "https://payhip.com/b/DzR2a";
const RESEND = "https://api.resend.com";
const EVENT_NAME = "hlom.welcome_signup";
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function resend(path, body) {
  const r = await fetch(RESEND + path, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

async function saveContact(email, name) {
  const base = { email, unsubscribed: false };
  if (name) base.first_name = name;
  if (process.env.WELCOME_AUDIENCE_ID) base.audience_id = process.env.WELCOME_AUDIENCE_ID;
  if (process.env.WELCOME_SEGMENT_ID) base.segments = [{ id: process.env.WELCOME_SEGMENT_ID }];
  const started = new Date().toISOString();
  // Try with the welcome_started property first; fall back without it if the
  // property is not set up yet. Mirrors api/sample.js behavior.
  let res = await resend("/contacts", { ...base, properties: { welcome_started: started, welcome_source: SITE } });
  if (!res.ok && res.status !== 409) res = await resend("/contacts", base);
  if (!res.ok && res.status !== 409) console.error("welcome contact save failed", res.status, JSON.stringify(res.data));
  return res.ok || res.status === 409;
}

function email1Html(name) {
  const hi = name ? `Hi ${esc(name)},` : null;
  const paras = [
    "There\u2019s a game being played with your life as one of the pieces.",
    "The terrifying part isn\u2019t that the game exists. It\u2019s that you\u2019ve been playing it without knowing the rules.",
    "Money doesn\u2019t move by luck. It moves by laws. Invisible ones. The wealthy know them, follow them, and teach them to their kids. Everyone else was never told they exist.",
    "That\u2019s what this series is. Over the next 5 days, I\u2019m going to show you 5 of the 10 Hidden Laws of Money. One per email. Each one comes with a small action you can take the same day.",
    "Here\u2019s today\u2019s. Write down the one money rule you were taught growing up. The sentence you heard on repeat. \u201CMoney doesn\u2019t grow on trees.\u201D \u201CRich people are greedy.\u201D \u201CPeople like us don\u2019t get ahead.\u201D",
    "Write it down. Tomorrow I\u2019ll show you why that single sentence has been running your finances.",
  ];
  const body = paras.map((p) => `<p style="margin:0 0 14px">${p}</p>`).join("\n");
  return `<!doctype html><html><body style="margin:0;background:#0A0A0A;padding:24px 12px;font-family:Georgia,'Times New Roman',serif">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#121110;border:1px solid #8a7434">
<tr><td style="padding:36px 32px 8px;text-align:center">
<div style="color:#C9A84C;font-size:12px;letter-spacing:3px;text-transform:uppercase">The Hidden Laws of Money</div>
<h1 style="margin:14px 0 6px;color:#E9E4D8;font-size:26px;font-weight:normal">The game you\u2019re already playing</h1>
<div style="color:#A69F8E;font-style:italic;font-size:15px">Law 1 of 5, from The Game</div>
</td></tr>
<tr><td style="padding:22px 32px 6px;color:#E9E4D8;font-size:16px;line-height:1.7">
${hi ? `<p style="margin:0 0 14px">${hi}</p>` : ""}
${body}
<p style="margin:18px 0 14px">Eric Coste<br><span style="color:#A69F8E;font-size:14px">Author, The Hidden Laws of Money</span></p>
</td></tr>
<tr><td style="padding:16px 32px 28px;color:#6f6a5f;font-size:12px;line-height:1.6">
Eric Coste &middot; Emerson Business Support Systems LLC &middot; Las Vegas, NV<br>
You received this because you signed up for the 5-day Hidden Laws email series at hiddenlawsofmoney.com.<br>
<a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#C9A84C">Unsubscribe</a>
</td></tr>
</table></td></tr></table></body></html>`;
}

function email1Text(name) {
  return [
    name ? `Hi ${name},` : null,
    "",
    "There\u2019s a game being played with your life as one of the pieces.",
    "",
    "The terrifying part isn\u2019t that the game exists. It\u2019s that you\u2019ve been playing it without knowing the rules.",
    "",
    "Money doesn\u2019t move by luck. It moves by laws. Invisible ones. The wealthy know them, follow them, and teach them to their kids. Everyone else was never told they exist.",
    "",
    "That\u2019s what this series is. Over the next 5 days, I\u2019m going to show you 5 of the 10 Hidden Laws of Money. One per email. Each one comes with a small action you can take the same day.",
    "",
    "Here\u2019s today\u2019s. Write down the one money rule you were taught growing up. The sentence you heard on repeat. \u201CMoney doesn\u2019t grow on trees.\u201D \u201CRich people are greedy.\u201D \u201CPeople like us don\u2019t get ahead.\u201D",
    "",
    "Write it down. Tomorrow I\u2019ll show you why that single sentence has been running your finances.",
    "",
    "Eric Coste",
    "Author, The Hidden Laws of Money",
  ].filter((l) => l !== null).join("\n");
}

async function fireSignupEvent(email, name) {
  // Triggers the Resend Automation "HLOM Welcome Sequence" (emails 2-5).
  // Best-effort: a failure here must never break the signup. The automation
  // listens for this exact event name; confirm the name matches in the
  // Resend dashboard under Automations when creating it.
  // Shape mirrors the Resend SDK: resend.events.send({ event, email, payload }).
  try {
    const res = await resend("/events", {
      event: EVENT_NAME,
      email,
      payload: { name: name || "", source: SITE },
    });
    if (!res.ok) console.error("welcome event fire failed", res.status, JSON.stringify(res.data));
    return res.ok;
  } catch (e) {
    console.error("welcome event fire threw", String(e && e.message || e));
    return false;
  }
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }
  if (!process.env.RESEND_API_KEY || !process.env.WELCOME_FROM) {
    console.error("Missing RESEND_API_KEY or WELCOME_FROM");
    return res.status(500).json({ error: "Signups are temporarily unavailable. Please try again later." });
  }

  let b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = {}; } }
  b = b || {};

  // Bot checks: honeypot filled, or form submitted impossibly fast. Pretend success.
  if (b.company || (typeof b.t === "number" && b.t < 1500)) return res.status(200).json({ ok: true });

  const email = String(b.email || "").trim().toLowerCase().slice(0, 254);
  const name = String(b.name || "").trim().replace(/[\r\n<>]/g, "").slice(0, 60);
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "Enter a valid email address." });

  const [, sent] = await Promise.all([
    saveContact(email, name),
    resend("/emails", {
      from: process.env.WELCOME_FROM,
      to: [email],
      ...(process.env.WELCOME_REPLY_TO ? { reply_to: process.env.WELCOME_REPLY_TO } : {}),
      subject: "The game you\u2019re already playing",
      html: email1Html(name),
      text: email1Text(name),
      tags: [{ name: "type", value: "welcome_sequence" }, { name: "step", value: "1" }],
    }),
  ]);

  if (!sent.ok) {
    console.error("welcome email 1 send failed", sent.status, JSON.stringify(sent.data));
    return res.status(502).json({ error: "We could not send your first email just now. Please try again in a minute." });
  }

  // Fire-and-forget: do not block the response on the automation event.
  fireSignupEvent(email, name);

  return res.status(200).json({ ok: true });
};
