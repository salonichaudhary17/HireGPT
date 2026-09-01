import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

// Single reusable SMTP transporter, built from .env config.
// Works with Gmail (using an App Password), Mailtrap, Ethereal,
// or any standard SMTP provider.
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: process.env.EMAIL_PORT === "465", // true for port 465, false for 587/others
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});
transporter.verify()
  .then(() => {
    console.log("✅ Ethereal SMTP connection successful");
  })
  .catch((error) => {
    console.error("❌ Ethereal SMTP connection failed:");
    console.error(error.message);
});

// Core sender. Never throws — logs and swallows errors so a broken
// email config never breaks the actual application/job flow.
const sendEmail = async ({ to, subject, html }) => {
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER) {
    console.log("Email not configured — skipping send to", to);
    return;
  }

  try {
    const info = await transporter.sendMail({
      from: `"HireGPT" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });
    console.log(`Email sent to ${to}: ${subject}`);
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`Preview: ${previewUrl}`);
    }
  } catch (error) {
    console.error(`Failed to send email to ${to}:`, error.message);
  }
};

// Shared wrapper so every email looks consistent
const wrapEmail = (bodyHtml) => `
  <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; background:#0f1016; padding:32px;">
    <div style="max-width:520px; margin:0 auto; background:#171921; border:1px solid #292d38; border-radius:16px; padding:32px; color:#f5f5f5;">
      <div style="font-size:20px; font-weight:700; margin-bottom:24px;">
        Hire<span style="color:#8b5cf6;">GPT</span>
      </div>
      ${bodyHtml}
      <div style="margin-top:32px; padding-top:20px; border-top:1px solid #292d38; color:#7a7d8a; font-size:12.5px;">
        This is an automated notification from HireGPT.
      </div>
    </div>
  </div>
`;

const STATUS_LABELS = {
  applied: "Applied",
  shortlisted: "Shortlisted",
  interview: "Interview",
  selected: "Selected",
  rejected: "Rejected",
};

const STATUS_COLORS = {
  applied: "#c4b5fd",
  shortlisted: "#60a5fa",
  interview: "#fbbf24",
  selected: "#34d399",
  rejected: "#f87171",
};

// Notify a recruiter that a new candidate applied to their job
export const sendNewApplicationEmail = async ({
  recruiterEmail,
  recruiterName,
  candidateName,
  jobTitle,
  company,
}) => {
  const html = wrapEmail(`
    <p style="font-size:15px; color:#d1d5db;">Hi ${recruiterName},</p>
    <p style="font-size:15px; color:#d1d5db; line-height:1.6;">
      <strong style="color:#f5f5f5;">${candidateName}</strong> just applied
      to your job posting <strong style="color:#f5f5f5;">${jobTitle}</strong>
      at ${company}.
    </p>
    <p style="font-size:14px; color:#a0a3b1;">
      Log in to HireGPT to review this applicant.
    </p>
  `);

  await sendEmail({
    to: recruiterEmail,
    subject: `New applicant for ${jobTitle}`,
    html,
  });
};

// Notify a candidate that their application status changed
export const sendStatusUpdateEmail = async ({
  candidateEmail,
  candidateName,
  jobTitle,
  company,
  status,
}) => {
  const label = STATUS_LABELS[status] || status;
  const color = STATUS_COLORS[status] || "#c4b5fd";

  const html = wrapEmail(`
    <p style="font-size:15px; color:#d1d5db;">Hi ${candidateName},</p>
    <p style="font-size:15px; color:#d1d5db; line-height:1.6;">
      Your application for <strong style="color:#f5f5f5;">${jobTitle}</strong>
      at ${company} has been updated to:
    </p>
    <p style="margin:16px 0;">
      <span style="display:inline-block; padding:6px 16px; border-radius:999px; font-weight:700; font-size:13px; background:${color}22; color:${color};">
        ${label}
      </span>
    </p>
    <p style="font-size:14px; color:#a0a3b1;">
      Log in to HireGPT to see full details on your application.
    </p>
  `);

  await sendEmail({
    to: candidateEmail,
    subject: `Application update: ${jobTitle} — ${label}`,
    html,
  });
};