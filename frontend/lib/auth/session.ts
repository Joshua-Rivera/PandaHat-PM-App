// The one function the API client asks for credentials: a Firebase ID token in
// production, or the dev identity header when NEXT_PUBLIC_AUTH_MODE=dev.
import { getIdToken, IS_FIREBASE_AUTH } from "@/lib/auth/firebase";
import { getDevUserId, IS_DEV_AUTH } from "@/lib/dev/devIdentity";

export async function getAuthHeaders(): Promise<Record<string, string>> {
  if (IS_DEV_AUTH) {
    const devUserId = getDevUserId();
    return devUserId ? { "X-Dev-User-Id": devUserId } : {};
  }
  if (IS_FIREBASE_AUTH) {
    const token = await getIdToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
  return {};
}
