const { getTransporter } = require("../utils/mailer");
const { templates, renderTemplate } = require("../utils/emailTemplates");
require("dotenv").config();

class EmailService {
  async sendTemplateEmail(templateKey, to, vars = {}) {
    const tpl = templates[templateKey];
    if (!tpl) throw new Error(`Template not found: ${templateKey}`);

    const subject = renderTemplate(tpl.subject, vars);
    const html = renderTemplate(tpl.html, vars);

    const transporter = getTransporter();

    const fromName = process.env.MAIL_FROM_NAME || "HR Portal";
    const fromEmail = process.env.EMAIL_USER;

    return transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject,
      html
    });
  }
}

module.exports = EmailService;
