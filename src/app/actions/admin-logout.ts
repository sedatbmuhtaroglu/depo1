"use server";

import { clearAdminSession } from "@/lib/auth";
import { clearSupportSessionCookie } from "@/lib/support-session";
import { redirect } from "next/navigation";

export async function adminLogout() {
  await clearAdminSession();
  try {
    await clearSupportSessionCookie();
  } catch {
    // Server Component ortamında cookie silinemeyebilir.
  }
  redirect("/glidragiris");
}

