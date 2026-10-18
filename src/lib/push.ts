import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken, isSupported } from "firebase/messaging";
import { supabase } from "@/integrations/supabase/client";
import { getPushConfig } from "@/lib/push-config.functions";

export type PushStatus =
  | "registered"
  | "not-configured"
  | "unsupported"
  | "open-in-new-tab"
  | "install-required"
  | "denied";

/** Tıklamayla çağrılmalı. Cihazı kapalıyken de bildirim alacak şekilde kaydeder. */
export async function enablePush(userId: string): Promise<PushStatus> {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return "unsupported";
  if (window.top !== window.self) return "open-in-new-tab";
  if (isIosDevice() && !isStandaloneApp()) return "install-required";

  // Ask before awaiting network work so browsers that require a user gesture
  // (notably iOS Safari) still recognize the permission request.
  const permissionRequest =
    Notification.permission === "granted"
      ? Promise.resolve<NotificationPermission>("granted")
      : Notification.requestPermission();
  const permission = await permissionRequest;
  if (permission !== "granted") return "denied";
  if (!(await isSupported())) return "unsupported";

  const cfg = await getPushConfig();
  const config = {
    apiKey: cfg.apiKey,
    projectId: cfg.projectId,
    appId: cfg.appId,
    messagingSenderId: cfg.appId.split(":")[1] ?? "",
  };
  if (
    !config.apiKey ||
    !config.projectId ||
    !config.appId ||
    !cfg.vapidKey ||
    !config.messagingSenderId
  )
    return "not-configured";
  // Ayrı scope: diğer service worker'la çakışmasın.
  const reg = await navigator.serviceWorker.register(
    `/firebase-messaging-sw.js?${new URLSearchParams(config)}`,
    {
      scope: "/firebase-cloud-messaging-push-scope",
    },
  );
  await waitActive(reg);
  const app = getApps()[0] ?? initializeApp(config);
  const token = await getToken(getMessaging(app), {
    vapidKey: cfg.vapidKey,
    serviceWorkerRegistration: reg,
  });
  if (!token) return "denied";
  const { error } = await supabase
    .from("push_tokens")
    .upsert({ user_id: userId, token }, { onConflict: "token" });
  if (error) throw new Error(error.message);
  return "registered";
}

function waitActive(reg: ServiceWorkerRegistration): Promise<void> {
  if (reg.active) return Promise.resolve();
  const sw = reg.installing ?? reg.waiting;
  if (!sw) {
    if (reg.active) return Promise.resolve();
    throw new Error("Firebase service worker kaydı etkinleştirilemedi.");
  }
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Firebase service worker zamanında başlatılamadı."));
    }, 15_000);

    function cleanup() {
      window.clearTimeout(timeout);
      sw.removeEventListener("statechange", onStateChange);
      sw.removeEventListener("error", onError);
    }
    function onStateChange() {
      if (sw.state === "activated") {
        cleanup();
        resolve();
      } else if (sw.state === "redundant") {
        cleanup();
        reject(new Error("Firebase service worker başlatılamadı."));
      }
    }
    function onError() {
      cleanup();
      reject(new Error("Firebase service worker yüklenemedi."));
    }

    sw.addEventListener("statechange", onStateChange);
    sw.addEventListener("error", onError);
    onStateChange();
  });
}

function isIosDevice(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isStandaloneApp(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && navigator.standalone === true)
  );
}
