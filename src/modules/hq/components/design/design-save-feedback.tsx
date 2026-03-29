"use client";

import type { LandingDesignActionState } from "@/modules/hq/actions/landing-design";

type Props = {
  state: LandingDesignActionState | undefined;
};

export function DesignSaveFeedback({ state }: Props) {
  if (!state?.message) return null;
  return (
    <p
      role="status"
      className={`rounded-lg border px-3 py-2 text-sm ${
        state.ok
          ? "border-[var(--ui-success-border)] bg-[var(--ui-success-soft)] text-[var(--ui-success)]"
          : "border-[var(--ui-danger-border)] bg-[var(--ui-danger-soft)] text-[var(--ui-danger)]"
      }`}
    >
      {state.message}
    </p>
  );
}
