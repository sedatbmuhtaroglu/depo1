"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { buttonClasses, labelClasses } from "@/lib/ui/button-variants";
import { RichTextEditor } from "@/components/editor";
import { StickySaveBar, useFormDirtyState } from "@/modules/hq/components/sticky-save-bar";
import {
  resetLegalPublicPagesToDefaultsAction,
  saveLegalPublicPagesAction,
} from "@/modules/hq/actions/legal-public-pages";
import type { LegalPublicPagesV1 } from "@/modules/marketing/legal-public-pages";

type TabId = "kullanici" | "kvkk" | "gizlilik";

const TABS: { id: TabId; label: string; hint: string }[] = [
  { id: "kullanici", label: "Kullanıcı Sözleşmesi", hint: "/legal/kullanici-sozlesmesi" },
  { id: "kvkk", label: "KVKK Aydınlatma", hint: "/legal/kvkk" },
  { id: "gizlilik", label: "Gizlilik Politikası", hint: "/legal/gizlilik" },
];

type FormState = { ok: boolean; message: string };

const INITIAL: FormState = { ok: false, message: "" };

type HqLegalPagesFormProps = {
  initial: LegalPublicPagesV1;
};

export function HqLegalPagesForm({ initial }: HqLegalPagesFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [tab, setTab] = useState<TabId>("kullanici");
  const [kullanici, setKullanici] = useState(initial.kullaniciSozlesmesiHtml);
  const [kvkk, setKvkk] = useState(initial.kvkkHtml);
  const [gizlilik, setGizlilik] = useState(initial.gizlilikHtml);

  const [state, action, isPending] = useActionState(
    async (_prev: FormState, formData: FormData) => {
      const result = await saveLegalPublicPagesAction(formData);
      return { ok: result.success, message: result.message };
    },
    INITIAL,
  );

  const [resetState, resetAction, resetPending] = useActionState(
    async (_prev: FormState, _formData: FormData) => {
      const result = await resetLegalPublicPagesToDefaultsAction();
      return { ok: result.success, message: result.message };
    },
    INITIAL,
  );

  const { isDirty, markCurrentAsClean } = useFormDirtyState(formRef, [kullanici, kvkk, gizlilik]);

  useEffect(() => {
    if (state.ok) markCurrentAsClean();
  }, [markCurrentAsClean, state.ok]);

  useEffect(() => {
    if (resetState.ok) {
      markCurrentAsClean();
      window.location.reload();
    }
  }, [markCurrentAsClean, resetState.ok]);

  return (
    <div className="space-y-4">
      <form ref={formRef} action={action} className="space-y-4">
        <StickySaveBar
          saveLabel="Yasal metinleri kaydet"
          isPending={isPending}
          isDirty={isDirty}
          message={state.message}
          isMessageSuccess={state.ok}
        />

        <div className="flex flex-wrap gap-2 border-b border-[var(--ui-border)] pb-3">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={buttonClasses({
                variant: tab === t.id ? "primary" : "outline",
                size: "sm",
              })}
            >
              {t.label}
            </button>
          ))}
        </div>

        <p className="text-xs text-[var(--ui-text-secondary)]">
          Aktif sekme: <strong className="text-[var(--ui-text-primary)]">{TABS.find((x) => x.id === tab)?.hint}</strong>{" "}
          adresinde yayinlanir. Kayit sonrasi public sayfa otomatik guncellenir.
        </p>

        <input type="hidden" name="kullaniciHtml" value={kullanici} readOnly />
        <input type="hidden" name="kvkkHtml" value={kvkk} readOnly />
        <input type="hidden" name="gizlilikHtml" value={gizlilik} readOnly />

        {tab === "kullanici" ? (
          <RichTextEditor
            label="Kullanici Sozlesmesi (HTML)"
            value={kullanici}
            onChange={setKullanici}
            minHeight="420px"
            showCount
          />
        ) : null}
        {tab === "kvkk" ? (
          <RichTextEditor label="KVKK Aydinlatma (HTML)" value={kvkk} onChange={setKvkk} minHeight="420px" showCount />
        ) : null}
        {tab === "gizlilik" ? (
          <RichTextEditor
            label="Gizlilik Politikasi (HTML)"
            value={gizlilik}
            onChange={setGizlilik}
            minHeight="420px"
            showCount
          />
        ) : null}
      </form>

      <div className="rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface-muted)]/40 p-4">
        <p className={labelClasses()}>Tehlikeli bolge</p>
        <p className="mt-1 text-xs text-[var(--ui-text-secondary)]">
          Kod icindeki varsayilan metinlere donmek icin asagidaki dugmeyi kullanin. Mevcut HQ metinleri
          silinir ve marka adi guncel veritabani degeriyle yeniden uretilir.
        </p>
        <form action={resetAction} className="mt-3">
          <button
            type="submit"
            disabled={resetPending}
            className={buttonClasses({ variant: "outline", size: "sm" })}
          >
            {resetPending ? "Sifirlaniyor..." : "Varsayilanlara don"}
          </button>
          {resetState.message ? (
            <p className={`mt-2 text-sm ${resetState.ok ? "text-emerald-600" : "text-red-600"}`}>
              {resetState.message}
            </p>
          ) : null}
        </form>
      </div>
    </div>
  );
}
