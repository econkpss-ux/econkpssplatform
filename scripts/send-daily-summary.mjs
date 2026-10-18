if (!process.env.DAILY_SUMMARY_SECRET?.trim()) {
  throw new Error("Required environment variable is missing: DAILY_SUMMARY_SECRET");
}

const endpoint =
  process.env.DAILY_SUMMARY_URL ?? "https://econkpss.lovable.app/api/public/daily-summary";
const response = await fetch(endpoint, {
  method: "POST",
  headers: { "x-daily-summary-secret": process.env.DAILY_SUMMARY_SECRET },
});

if (!response.ok) {
  const detail = await response.text();
  throw new Error(`Daily summary request failed (${response.status}): ${detail}`);
}

const result = await response.json();
console.log(
  `Daily summary sent for ${result.reportDate} to ${result.recipientCount} administrator(s).`,
);
