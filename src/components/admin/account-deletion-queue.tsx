import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Check, Loader2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/confirm-button";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  adminApproveAccountDeletion,
  adminRejectAccountDeletion,
} from "@/lib/admin-users.functions";

function dateLabel(value: string) {
  return new Date(value).toLocaleString("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function AccountDeletionQueue() {
  const queryClient = useQueryClient();
  const approve = useServerFn(adminApproveAccountDeletion);
  const reject = useServerFn(adminRejectAccountDeletion);
  const [busyId, setBusyId] = useState<string | null>(null);
  const {
    data: requests,
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["account-deletion-requests"],
    queryFn: async () => {
      const { data, error: queryError } = await supabase
        .from("account_deletion_requests")
        .select("id, email, status, created_at, expires_at, verified_at")
        .in("status", ["pending_verification", "pending_approval"])
        .order("created_at", { ascending: true });
      if (queryError) throw queryError;
      return data;
    },
  });

  async function review(requestId: string, action: "approve" | "reject") {
    setBusyId(requestId);
    try {
      if (action === "approve") {
        await approve({ data: { requestId } });
        toast.success("Hesap ve ilişkili verileri kalıcı olarak silindi.");
      } else {
        await reject({ data: { requestId } });
        toast.success("Talep reddedildi, hesap erişimi yeniden açıldı.");
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["account-deletion-requests"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-profiles"] }),
        queryClient.invalidateQueries({ queryKey: ["users"] }),
      ]);
    } catch (reviewError) {
      toast.error(reviewError instanceof Error ? reviewError.message : "Talep işlenemedi.");
    } finally {
      setBusyId(null);
    }
  }

  if (isPending) {
    return (
      <div className="flex items-center gap-2 p-6 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Talepler yükleniyor…
      </div>
    );
  }
  if (isError) {
    return (
      <div className="bento space-y-3 p-6" role="alert">
        <p className="text-destructive">Silme talepleri alınamadı: {error.message}</p>
        <Button variant="outline" onClick={() => void refetch()}>
          Yeniden dene
        </Button>
      </div>
    );
  }
  if (!requests?.length) {
    return (
      <div className="bento p-6 text-sm text-muted-foreground">
        İşlem bekleyen hesap silme talebi yok.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {requests.map((request) => {
        const verified = request.status === "pending_approval";
        return (
          <article
            key={request.id}
            className="bento flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 space-y-1">
              <p className="break-all font-semibold">{request.email ?? "E-posta bilgisi yok"}</p>
              <p className="text-sm text-muted-foreground">
                {verified
                  ? "E-posta doğrulandı · Yönetici onayı bekliyor"
                  : "E-posta doğrulaması bekliyor"}
              </p>
              <p className="text-xs text-muted-foreground">
                Talep: {dateLabel(request.created_at)}
                {!verified && ` · Bağlantı sonu: ${dateLabel(request.expires_at)}`}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {verified && (
                <ConfirmButton
                  trigger={
                    <Button size="sm" variant="destructive" disabled={busyId !== null}>
                      {busyId === request.id ? (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      ) : (
                        <Check className="mr-2 size-4" />
                      )}
                      Kalıcı sil
                    </Button>
                  }
                  title="Hesap kalıcı olarak silinsin mi?"
                  description={`${request.email ?? "Bu kullanıcı"} hesabı ve platformdaki ilişkili kullanıcı verileri kalıcı olarak kaldırılacak. Bu işlem geri alınamaz.`}
                  confirmLabel="Hesabı ve verileri sil"
                  onConfirm={() => review(request.id, "approve")}
                />
              )}
              <ConfirmButton
                trigger={
                  <Button size="sm" variant="outline" disabled={busyId !== null}>
                    {busyId === request.id ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <X className="mr-2 size-4" />
                    )}
                    Reddet
                  </Button>
                }
                title="Silme talebi reddedilsin mi?"
                description={`${request.email ?? "Bu kullanıcının"} talebi reddedilecek ve hesabının erişimi yeniden açılacak.`}
                confirmLabel="Talebi reddet"
                onConfirm={() => review(request.id, "reject")}
              />
            </div>
          </article>
        );
      })}
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <AlertTriangle className="size-4 shrink-0" />
        E-posta doğrulaması bekleyen talepler onaylanamaz; reddedilerek hesap kilidi kaldırılabilir.
      </p>
    </div>
  );
}
