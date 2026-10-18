import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({ email: z.string().trim().email().max(255) });

export type AccountNotice = {
  status: "ok" | "pending" | "banned" | "unknown";
  reason: string | null;
  until: string | null;
};

/**
 * Hesap varlığı ve onay durumu, anonim kullanıcılar için ifşa edilemez.
 * Bu endpoint, yalnızca genel bir cevap döndürür; detaylı durum bilgisi
 * yalnızca giriş sonrası oturum sahibi için okunabilir olmalıdır.
 */
export const getAccountNotice = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<AccountNotice> => {
    void data;
    return {
      status: "unknown",
      reason: null,
      until: null,
    };
  });
