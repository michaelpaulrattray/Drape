# Klaviyo Flow Setup: Account Frozen Notification

This guide walks you through creating the **Account Frozen** Flow in Klaviyo so that frozen users automatically receive a branded email explaining their account is under review.

---

## Overview

When FormaStudio freezes a user account (auto-freeze, moderator freeze, or admin freeze), the backend fires a Klaviyo event called **"Account Frozen"** with these template variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `{{ event.user_name }}` | User's display name | "Jane Smith" |
| `{{ event.freeze_reason }}` | Why the account was frozen | "Auto-frozen: credit discrepancy of 2500 credits detected" |
| `{{ event.frozen_by }}` | Who froze it | "system" / "Moderator Mike" / "Admin Sarah" |
| `{{ event.frozen_date }}` | Human-readable date | "February 8, 2026" |
| `{{ event.support_url }}` | Support contact link | "https://formastudio.ai/support" |
| `{{ event.app_name }}` | App name | "FormaStudio" |

---

## Step-by-Step Setup

### 1. Create the Flow

1. Log in to your [Klaviyo Dashboard](https://www.klaviyo.com/flows)
2. Click **Flows** in the left sidebar
3. Click **Create Flow** → **Create from Scratch**
4. Name it: **Account Frozen Notification**
5. For the trigger, select **Metric** → search for **"Account Frozen"**
6. Click **Save**

### 2. Add the Email Action

1. In the Flow builder, click the **+** below the trigger
2. Select **Email**
3. Set the subject line: `Your {{ event.app_name }} account is under review`
4. Set the preview text: `We've temporarily paused your account while we review your billing records.`
5. Set the sender name: `FormaStudio`
6. Set the sender email: your verified sending address

### 3. Design the Email

1. Click **Edit Email Content**
2. Switch to **HTML editor** (click the `<>` icon or select "Code" from the template options)
3. Paste the email template HTML below
4. Click **Save** → **Done**

### 4. Activate the Flow

1. Review the Flow summary
2. Toggle the Flow status from **Draft** to **Live**
3. The Flow is now active — any future "Account Frozen" events will trigger the email

---

## Email Template HTML

Copy and paste this into the Klaviyo HTML editor. It uses FormaStudio's brand colors (slate-blue accent `#6E7F8D`, light background `#FAFAFA`, dark text `#111111`) and is mobile-responsive.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Account Under Review</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#FAFAFA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">

  <!-- Wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAFAFA;">
    <tr>
      <td align="center" style="padding:40px 16px;">

        <!-- Container -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#FFFFFF;border:1px solid #E4EBF1;border-radius:12px;box-shadow:0 2px 8px rgba(110,127,141,0.08);">

          <!-- Header -->
          <tr>
            <td style="padding:40px 40px 24px 40px;text-align:center;">
              <!-- Logo / Brand Mark -->
              <div style="font-size:28px;font-weight:700;letter-spacing:-0.5px;color:#111111;">
                Forma<span style="font-weight:400;color:#6E7F8D;">Studio</span>
              </div>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <div style="height:1px;background-color:#E5E5E5;"></div>
            </td>
          </tr>

          <!-- Icon -->
          <tr>
            <td style="padding:32px 40px 16px 40px;text-align:center;">
              <div style="display:inline-block;width:56px;height:56px;border-radius:50%;background-color:#FEF3C7;line-height:56px;font-size:28px;">
                ⚠️
              </div>
            </td>
          </tr>

          <!-- Title -->
          <tr>
            <td style="padding:0 40px 8px 40px;text-align:center;">
              <h1 style="margin:0;font-size:22px;font-weight:600;color:#111111;letter-spacing:-0.3px;">
                Your Account Is Under Review
              </h1>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:16px 40px 0 40px;">
              <p style="margin:0;font-size:15px;line-height:24px;color:#333333;">
                Hi {{ event.user_name|default:"there" }},
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:12px 40px 0 40px;">
              <p style="margin:0;font-size:15px;line-height:24px;color:#333333;">
                We've temporarily paused generation and purchase capabilities on your {{ event.app_name }} account while we review your billing records. This is a routine check to ensure everything is accurate.
              </p>
            </td>
          </tr>

          <!-- Details Card -->
          <tr>
            <td style="padding:24px 40px 0 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F8F9FB;border:1px solid #E5E5E5;border-radius:8px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-bottom:12px;">
                          <span style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#6E7F8D;">Review Details</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-bottom:8px;">
                          <span style="font-size:13px;color:#737373;">Reason:</span><br>
                          <span style="font-size:14px;color:#111111;">{{ event.freeze_reason }}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-bottom:8px;">
                          <span style="font-size:13px;color:#737373;">Date:</span><br>
                          <span style="font-size:14px;color:#111111;">{{ event.frozen_date }}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- What You Can Still Do -->
          <tr>
            <td style="padding:24px 40px 0 40px;">
              <p style="margin:0 0 8px 0;font-size:15px;font-weight:600;color:#111111;">
                What you can still do:
              </p>
              <p style="margin:0;font-size:15px;line-height:24px;color:#333333;">
                ✓ &nbsp;Log in and view your dashboard<br>
                ✓ &nbsp;Access your existing generations<br>
                ✓ &nbsp;View your account and billing history
              </p>
            </td>
          </tr>

          <!-- Temporarily Paused -->
          <tr>
            <td style="padding:16px 40px 0 40px;">
              <p style="margin:0 0 8px 0;font-size:15px;font-weight:600;color:#111111;">
                Temporarily paused:
              </p>
              <p style="margin:0;font-size:15px;line-height:24px;color:#737373;">
                ✗ &nbsp;New generations<br>
                ✗ &nbsp;Credit purchases and plan changes
              </p>
            </td>
          </tr>

          <!-- Resolution Note -->
          <tr>
            <td style="padding:24px 40px 0 40px;">
              <p style="margin:0;font-size:15px;line-height:24px;color:#333333;">
                This review usually resolves within <strong>24–48 hours</strong>. If you believe this is an error or have questions, please reach out to our support team.
              </p>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding:28px 40px 0 40px;text-align:center;">
              <a href="{{ event.support_url }}" target="_blank" style="display:inline-block;padding:12px 32px;background-color:#6E7F8D;color:#FFFFFF;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;letter-spacing:0.2px;">
                Contact Support
              </a>
            </td>
          </tr>

          <!-- Sign-off -->
          <tr>
            <td style="padding:28px 40px 0 40px;">
              <p style="margin:0;font-size:15px;line-height:24px;color:#333333;">
                Thank you for your patience,<br>
                <span style="color:#6E7F8D;font-weight:500;">The {{ event.app_name }} Team</span>
              </p>
            </td>
          </tr>

          <!-- Footer Divider -->
          <tr>
            <td style="padding:32px 40px 0 40px;">
              <div style="height:1px;background-color:#E5E5E5;"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 32px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;line-height:18px;color:#A3A3A3;">
                This email was sent because your {{ event.app_name }} account was flagged for review.
                If you didn't expect this, please
                <a href="{{ event.support_url }}" style="color:#6E7F8D;text-decoration:underline;">contact support</a>.
              </p>
              <p style="margin:8px 0 0 0;font-size:12px;color:#D4D4D4;">
                © {{ "now"|date:"Y" }} FormaStudio™. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
        <!-- /Container -->

      </td>
    </tr>
  </table>
  <!-- /Wrapper -->

</body>
</html>
```

---

## Testing

1. In Klaviyo, use the **Preview** button in the email editor to see how it renders
2. Send a **test email** to yourself from the editor
3. In FormaStudio, you can test the full flow by freezing a test account from the moderator dashboard — the "Account Frozen" event will fire and trigger the Flow
4. Check the **Analytics** tab on the Flow to confirm events are being received

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Flow not triggering | Verify the metric name is exactly **"Account Frozen"** (case-sensitive) |
| Variables showing as blank | Check that the event properties match the variable names in the template |
| Email not rendering correctly | Test in Klaviyo's preview across email clients (Gmail, Outlook, Apple Mail) |
| Events not appearing in Klaviyo | Check that `KLAVIYO_PRIVATE_KEY` is set correctly in Settings → Secrets |
