// Opens the day's Vrat Katha when the user taps a reminder that has one.
// Native only: mounted from the root layout when Platform.OS !== "web".
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect } from "react";

export function NotificationRouter() {
  const router = useRouter();
  const response = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (!response) return;
    const kathaId = response.notification.request.content.data?.kathaId;
    if (typeof kathaId === "string") {
      router.push({ pathname: "/katha/[id]", params: { id: kathaId } });
    }
  }, [response, router]);

  return null;
}
