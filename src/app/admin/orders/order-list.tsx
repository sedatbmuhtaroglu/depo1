'use client'

import React, { useTransition } from "react";
import { updateOrderStatus } from "@/app/actions/update-order-status";
import { Check, ChefHat, Clock } from "lucide-react";
import toast from "react-hot-toast";

type OrderItem = {
    productId: number;
    quantity: number;
    price: number;
    productName: string;
};

type Order = {
    id: number;
    table: { tableNo: number };
    items: OrderItem[];
    totalPrice: string;
    status:
        | 'PENDING_WAITER_APPROVAL'
        | 'PENDING'
        | 'PREPARING'
        | 'COMPLETED'
        | 'REJECTED';
    createdAt: Date;
};

export default function OrderList({ initialOrders }: { initialOrders: Order[] }) {
    const [isPending, startTransition] = useTransition();

    const handleStatusChange = (
        orderId: number,
        status:
            | 'PENDING'
            | 'PREPARING'
            | 'COMPLETED'
            | 'REJECTED',
    ) => {
        startTransition(async () => {
            const result = await updateOrderStatus(orderId, status);
            if (result.success) {
                toast.success(`Sipariş #${orderId} durumu güncellendi.`);
            } else {
                toast.error(result.message || "Güncelleme başarısız.");
            }
        });
    };

    const waitingApproval = initialOrders.filter(
        (order) => order.status === 'PENDING_WAITER_APPROVAL',
    );

    const kitchenOrders = initialOrders.filter(
        (order) => order.status !== 'PENDING_WAITER_APPROVAL',
    );

    if (initialOrders.length === 0) {
        return (
            <div className="text-center py-16 text-neutral-500 bg-white rounded-2xl shadow-sm border border-neutral-200">
                Henüz verilmiş bir sipariş bulunmuyor.
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Garson onayı bekleyen siparişler */}
            {waitingApproval.length > 0 && (
                <section>
                    <h2 className="mb-4 text-lg font-semibold text-neutral-800">
                        Onay Bekleyen Siparişler
                    </h2>
                    <div className="space-y-4">
                        {waitingApproval.map((order) => (
                            <div
                                key={order.id}
                                className="flex flex-col bg-white rounded-2xl shadow-sm border border-yellow-300/80 overflow-hidden"
                            >
                                <div className="flex items-center justify-between border-b border-yellow-200 bg-yellow-50 px-4 py-3">
                                    <div className="flex items-center space-x-2">
                                        <span className="text-lg font-extrabold text-neutral-900">
                                            Masa {order.table.tableNo}
                                        </span>
                                        <span className="text-xs font-semibold text-neutral-500 px-1.5 py-0.5 bg-neutral-100 rounded">
                                            #{order.id}
                                        </span>
                                    </div>
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 border border-yellow-200 shadow-sm">
                                        <Clock className="w-3.5 h-3.5 mr-1" />
                                        Garson Onayı Bekliyor
                                    </span>
                                </div>

                                <div className="p-4">
                                    <ul className="space-y-2 text-sm">
                                        {order.items.map((item, idx) => (
                                            <li
                                                key={idx}
                                                className="flex justify-between items-start"
                                            >
                                                <div className="flex items-start max-w-[80%]">
                                                    <span className="font-bold text-neutral-900 mr-2 min-w-[1.5rem]">
                                                        {item.quantity}x
                                                    </span>
                                                    <span className="text-neutral-700 leading-snug">
                                                        {item.productName}
                                                    </span>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="flex items-center justify-between border-t border-neutral-100 bg-neutral-50 px-4 py-3">
                                    <div className="text-sm text-neutral-500">
                                        {new Date(order.createdAt).toLocaleTimeString('tr-TR', {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })}
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <button
                                            disabled={isPending}
                                            onClick={() => handleStatusChange(order.id, 'REJECTED')}
                                            className="px-3 py-2 text-sm font-semibold rounded-xl border border-red-200 text-red-600 bg-white hover:bg-red-50 transition-all"
                                        >
                                            Reddet
                                        </button>
                                        <button
                                            disabled={isPending}
                                            onClick={() => handleStatusChange(order.id, 'PENDING')}
                                            className="px-3 py-2 text-sm font-semibold rounded-xl bg-green-500 text-white hover:bg-green-600 shadow-sm shadow-green-500/20 active:scale-95 transition-all"
                                        >
                                            Onayla
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Mutfak / aktif siparişler */}
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {kitchenOrders.map((order) => (
                <div
                    key={order.id}
                    className={`flex flex-col bg-white rounded-2xl shadow-sm border transition-all duration-300 ${order.status === 'COMPLETED' ? 'border-neutral-200 opacity-60 bg-neutral-50' :
                            order.status === 'PREPARING' ? 'border-blue-400 shadow-blue-100/50 shadow-md ring-1 ring-blue-50' :
                                'border-neutral-200 hover:shadow-md'
                        } overflow-hidden`}
                >
                    {/* Header */}
                    <div className={`p-4 border-b flex justify-between items-center ${order.status === 'COMPLETED' ? 'bg-neutral-100/50 border-neutral-200' :
                            order.status === 'PREPARING' ? 'bg-blue-50/50 border-blue-100' :
                                'bg-neutral-50/80 border-neutral-100'
                        }`}>
                        <div className="flex items-center space-x-2">
                            <span className="text-xl font-extrabold text-neutral-800">Masa {order.table.tableNo}</span>
                            <span className="text-xs font-semibold text-neutral-400 px-1.5 py-0.5 bg-neutral-100 rounded">#{order.id}</span>
                        </div>

                        {order.status === 'PENDING' && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 border border-yellow-200 shadow-sm">
                                <Clock className="w-3.5 h-3.5 mr-1" /> Bekliyor
                            </span>
                        )}
                        {order.status === 'PREPARING' && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200 shadow-sm">
                                <ChefHat className="w-3.5 h-3.5 mr-1" /> Hazırlanıyor
                            </span>
                        )}
                        {order.status === 'COMPLETED' && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-200 shadow-sm">
                                <Check className="w-3.5 h-3.5 mr-1" /> Tamamlandı
                            </span>
                        )}
                        {order.status === 'REJECTED' && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200 shadow-sm">
                                <Clock className="w-3.5 h-3.5 mr-1" /> Reddedildi
                            </span>
                        )}
                    </div>

                    {/* Items */}
                    <div className="p-5 flex-grow">
                        <ul className="space-y-3">
                            {order.items.map((item, idx) => (
                                <li key={idx} className="flex justify-between items-start text-sm pb-2 border-b border-dashed border-neutral-100 last:border-0 last:pb-0">
                                    <div className="flex items-start max-w-[80%]">
                                        <span className="font-bold text-neutral-900 mr-2 min-w-[1.5rem]">{item.quantity}x</span>
                                        <span className="text-neutral-700 leading-snug">{item.productName}</span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Footer & Actions */}
                    <div className="p-4 bg-neutral-50/50 border-t border-neutral-100 mt-auto">
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-sm text-neutral-500 font-medium">
                                {new Date(order.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="text-lg font-bold text-neutral-900">₺{order.totalPrice}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            {order.status !== 'COMPLETED' && (
                                <>
                                    <button
                                        disabled={isPending || order.status === 'PREPARING'}
                                        onClick={() => handleStatusChange(order.id, 'PREPARING')}
                                        className={`px-3 py-2.5 text-sm font-semibold rounded-xl flex items-center justify-center transition-all ${order.status === 'PREPARING'
                                                ? 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
                                                : 'bg-white text-blue-600 border-2 border-blue-200 hover:border-blue-500 hover:bg-blue-50 shadow-sm'
                                            }`}
                                    >
                                        Hazırlanıyor
                                    </button>
                                    <button
                                        disabled={isPending}
                                        onClick={() => handleStatusChange(order.id, 'COMPLETED')}
                                        className="px-3 py-2.5 text-sm font-semibold rounded-xl flex items-center justify-center bg-green-500 text-white hover:bg-green-600 shadow-sm shadow-green-500/20 active:scale-95 transition-all"
                                    >
                                        Tamamla
                                    </button>
                                </>
                            )}
                        </div>
                        {order.status === 'COMPLETED' && (
                            <div className="w-full text-center py-2 text-sm text-neutral-400 font-medium">
                                Bu sipariş tamamlandı.
                            </div>
                        )}
                    </div>
                </div>
                ))}
            </div>
        </div>
    );
}
