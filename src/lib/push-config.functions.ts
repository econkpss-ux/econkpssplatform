import { createServerFn } from "@tanstack/react-start";

/**
 * Tarayıcıya Firebase web yapılandırmasını döner.
 * Bu değerler gizli değildir — Firebase web API key'i herkese açık bir
 * tanımlayıcıdır (Firebase güvenliği kurallarla sağlanır).
 */
export const getPushConfig = createServerFn({ method: "GET" }).handler(async () => {
  return {
    apiKey: process.env["GOOGLE_API_KEY"] ?? "",
    projectId: "econkpss-7cb65",
    appId: "1:223870978734:web:f0e17a1ba3c27cbce3fb3f",
    vapidKey: "BCD1ohInwZA5makkB7xpy775S-XK-OEoYYCzAX7TYPPbJw8Yyw49NUGJ6zx9ZL13uNcjxEnyZdwVUq0JpYZVpMU",
  };
});
