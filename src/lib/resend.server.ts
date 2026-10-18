export type ResendEmail = {
  to: string[];
  subject: string;
  html: string;
  text: string;
};

export async function sendResendEmail(email: ResendEmail) {
  const apiKey = process.env["RESEND_API_KEY"];
  const from = process.env["RESEND_FROM_EMAIL"];
  if (!apiKey || !from) {
    throw new Error("RESEND_API_KEY and RESEND_FROM_EMAIL must be configured.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...email, from }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Resend could not send the email (${response.status}): ${detail}`);
  }
}
