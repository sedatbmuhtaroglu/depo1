"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createTenantStaffUser,
  deleteTenantStaffUser,
  forceTenantStaffPasswordReset,
  resetTenantStaffPassword,
  updateTenantStaffUser,
} from "@/app/actions/staff-users";
import { badgeClasses, buttonClasses, cardClasses, fieldClasses } from "@/lib/ui/button-variants";
import {
  createEmptyWeeklySchedule,
  parseWeeklyShiftSchedule,
  summarizeWeeklyScheduleCompact,
  type WeeklyShiftDayEntry,
} from "@/lib/weekly-shift-schedule";
import type { Weekday } from "@prisma/client";
import { resolvePersonDisplayName } from "@/lib/person-display-name";
import { STAFF_ROLE_LABEL, STAFF_ROLE_TONE } from "@/lib/ui-text-maps";
import WeeklyShiftEditor from "./weekly-shift-editor";

type TenantStaffListItem = {
  id: number;
  displayName: string | null;
  username: string;
  role: "MANAGER" | "WAITER" | "KITCHEN";
  isActive: boolean;
  workingDays: Weekday[];
  shiftStart: string | null;
  shiftEnd: string | null;
  weeklyShiftSchedule: unknown | null;
  notes: string | null;
  mustSetPassword: boolean;
  createdAt: string;
};

type UsersManagerProps = {
  users: TenantStaffListItem[];
};

type FieldErrors = Partial<Record<"displayName" | "username" | "temporaryPassword" | "role", string>>;

const INPUT_CLASS = fieldClasses({ size: "md" });

const SECTION_CARD_CLASS = cardClasses({ tone: "default" });

function formatScheduleSummary(user: TenantStaffListItem): string {
  const weekly = parseWeeklyShiftSchedule(user.weeklyShiftSchedule ?? null, {
    workingDays: user.workingDays,
    shiftStart: user.shiftStart,
    shiftEnd: user.shiftEnd,
  });
  return summarizeWeeklyScheduleCompact(weekly);
}

function formatDateParts(isoDate: string) {
  const date = new Date(isoDate);
  return {
    day: date.toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
    time: date.toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

export default function UsersManager({ users }: UsersManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rowPendingId, setRowPendingId] = useState<number | null>(null);
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [role, setRole] = useState<"RESTAURANT_MANAGER" | "WAITER" | "KITCHEN">("WAITER");
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [managerPasswordInputs, setManagerPasswordInputs] = useState<Record<number, string>>({});
  const [passwordSetupOnNextLogin, setPasswordSetupOnNextLogin] = useState<Record<number, boolean>>(
    {},
  );
  const [weeklyEdit, setWeeklyEdit] = useState<WeeklyShiftDayEntry[]>(() => createEmptyWeeklySchedule());

  const editTarget = users.find((user) => user.id === editingUserId) ?? null;

  const submit = (formData: FormData) => {
    setMessage("");
    setError("");
    setFieldErrors({});

    const displayName = String(formData.get("displayName") ?? "");
    const username = String(formData.get("username") ?? "");
    const temporaryPassword = String(formData.get("temporaryPassword") ?? "");
    const rawRole = String(formData.get("role") ?? role);
    const normalizedRole =
      rawRole === "RESTAURANT_MANAGER" || rawRole === "WAITER" || rawRole === "KITCHEN"
        ? rawRole
        : role;

    startTransition(async () => {
      const result = await createTenantStaffUser({
        displayName,
        username,
        temporaryPassword,
        role: normalizedRole,
        weeklyShiftSchedule: null,
        notes: null,
      });

      if (!result.success) {
        setError(result.message ?? "Kullanıcı oluşturulamadı.");
        const resultWithFieldErrors = result as { fieldErrors?: FieldErrors };
        setFieldErrors(resultWithFieldErrors.fieldErrors ?? {});
        return;
      }

      setMessage(result.message ?? "Kullanıcı oluşturuldu.");
      setRole("WAITER");
      const form = document.getElementById("create-staff-user-form") as HTMLFormElement | null;
      form?.reset();
      router.refresh();
    });
  };

  return (
    <div className="space-y-5">
      <section className={`${SECTION_CARD_CLASS} p-4 sm:p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-2.5">
          <div>
            <h3 className="text-sm font-semibold text-[color:var(--ui-text-primary)]">Yeni Kullanıcı Ekle</h3>
            <p className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">
              Personel hesabı oluşturun, geçici şifre verin ve rol atamasını tamamlayın.
            </p>
          </div>
          <p className="text-xs text-[color:var(--ui-text-secondary)]">Personel hesabı oluşturma alanı</p>
        </div>

        <form
          id="create-staff-user-form"
          action={submit}
          className="mt-4 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4"
          autoComplete="off"
        >
          <div>
            <label htmlFor="displayName" className="mb-1 block text-xs font-medium text-[color:var(--ui-text-secondary)]">
              Ad Soyad
            </label>
            <input
              id="displayName"
              name="displayName"
              className={INPUT_CLASS}
              placeholder="Örn: Ahmet Yılmaz"
              autoComplete="name"
            />
            {fieldErrors.displayName ? (
              <p className="mt-1 text-xs text-[color:var(--ui-danger)]">{fieldErrors.displayName}</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="username" className="mb-1 block text-xs font-medium text-[color:var(--ui-text-secondary)]">
              Kullanıcı adı
            </label>
            <input
              id="username"
              name="username"
              className={INPUT_CLASS}
              placeholder="ornek.kullanici"
              autoComplete="username"
            />
            {fieldErrors.username ? (
              <p className="mt-1 text-xs text-[color:var(--ui-danger)]">{fieldErrors.username}</p>
            ) : null}
          </div>

          <div>
            <label
              htmlFor="temporaryPassword"
              className="mb-1 block text-xs font-medium text-[color:var(--ui-text-secondary)]"
            >
              Geçici şifre
            </label>
            <input
              id="temporaryPassword"
              name="temporaryPassword"
              type="password"
              className={INPUT_CLASS}
              placeholder="En az 8 karakter"
              autoComplete="new-password"
            />
            {fieldErrors.temporaryPassword ? (
              <p className="mt-1 text-xs text-[color:var(--ui-danger)]">{fieldErrors.temporaryPassword}</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="role" className="mb-1 block text-xs font-medium text-[color:var(--ui-text-secondary)]">
              Rol
            </label>
            <select
              id="role"
              name="role"
              value={role}
              onChange={(e) =>
                setRole(e.target.value as "RESTAURANT_MANAGER" | "WAITER" | "KITCHEN")
              }
              className={INPUT_CLASS}
            >
              <option value="RESTAURANT_MANAGER">Restoran Müdürü</option>
              <option value="WAITER">Garson</option>
              <option value="KITCHEN">Mutfak</option>
            </select>
            {fieldErrors.role ? <p className="mt-1 text-xs text-[color:var(--ui-danger)]">{fieldErrors.role}</p> : null}
          </div>

          {error ? (
            <p
              className={`${cardClasses({ tone: "danger" })} shadow-none px-3 py-2 text-sm font-medium text-[color:var(--ui-danger)] sm:col-span-2 xl:col-span-4`}
            >
              {error}
            </p>
          ) : null}
          {message ? (
            <p
              className={`${cardClasses({ tone: "success" })} shadow-none px-3 py-2 text-sm font-medium text-[color:var(--ui-success)] sm:col-span-2 xl:col-span-4`}
            >
              {message}
            </p>
          ) : null}

          <div className="sm:col-span-2 xl:col-span-4 mt-0.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="min-w-0 text-xs text-[color:var(--ui-text-secondary)]">
              Not: Rol ataması, kullanıcının panel erişimini doğrudan etkiler.
            </p>
            <button
              type="submit"
              disabled={isPending}
              className={buttonClasses({
                variant: "primary",
                size: "md",
                className: "h-10 w-full shrink-0 sm:w-auto",
              })}
            >
              {isPending ? "Oluşturuluyor..." : "Kullanıcı Oluştur"}
            </button>
          </div>
        </form>
      </section>

      <section className={SECTION_CARD_CLASS}>
        <div className="flex flex-wrap items-start justify-between gap-2.5 border-b border-[color:var(--ui-border)] px-4 py-3.5 sm:px-5">
          <div>
            <h3 className="text-sm font-semibold text-[color:var(--ui-text-primary)]">Kullanıcı Listesi</h3>
            <p className="mt-0.5 text-xs text-[color:var(--ui-text-secondary)]">
              Hesapları rol, aktiflik ve oluşturulma zamanı ile birlikte inceleyin.
            </p>
          </div>
          <span className="inline-flex items-center rounded-full border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-subtle)] px-2.5 py-1 text-xs font-medium text-[color:var(--ui-text-secondary)]">
            {users.length} kayıt
          </span>
        </div>

        {users.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm font-semibold text-[color:var(--ui-text-primary)]">Henüz kullanıcı bulunmuyor</p>
            <p className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">
              İlk personel hesabını yukarıdaki panelden ekleyerek başlayabilirsiniz.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[color:var(--ui-surface-subtle)]">
                <tr className="border-b border-[color:var(--ui-border)]">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)] sm:px-5">
                    Personel
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)] sm:px-5">
                    Kullanıcı Adı
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)] sm:px-5">
                    Rol
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)] sm:px-5">
                    Durum
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)] sm:px-5">
                    Çalışma planı
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)] sm:px-5">
                    Oluşturulma
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)] sm:px-5">
                    İşlemler
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const createdAt = formatDateParts(user.createdAt);
                  return (
                    <tr
                      key={user.id}
                      className="border-b border-[color:var(--ui-border-subtle)] transition-colors hover:bg-[color:var(--ui-surface-subtle)]"
                    >
                      <td className="px-4 py-3 sm:px-5">
                        <p className="max-w-64 truncate font-semibold text-[color:var(--ui-text-primary)]">
                          {resolvePersonDisplayName({ displayName: user.displayName }) || "Ad soyad girilmemiş"}
                        </p>
                        <p className="mt-0.5 text-xs text-[color:var(--ui-text-secondary)]">Personel #{user.id}</p>
                      </td>
                      <td className="px-4 py-3 sm:px-5">
                        <span
                          className="inline-flex max-w-56 truncate rounded-lg border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-subtle)] px-2.5 py-1 text-xs font-medium text-[color:var(--ui-text-secondary)]"
                          title={user.username}
                        >
                          {user.username}
                        </span>
                      </td>
                      <td className="px-4 py-3 sm:px-5">
                        <span className={badgeClasses(STAFF_ROLE_TONE[user.role] ?? "neutral")}>
                          {STAFF_ROLE_LABEL[user.role] ?? user.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 sm:px-5">
                        <span className={badgeClasses(user.isActive ? "success" : "neutral")}>
                          {user.isActive ? "Aktif" : "Pasif"}
                        </span>
                      </td>
                      <td className="px-4 py-3 sm:px-5">
                        <p className="max-w-80 text-xs leading-snug text-[color:var(--ui-text-secondary)]">{formatScheduleSummary(user)}</p>
                      </td>
                      <td className="px-4 py-3 sm:px-5">
                        <p className="font-medium tabular-nums text-[color:var(--ui-text-primary)]">{createdAt.day}</p>
                        <p className="mt-0.5 text-xs tabular-nums text-[color:var(--ui-text-secondary)]">{createdAt.time}</p>
                      </td>
                      <td className="px-4 py-3 sm:px-5">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setWeeklyEdit(
                                parseWeeklyShiftSchedule(user.weeklyShiftSchedule ?? null, {
                                  workingDays: user.workingDays,
                                  shiftStart: user.shiftStart,
                                  shiftEnd: user.shiftEnd,
                                }),
                              );
                              setEditingUserId(user.id);
                            }}
                            className="rounded-lg border border-[color:var(--ui-border)] px-2.5 py-1 text-xs font-medium text-[color:var(--ui-text-secondary)] hover:bg-[color:var(--ui-surface-subtle)]"
                          >
                            Düzenle
                          </button>
                          <button
                            type="button"
                            disabled={rowPendingId === user.id}
                            onClick={() => {
                              const newPassword = (managerPasswordInputs[user.id] ?? "").trim();
                              startTransition(async () => {
                                setRowPendingId(user.id);
                                const result = await resetTenantStaffPassword({
                                  id: user.id,
                                  newPassword,
                                  requirePasswordSetupOnNextLogin:
                                    passwordSetupOnNextLogin[user.id] ?? false,
                                });
                                setRowPendingId(null);
                                if (!result.success) {
                                  setError(result.message);
                                  return;
                                }
                                setMessage(result.message);
                                setManagerPasswordInputs((prev) => ({ ...prev, [user.id]: "" }));
                                router.refresh();
                              });
                            }}
                            className="rounded-lg border border-[color:var(--ui-border)] px-2.5 py-1 text-xs font-medium text-[color:var(--ui-text-secondary)] hover:bg-[color:var(--ui-surface-subtle)] disabled:opacity-60"
                          >
                            Åifreyi Ayarla
                          </button>
                          <button
                            type="button"
                            disabled={rowPendingId === user.id}
                            onClick={() => {
                              startTransition(async () => {
                                setRowPendingId(user.id);
                                const result = await forceTenantStaffPasswordReset({ id: user.id });
                                setRowPendingId(null);
                                if (!result.success) {
                                  setError(result.message);
                                  return;
                                }
                                setMessage(result.message);
                                router.refresh();
                              });
                            }}
                            className="rounded-lg border border-[color:var(--ui-border)] px-2.5 py-1 text-xs font-medium text-[color:var(--ui-text-secondary)] hover:bg-[color:var(--ui-surface-subtle)] disabled:opacity-60"
                          >
                            Sonraki girişte şifre zorla
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(user.id)}
                            className={buttonClasses({ variant: "danger", size: "xs", className: "h-8 px-2.5" })}
                          >
                            Sil
                          </button>
                        </div>
                        <div className="mt-2">
                          <input
                            type="password"
                            value={managerPasswordInputs[user.id] ?? ""}
                            onChange={(event) =>
                              setManagerPasswordInputs((prev) => ({ ...prev, [user.id]: event.target.value }))
                            }
                            className="h-8 w-full rounded-lg border border-[color:var(--ui-border)] px-2 text-xs text-[color:var(--ui-text-primary)]"
                            placeholder="Yeni şifre (min. 8)"
                            autoComplete="new-password"
                          />
                          <label className="mt-1.5 flex cursor-pointer items-start gap-2 text-xs text-[color:var(--ui-text-secondary)]">
                            <input
                              type="checkbox"
                              className="mt-0.5"
                              checked={passwordSetupOnNextLogin[user.id] ?? false}
                              onChange={(event) =>
                                setPasswordSetupOnNextLogin((prev) => ({
                                  ...prev,
                                  [user.id]: event.target.checked,
                                }))
                              }
                            />
                            <span>
                              Girişte şifre yenile (geçici şifre; kullanıcı ilk girişte yeni şifre belirler)
                            </span>
                          </label>
                        </div>
                        {user.mustSetPassword ? (
                          <p className="mt-1 text-xs font-medium text-[color:var(--ui-warning)]">İlk girişte şifre belirleme zorunlu</p>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editTarget ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/35 p-2.5 sm:p-4"
          role="presentation"
          onClick={() => setEditingUserId(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-user-modal-title"
            className="grid max-h-[min(92dvh,92vh)] w-full max-w-xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-2xl border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-bg)] shadow-none dark:border-neutral-700 dark:bg-neutral-900"
            onClick={(e) => e.stopPropagation()}
          >
            <form
              className="contents"
              onSubmit={(event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const formData = new FormData(form);
                startTransition(async () => {
                  const result = await updateTenantStaffUser({
                    id: editTarget.id,
                    displayName: String(formData.get("displayName") ?? ""),
                    role: String(formData.get("role") ?? "WAITER") as "RESTAURANT_MANAGER" | "WAITER" | "KITCHEN",
                    isActive: formData.get("isActive") === "on",
                    weeklyShiftSchedule: weeklyEdit,
                    notes: String(formData.get("notes") ?? "") || null,
                  });
                  if (!result.success) {
                    setError(result.message);
                    return;
                  }
                  setMessage(result.message);
                  setEditingUserId(null);
                  router.refresh();
                });
              }}
            >
              <div className="shrink-0 border-b border-[color:var(--ui-border)] px-3.5 py-3 sm:px-4 dark:border-neutral-700">
                <h4 id="edit-user-modal-title" className="text-base font-semibold text-[color:var(--ui-text-primary)] dark:text-neutral-100">
                  Kullanıcı Düzenle
                </h4>
                <p className="mt-1 text-xs leading-relaxed text-[color:var(--ui-text-secondary)] dark:text-neutral-400">
                  Aktiflik, rol, haftalık vardiya programı ve not alanlarını güncelleyin.
                </p>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-3.5 py-3 sm:px-4">
                <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                  <div className="min-w-0 sm:col-span-1">
                    <label className="mb-1 block text-xs font-medium text-[color:var(--ui-text-secondary)] dark:text-neutral-400">Ad soyad</label>
                    <input
                      name="displayName"
                      defaultValue={editTarget.displayName ?? ""}
                      className={`${INPUT_CLASS} w-full min-w-0`}
                      autoComplete="name"
                    />
                  </div>
                  <div className="min-w-0 sm:col-span-1">
                    <label className="mb-1 block text-xs font-medium text-[color:var(--ui-text-secondary)] dark:text-neutral-400">Rol</label>
                    <select
                      name="role"
                      defaultValue={editTarget.role === "MANAGER" ? "RESTAURANT_MANAGER" : editTarget.role}
                      className={`${INPUT_CLASS} w-full min-w-0`}
                    >
                      <option value="RESTAURANT_MANAGER">Restoran Müdürü</option>
                      <option value="WAITER">Garson</option>
                      <option value="KITCHEN">Mutfak</option>
                    </select>
                  </div>
                </div>
                <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-[color:var(--ui-text-secondary)] dark:text-neutral-200">
                  <input type="checkbox" name="isActive" defaultChecked={editTarget.isActive} className="shrink-0 rounded border-[color:var(--ui-border)]" />
                  Kullanıcı aktif
                </label>
                <div className="mt-3 min-w-0">
                  <p className="mb-1.5 text-xs font-medium text-[color:var(--ui-text-secondary)] dark:text-neutral-400">Haftalık vardiya</p>
                  <WeeklyShiftEditor value={weeklyEdit} onChange={setWeeklyEdit} variant="modal" />
                </div>
                <div className="mt-3 min-w-0">
                  <label className="mb-1 block text-xs font-medium text-[color:var(--ui-text-secondary)] dark:text-neutral-400">Not</label>
                  <textarea
                    name="notes"
                    defaultValue={editTarget.notes ?? ""}
                    rows={3}
                    className="w-full min-w-0 resize-y rounded-xl border border-[color:var(--ui-field-border)] bg-[color:var(--ui-surface-subtle)] px-3 py-2 text-sm text-[color:var(--ui-text-primary)] placeholder:text-[color:var(--ui-text-secondary)] dark:border-neutral-600 dark:bg-neutral-900/50 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                  />
                </div>
              </div>

              <div className="shrink-0 border-t border-[color:var(--ui-border)] bg-[color:var(--ui-surface-subtle)] px-3.5 py-3 dark:border-neutral-700 dark:bg-neutral-950/60">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingUserId(null)}
                    className="min-h-[40px] min-w-[88px] rounded-xl border border-[color:var(--ui-border)] px-3 py-2 text-sm font-medium text-[color:var(--ui-text-secondary)] hover:bg-[color:var(--ui-surface-subtle)] dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-800"
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className={buttonClasses({ variant: "primary", size: "md", className: "min-h-[40px] min-w-[88px] px-4" })}
                  >
                    {isPending ? "Kaydediliyorâ€¦" : "Kaydet"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {deleteConfirmId != null ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[color:var(--ui-border)] bg-white p-5 shadow-xl">
            <h4 className="text-base font-semibold text-[color:var(--ui-text-primary)]">Kullanıcıyı sil</h4>
            <p className="mt-2 text-sm text-[color:var(--ui-text-secondary)]">
              Bu işlem geri alınamaz. İlişkili kayıtlarda kullanıcı referansı güvenli şekilde temizlenir.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteConfirmId(null)} className="rounded-xl border border-[color:var(--ui-border)] px-3 py-2 text-sm">
                Vazgeç
              </button>
              <button
                type="button"
                className={buttonClasses({ variant: "danger", size: "md", className: "px-4" })}
                onClick={() => {
                  const id = deleteConfirmId;
                  startTransition(async () => {
                    const result = await deleteTenantStaffUser({ id });
                    if (!result.success) {
                      setError(result.message);
                      return;
                    }
                    setMessage(result.message);
                    setDeleteConfirmId(null);
                    router.refresh();
                  });
                }}
              >
                Evet, sil
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}


