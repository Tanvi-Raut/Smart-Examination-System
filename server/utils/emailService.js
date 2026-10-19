// EmailJS Invitation Dispatch Service
// Configured with active EmailJS template and credentials
const emailjs = require("@emailjs/nodejs");


/**
 * Checks if EmailJS environment variables are configured
 */
const isEmailJSConfigured = () => {
    const serviceId = (process.env.EMAILJS_SERVICE_ID || "").trim();
    const templateId = (process.env.EMAILJS_TEMPLATE_ID || "").trim();
    const publicKey = (process.env.EMAILJS_PUBLIC_KEY || "").trim();
    return Boolean(serviceId && templateId && publicKey);
};

/**
 * Renders the official Smart Examination Management System HTML Email for Invigilator Invitation
 */
const renderInvigilatorEmailHTML = ({
    invigilator_name,
    to_email,
    invigilator_id,
    hall_name,
    setup_link
}) => {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invigilator Invitation</title>
</head>

<body style="margin:0; padding:0; background-color:#f4f6f9; font-family:Arial, Helvetica, sans-serif;">

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
         style="background-color:#f4f6f9; padding:30px 10px;">
    <tr>
      <td align="center">

        <table role="presentation" width="600" cellspacing="0" cellpadding="0"
               style="max-width:600px; width:100%; background-color:#ffffff;
                      border-radius:10px; overflow:hidden;">

          <!-- Header -->
          <tr>
            <td align="center"
                style="background-color:#4338ca; padding:28px 20px; color:#ffffff;">
              <h1 style="margin:0; font-size:24px;">
                Smart Examination Management System
              </h1>
              <p style="margin:10px 0 0; font-size:15px; color:#e0e7ff;">
                Invigilator Account Invitation
              </p>
            </td>
          </tr>

          <!-- Email Body -->
          <tr>
            <td style="padding:30px 25px; color:#333333; font-size:15px;
                       line-height:1.7;">

              <h2 style="margin-top:0; color:#1f2937; font-size:21px;">
                Welcome to the Smart Examination Management System!
              </h2>

              <p>Dear <strong>${invigilator_name}</strong>,</p>

              <p>
                You have been invited by the administrator to join the
                Smart Examination Management System as an invigilator.
              </p>

              <p>Your account details are provided below:</p>

              <!-- Account Details -->
              <table role="presentation" width="100%" cellspacing="0"
                     cellpadding="10"
                     style="background-color:#f8fafc; border:1px solid #e5e7eb;
                            border-radius:6px; font-size:14px;">

                <tr>
                  <td style="width:40%; color:#4b5563;">
                    <strong>Name</strong>
                  </td>
                  <td style="color:#111827;">
                    ${invigilator_name}
                  </td>
                </tr>

                <tr>
                  <td style="color:#4b5563;">
                    <strong>Email ID</strong>
                  </td>
                  <td style="color:#111827; word-break:break-word;">
                    ${to_email}
                  </td>
                </tr>

                <tr>
                  <td style="color:#4b5563;">
                    <strong>Invigilator ID</strong>
                  </td>
                  <td style="color:#111827;">
                    ${invigilator_id}
                  </td>
                </tr>

                <tr>
                  <td style="color:#4b5563;">
                    <strong>Assigned Examination Hall</strong>
                  </td>
                  <td style="color:#111827;">
                    ${hall_name}
                  </td>
                </tr>

              </table>

              <!-- Password Setup -->
              <h3 style="margin:28px 0 10px; color:#1f2937; font-size:18px;">
                Set Up Your Password
              </h3>

              <p>
                To activate your account, click the button below and
                create your password.
              </p>

              <table role="presentation" cellspacing="0" cellpadding="0"
                     align="center" style="margin:25px auto;">
                <tr>
                  <td align="center" bgcolor="#4338ca"
                      style="border-radius:6px;">
                    <a href="${setup_link}"
                       target="_blank"
                       style="display:inline-block; padding:14px 28px;
                              color:#ffffff; text-decoration:none;
                              font-size:16px; font-weight:bold;
                              border-radius:6px;">
                      Set Your Password
                    </a>
                  </td>
                </tr>
              </table>

              <p style="font-size:12px; color:#6b7280; margin:12px 0 20px; word-break:break-all; text-align:center;">
                Or copy and open this link directly in your browser:<br/>
                <a href="${setup_link}" style="color:#4338ca; text-decoration:underline; font-size:11px;">${setup_link}</a>
              </p>

              <p style="font-size:13px; color:#6b7280;">
                <strong>Important:</strong> This link is valid for a limited
                time and can be used only once.
              </p>

              <p>
                After setting your password, log in using your registered
                email ID and the password you created to access your
                invigilator dashboard.
              </p>

              <p>
                If you did not expect this invitation, please contact your
                examination administrator.
              </p>

              <p style="margin-top:28px;">
                Regards,<br>
                <strong>Examination Administration Team</strong><br>
                <span style="color:#6b7280;">
                  Smart Examination Management System
                </span>
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center"
                style="background-color:#f8fafc; padding:16px;
                       border-top:1px solid #e5e7eb;
                       color:#9ca3af; font-size:12px;">
              This is an automated email. Please do not reply directly.
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>`;
};

/**
 * Send an Invigilator Password Setup Invitation Email using EmailJS
 * @param {Object} options
 * @param {string} options.to - Invigilator's email address
 * @param {string} options.name - Invigilator's full name
 * @param {string} [options.invigilatorId] - Official Invigilator ID
 * @param {string} options.setupLink - Unique time-limited password setup URL
 * @param {string} [options.hallName] - Assigned examination hall name
 * @param {string} [options.hallNumber] - Assigned examination hall number
 * @param {string} [options.examName] - Name of assigned examination
 * @param {string} [options.examDate] - Date and time of assigned examination
 * @param {number} [options.expiresInHours=48] - Expiration duration in hours
 */
const sendInvigilatorInvitationEmail = async ({
    to,
    name,
    invigilatorId,
    setupLink,
    hallName: customHallName,
    hallNumber = "Assigned Hall",
    examName = "Scheduled Examination",
    examDate = "Upcoming Session",
    expiresInHours = 48
}) => {
    const serviceId = (process.env.EMAILJS_SERVICE_ID || "").trim();
    const templateId = (process.env.EMAILJS_TEMPLATE_ID || "").trim();
    const publicKey = (process.env.EMAILJS_PUBLIC_KEY || "").trim();
    const privateKey = (process.env.EMAILJS_PRIVATE_KEY || "").trim();

    const invigilatorName = name || "Invigilator";
    const toEmail = to;
    const invId = invigilatorId || `INV-${(to || "").split("@")[0].toUpperCase()}`;
    const hallName = customHallName || (hallNumber && hallNumber !== "Assigned Hall" ? `Hall ${hallNumber}` : "Main Examination Block");

    // Render the exact HTML template with all details
    const htmlContent = renderInvigilatorEmailHTML({
        invigilator_name: invigilatorName,
        to_email: toEmail,
        invigilator_id: invId,
        hall_name: hallName,
        setup_link: setupLink
    });

    // Template parameters matching the user's HTML template variables + common aliases
    const templateParams = {
        invigilator_name: invigilatorName,
        to_email: toEmail,
        email: toEmail,
        user_email: toEmail,
        to: toEmail,
        recipient: toEmail,
        recipient_email: toEmail,
        invigilator_id: invId,
        hall_name: hallName,
        setup_link: setupLink,

        // Common aliases
        to_name: invigilatorName,
        name: invigilatorName,
        hall_number: hallNumber,
        exam_name: examName,
        exam_date: examDate,
        expires_in_hours: expiresInHours,
        subject: "[Action Required] Invigilator Account Invitation - Smart Examination Management System",

        // Full rendered HTML template code
        html_code: htmlContent,
        html_content: htmlContent,
        message: htmlContent
    };

    // If EmailJS credentials are not configured, simulate
    if (!isEmailJSConfigured()) {
        console.log("\n=======================================================");
        console.log("ℹ️  [EmailJS Simulation Mode]");
        console.log(`To: ${toEmail} (${invigilatorName})`);
        console.log(`Invigilator ID: ${invId} | Hall: ${hallName}`);
        console.log(`Password Setup Link: ${setupLink}`);
        console.log("=======================================================\n");

        return {
            delivered: false,
            simulated: true,
            provider: "emailjs",
            setupLink,
            templateParams,
            htmlContent,
            message: "EmailJS unconfigured: Invitation link generated and logged to console."
        };
    }

    try {
        const sendOptions = {
            publicKey,
            ...(privateKey ? { privateKey } : {})
        };

        const response = await emailjs.send(serviceId, templateId, templateParams, sendOptions);
        console.log(`[EmailJS] Invitation email successfully sent to ${toEmail} (Status: ${response.status}, Text: ${response.text})`);

        return {
            delivered: true,
            simulated: false,
            provider: "emailjs",
            status: response.status,
            setupLink,
            templateParams,
            htmlContent
        };
    } catch (error) {
        const errorText = error.text || error.message || "Unknown error";
        console.warn(`[EmailJS] Server-side dispatch note for ${toEmail}:`, errorText);

        const isNonBrowserDisabled = errorText.includes("non-browser");

        return {
            delivered: false,
            simulated: false,
            provider: "emailjs",
            nonBrowserDisabled: isNonBrowserDisabled,
            error: errorText,
            setupLink,
            templateParams,
            htmlContent,
            emailjsConfig: {
                serviceId,
                templateId,
                publicKey
            },
            message: isNonBrowserDisabled
                ? "EmailJS non-browser API is disabled. You can enable it in https://dashboard.emailjs.com/admin/account/security or browser client can send directly."
                : `EmailJS error: ${errorText}`
        };
    }
};

module.exports = {
    sendInvigilatorInvitationEmail,
    renderInvigilatorEmailHTML,
    isEmailJSConfigured
};
