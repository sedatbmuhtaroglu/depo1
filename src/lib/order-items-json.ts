/**
 * Order.items JSON helpers (cart lines + optional selectedOptions).
 * Keeps parity with create-order / createOrderManual payloads.
 */

export type OrderLineSelectedOptionGroup = {
  groupId: number;
  optionIds: number[];
};

export type OrderLineJson = {
  productId: number;
  quantity: number;
  price: number;
  selectedOptions?: OrderLineSelectedOptionGroup[];
};

function isPositiveInt(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

export function parseOrderLinesJson(items: unknown): OrderLineJson[] {
  if (!Array.isArray(items)) return [];
  const out: OrderLineJson[] = [];
  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const productId = Number(row.productId);
    const quantity = Math.floor(Number(row.quantity) || 0);
    const price = Number(row.price) || 0;
    if (!Number.isFinite(productId) || productId <= 0 || quantity <= 0 || !Number.isFinite(price)) {
      continue;
    }
    const selectedOptions: OrderLineSelectedOptionGroup[] = [];
    if (Array.isArray(row.selectedOptions)) {
      for (const g of row.selectedOptions) {
        if (!g || typeof g !== "object") continue;
        const gr = g as Record<string, unknown>;
        const groupId = Number(gr.groupId);
        if (!isPositiveInt(groupId)) continue;
        const optionIds: number[] = [];
        if (Array.isArray(gr.optionIds)) {
          for (const oid of gr.optionIds) {
            const id = Number(oid);
            if (isPositiveInt(id)) optionIds.push(id);
          }
        }
        if (optionIds.length > 0) {
          selectedOptions.push({ groupId, optionIds: [...new Set(optionIds)] });
        }
      }
    }
    out.push({
      productId,
      quantity,
      price,
      ...(selectedOptions.length > 0 ? { selectedOptions } : {}),
    });
  }
  return out;
}

export function buildOptionRowsFromOrderLines(lines: OrderLineJson[]): Array<{
  productId: number;
  optionId: number;
  quantity: number;
}> {
  const rows: Array<{ productId: number; optionId: number; quantity: number }> = [];
  for (const line of lines) {
    if (!line.selectedOptions?.length) continue;
    for (const group of line.selectedOptions) {
      for (const optionId of group.optionIds) {
        rows.push({
          productId: line.productId,
          optionId,
          quantity: line.quantity,
        });
      }
    }
  }
  return rows;
}

export function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

export function sumOrderLinesTotal(lines: OrderLineJson[]): number {
  let t = 0;
  for (const line of lines) {
    t += roundCurrency(line.price * line.quantity);
  }
  return roundCurrency(t);
}
