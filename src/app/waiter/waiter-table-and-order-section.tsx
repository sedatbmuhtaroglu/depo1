"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import WaiterTableCards from "./waiter-table-cards";
import TablePaymentModal from "./table-payment-modal";
import ManualOrderFab from "./manual-order-fab";
import TableAccountTransferModal, { type TransferModalMode } from "./table-account-transfer-modal";

type TableRow = {
  id: number;
  tableNo: number;
  isActive: boolean;
  hasActiveOrders: boolean;
  lastOrder?: {
    status: string;
    createdAt: Date;
    totalPrice: string;
    id: number;
  };
};

type TableSummary = {
  tableId: number;
  tableNo: number;
  totalAmount: number;
  totalFromOrders: number;
  grossPaidAmount: number;
  refundedAmount: number;
  netPaidAmount: number;
  remainingAmount: number;
  overpaidAmount: number;
  paid: number;
  unpaid: number;
};

type Table = { id: number; tableNo: number; isActive: boolean };
type Product = { id: number; nameTR: string; price: number; categoryId: number };
type Category = { id: number; nameTR: string };

type Props = {
  tableRows: TableRow[];
  tableSummaries: TableSummary[];
  tables: Table[];
  products: Product[];
  categories: Category[];
  iyzicoEnabled: boolean;
};

export default function WaiterTableAndOrderSection({
  tableRows,
  tableSummaries,
  tables,
  products,
  categories,
  iyzicoEnabled,
}: Props) {
  const router = useRouter();
  const [paymentModalTableId, setPaymentModalTableId] = useState<number | null>(null);
  const [manualOrderTableId, setManualOrderTableId] = useState<number | null>(null);
  const [transferModal, setTransferModal] = useState<{
    mode: TransferModalMode;
    sourceTableId: number;
  } | null>(null);

  const paymentModalSummary =
    paymentModalTableId != null
      ? tableSummaries.find((s) => s.tableId === paymentModalTableId) ?? null
      : null;

  return (
    <>
      <WaiterTableCards
        tables={tableRows}
        tableSummaries={tableSummaries}
        onPaymentClick={(tableId) => setPaymentModalTableId(tableId)}
        onOrderClick={(tableId) => {
          setManualOrderTableId(tableId);
        }}
        onTransferFull={(tableId) => setTransferModal({ mode: "full", sourceTableId: tableId })}
        onTransferMerge={(tableId) => setTransferModal({ mode: "merge", sourceTableId: tableId })}
        onTransferPartial={(tableId) => setTransferModal({ mode: "partial", sourceTableId: tableId })}
      />

      <TableAccountTransferModal
        key={transferModal ? `${transferModal.mode}-${transferModal.sourceTableId}` : "closed"}
        mode={transferModal?.mode ?? null}
        sourceTableId={transferModal?.sourceTableId ?? null}
        tables={tables}
        onClose={() => setTransferModal(null)}
        onSuccess={() => router.refresh()}
      />

      <TablePaymentModal
        summary={paymentModalSummary}
        iyzicoEnabled={iyzicoEnabled}
        onClose={() => setPaymentModalTableId(null)}
        onSuccess={() => router.refresh()}
      />

      <ManualOrderFab
        tables={tables}
        products={products}
        categories={categories}
        openWithTableId={manualOrderTableId}
        onOpenWithTableIdCleared={() => setManualOrderTableId(null)}
      />
    </>
  );
}
