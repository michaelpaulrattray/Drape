/**
 * One-time setup script: Creates a Klaviyo Flow for "Referral Invite Sent" events.
 *
 * Steps:
 *   1. Create an HTML email template (FormaStudio branded)
 *   2. Fire a seed event so Klaviyo registers the "Referral Invite Sent" metric
 *   3. Look up the metric ID
 *   4. Create a flow: metric trigger → send-email action
 *   5. Set flow status to "live"
 *
 * Usage:
 *   node server/scripts/setupKlaviyoReferralFlow.mjs
 *
 * Requires KLAVIYO_PRIVATE_KEY in environment (auto-injected in project).
 */

import "dotenv/config";

const KLAVIYO_API_URL = "https://a.klaviyo.com/api";
const KLAVIYO_API_VERSION = "2024-10-15";
const KLAVIYO_BETA_REVISION = "2024-10-15.pre";

function getApiKey() {
  const key = process.env.KLAVIYO_PRIVATE_KEY;
  if (!key) throw new Error("KLAVIYO_PRIVATE_KEY is not set");
  return key;
}

function headers(revision = KLAVIYO_API_VERSION) {
  return {
    Authorization: `Klaviyo-API-Key ${getApiKey()}`,
    "Content-Type": "application/vnd.api+json",
    Accept: "application/vnd.api+json",
    revision,
  };
}

// ── Brand constants ──
const LOGO_URL =
  "https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/sPTVfhEIGSZsJGLZ.png";
const FROM_EMAIL = "hello@formastudio.ai";
const FROM_LABEL = "FormaStudio";
const REWARD_CREDITS = 12500;

// ── 1. Email template HTML ──
const EMAIL_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You've been invited to FormaStudio</title>
  <!--[if mso]>
  <style>table,td{font-family:Arial,Helvetica,sans-serif!important}</style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <!-- Outer wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <!-- Main card -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">

          <!-- Header bar -->
          <tr>
            <td style="background-color:#0A0A0A;padding:32px 40px;text-align:center;">
              <img src="${LOGO_URL}" alt="FormaStudio" width="40" height="40" style="display:inline-block;vertical-align:middle;border-radius:8px;" />
              <span style="display:inline-block;vertical-align:middle;margin-left:12px;font-size:20px;font-weight:600;color:#ffffff;letter-spacing:-0.02em;">FormaStudio™</span>
            </td>
          </tr>

          <!-- Hero section -->
          <tr>
            <td style="padding:48px 40px 32px;text-align:center;">
              <h1 style="margin:0 0 8px;font-size:28px;font-weight:700;color:#0A0A0A;letter-spacing:-0.03em;line-height:1.2;">
                You've been invited
              </h1>
              <p style="margin:0;font-size:16px;color:#6B6B6B;line-height:1.6;">
                Your friend <strong style="color:#0A0A0A;">{{ event.referrer_name }}</strong> thinks you'd love FormaStudio — the AI studio for crafting refined model identities and photorealistic campaign assets.
              </p>
            </td>
          </tr>

          <!-- Reward callout -->
          <tr>
            <td style="padding:0 40px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAFAFA;border:1px solid #EBEBEB;border-radius:12px;">
                <tr>
                  <td style="padding:24px 28px;text-align:center;">
                    <p style="margin:0 0 4px;font-size:13px;font-weight:500;color:#9B9B9B;text-transform:uppercase;letter-spacing:0.08em;">
                      Your welcome bonus
                    </p>
                    <p style="margin:0;font-size:36px;font-weight:700;color:#0A0A0A;letter-spacing:-0.03em;">
                      {{ event.reward_credits }} credits
                    </p>
                    <p style="margin:8px 0 0;font-size:14px;color:#6B6B6B;line-height:1.5;">
                      Start creating immediately — on the house.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA button -->
          <tr>
            <td style="padding:0 40px 40px;text-align:center;">
              <a href="{{ event.referral_link }}" target="_blank" style="display:inline-block;background-color:#0A0A0A;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;padding:16px 48px;border-radius:999px;letter-spacing:-0.01em;">
                Accept Invitation
              </a>
              <p style="margin:16px 0 0;font-size:13px;color:#9B9B9B;">
                When you sign up and {{ event.referrer_name }} will also receive {{ event.reward_credits }} credits after your first subscription.
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <div style="border-top:1px solid #EBEBEB;"></div>
            </td>
          </tr>

          <!-- What is FormaStudio -->
          <tr>
            <td style="padding:32px 40px;">
              <h2 style="margin:0 0 16px;font-size:18px;font-weight:600;color:#0A0A0A;letter-spacing:-0.02em;">
                What is FormaStudio?
              </h2>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="40" valign="top" style="padding-right:12px;padding-bottom:16px;">
                    <div style="width:32px;height:32px;background-color:#F4F4F4;border-radius:8px;text-align:center;line-height:32px;font-size:16px;">✦</div>
                  </td>
                  <td valign="top" style="padding-bottom:16px;">
                    <p style="margin:0;font-size:14px;font-weight:600;color:#0A0A0A;">AI Model Casting</p>
                    <p style="margin:4px 0 0;font-size:13px;color:#6B6B6B;line-height:1.5;">Generate photorealistic model identities tailored to your brand's aesthetic.</p>
                  </td>
                </tr>
                <tr>
                  <td width="40" valign="top" style="padding-right:12px;padding-bottom:16px;">
                    <div style="width:32px;height:32px;background-color:#F4F4F4;border-radius:8px;text-align:center;line-height:32px;font-size:16px;">◎</div>
                  </td>
                  <td valign="top" style="padding-bottom:16px;">
                    <p style="margin:0;font-size:14px;font-weight:600;color:#0A0A0A;">Campaign-Ready Assets</p>
                    <p style="margin:4px 0 0;font-size:13px;color:#6B6B6B;line-height:1.5;">Full-body shots, multiple angles, and consistent styling across every image.</p>
                  </td>
                </tr>
                <tr>
                  <td width="40" valign="top" style="padding-right:12px;">
                    <div style="width:32px;height:32px;background-color:#F4F4F4;border-radius:8px;text-align:center;line-height:32px;font-size:16px;">⚡</div>
                  </td>
                  <td valign="top">
                    <p style="margin:0;font-size:14px;font-weight:600;color:#0A0A0A;">Minutes, Not Months</p>
                    <p style="margin:4px 0 0;font-size:13px;color:#6B6B6B;line-height:1.5;">Skip the casting calls and studio time. Create production-ready visuals in minutes.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#FAFAFA;padding:24px 40px;text-align:center;border-top:1px solid #EBEBEB;">
              <p style="margin:0 0 4px;font-size:13px;color:#9B9B9B;">
                FormaStudio™ — AI-powered creative studio
              </p>
              <p style="margin:0;font-size:12px;color:#BDBDBD;">
                This email was sent because {{ event.referrer_name }} invited you to join FormaStudio.
                <br/>You won't receive further emails unless you create an account.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

// ── Helpers ──

async function apiCall(method, path, body = null, useBeta = false) {
  const opts = {
    method,
    headers: headers(useBeta ? KLAVIYO_BETA_REVISION : KLAVIYO_API_VERSION),
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${KLAVIYO_API_URL}${path}`, opts);
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  if (!res.ok) {
    console.error(`[${method} ${path}] ${res.status}`, JSON.stringify(data, null, 2));
    throw new Error(`Klaviyo API ${res.status}: ${typeof data === "string" ? data : JSON.stringify(data)}`);
  }
  return data;
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Main ──

async function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║  FormaStudio — Klaviyo Referral Flow Setup   ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  // Step 1: Create email template
  console.log("Step 1/5 — Creating email template...");
  const templateRes = await apiCall("POST", "/templates", {
    data: {
      type: "template",
      attributes: {
        name: "Referral Invite — FormaStudio",
        editor_type: "CODE",
        html: EMAIL_HTML,
      },
    },
  });
  const templateId = templateRes.data.id;
  console.log(`  ✓ Template created: ${templateId}\n`);

  // Step 2: Fire a seed event so the metric exists
  console.log("Step 2/5 — Firing seed event to register metric...");
  await apiCall("POST", "/events", {
    data: {
      type: "event",
      attributes: {
        metric: {
          data: {
            type: "metric",
            attributes: { name: "Referral Invite Sent" },
          },
        },
        profile: {
          data: {
            type: "profile",
            attributes: { email: "setup-seed@formastudio.internal" },
          },
        },
        properties: {
          referrer_name: "FormaStudio Setup",
          referral_link: "https://formastudio.ai",
          reward_credits: REWARD_CREDITS,
          invite_date: new Date().toISOString(),
          _seed_event: true,
        },
        time: new Date().toISOString(),
      },
    },
  });
  console.log("  ✓ Seed event fired\n");

  // Step 3: Wait for metric to appear, then fetch its ID
  console.log("Step 3/5 — Looking up metric ID (may take a moment)...");
  let metricId = null;
  for (let attempt = 0; attempt < 10; attempt++) {
    await sleep(3000);
    // Metrics API doesn't support filtering by name — fetch all and search
    let nextUrl = "/metrics";
    while (nextUrl && !metricId) {
      const metricsRes = await apiCall("GET", nextUrl);
      const match = (metricsRes.data || []).find(
        (m) => m.attributes && m.attributes.name === "Referral Invite Sent"
      );
      if (match) {
        metricId = match.id;
        break;
      }
      // Handle pagination
      nextUrl = metricsRes.links?.next
        ? metricsRes.links.next.replace(KLAVIYO_API_URL, "")
        : null;
    }
    if (metricId) break;
    console.log(`  ... waiting (attempt ${attempt + 1}/10)`);
  }
  if (!metricId) {
    console.error("  ✗ Could not find 'Referral Invite Sent' metric after 30s.");
    console.log("\n  FALLBACK: Create the flow manually in Klaviyo UI:");
    console.log("    1. Go to Flows → Create Flow → Build Your Own");
    console.log('    2. Trigger: Metric → "Referral Invite Sent"');
    console.log(`    3. Action: Send Email → Use template "${templateId}"`);
    console.log("    4. Set From: hello@formastudio.ai / FormaStudio");
    console.log("    5. Set flow to Live\n");
    process.exit(1);
  }
  console.log(`  ✓ Metric ID: ${metricId}\n`);

  // Step 4: Create the flow
  console.log("Step 4/5 — Creating flow...");
  try {
    const flowRes = await apiCall(
      "POST",
      "/flows",
      {
        data: {
          type: "flow",
          attributes: {
            name: "Referral Invite Email",
            definition: {
              triggers: [
                {
                  type: "metric",
                  id: metricId,
                },
              ],
              profile_filter: null,
              actions: [
                {
                  temporary_id: "action_send_email",
                  type: "send-email",
                  links: { next: null },
                  data: {
                    message: {
                      from_email: FROM_EMAIL,
                      from_label: FROM_LABEL,
                      reply_to_email: null,
                      cc_email: null,
                      bcc_email: null,
                      subject_line:
                        "{{ event.referrer_name }} invited you to FormaStudio — claim your {{ event.reward_credits }} credits",
                      preview_text:
                        "Your friend thinks you'd love FormaStudio. Accept the invite and start creating.",
                      template_id: templateId,
                      smart_sending_enabled: false,
                      transactional: false,
                      add_tracking_params: false,
                      custom_tracking_params: null,
                      additional_filters: null,
                      name: "Referral Invite Email",
                    },
                    status: "live",
                  },
                },
              ],
              entry_action_id: "action_send_email",
              reentry_criteria: { unit: "day", duration: 0 },
            },
          },
        },
      },
      true // use beta revision
    );
    const flowId = flowRes.data.id;
    console.log(`  ✓ Flow created: ${flowId}\n`);

    // Step 5: Set flow to live
    console.log("Step 5/5 — Activating flow...");
    await apiCall(
      "PATCH",
      `/flows/${flowId}`,
      {
        data: {
          type: "flow",
          id: flowId,
          attributes: { status: "live" },
        },
      },
      true
    );
    console.log("  ✓ Flow is LIVE\n");

    console.log("═══════════════════════════════════════════════");
    console.log("  Setup complete!");
    console.log(`  Template ID: ${templateId}`);
    console.log(`  Metric ID:   ${metricId}`);
    console.log(`  Flow ID:     ${flowId}`);
    console.log(`  Status:      LIVE`);
    console.log("═══════════════════════════════════════════════\n");
  } catch (err) {
    console.error("  ✗ Flow creation failed (beta API):", err.message);
    console.log("\n  FALLBACK: Create the flow manually in Klaviyo UI:");
    console.log("    1. Go to Flows → Create Flow → Build Your Own");
    console.log(`    2. Trigger: Metric → "Referral Invite Sent" (ID: ${metricId})`);
    console.log(`    3. Action: Send Email → Use template ID: ${templateId}`);
    console.log(`    4. Subject: "{{ event.referrer_name }} invited you to FormaStudio — claim your {{ event.reward_credits }} credits"`);
    console.log(`    5. From: ${FROM_EMAIL} / ${FROM_LABEL}`);
    console.log("    6. Set flow to Live\n");
    console.log("  The template and metric are already created — you just need to wire them together.\n");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
