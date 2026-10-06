"use client";

import { useQuery } from "@tanstack/react-query";

import { listDevIdentities } from "@/lib/api/endpoints";
import { IS_DEV_AUTH } from "@/lib/dev/devIdentity";
import { ROLE_SHORT } from "@/lib/format";

import { useSession } from "./Session";

/** DEVELOPMENT ONLY "Viewing as" control. Renders nothing unless NEXT_PUBLIC_AUTH_MODE=dev. */
export function RoleSwitcher() {
  const { me, switchIdentity } = useSession();
  const identities = useQuery({ queryKey: ["dev", "identities"], queryFn: listDevIdentities, enabled: IS_DEV_AUTH });
  if (!IS_DEV_AUTH) return null;

  const options = identities.data ?? [{ ...me }];
  return (
    <label className="role-switcher" title="Development only: act as another user">
      <span className="dev-tag">Dev</span>
      <span className="role-switcher-label">Viewing as</span>
      <select value={me.user_id} onChange={(event) => switchIdentity(event.target.value)} aria-label="Viewing as">
        {options.map((user) => (
          <option key={user.user_id} value={user.user_id}>
            {user.display_name} — {ROLE_SHORT[user.role]}
          </option>
        ))}
      </select>
    </label>
  );
}
