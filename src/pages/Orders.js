import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../api";
import "./Orders.css";
import * as XLSX from "xlsx";
import { EmptyRow } from "../App";


const SEVEN_MIN = 7 * 60 * 1000;
const ONE_MIN = 60 * 1000;

const persistOrder = async (order) => {
    try {
        await api.put(`/orders/${order.id}`, order);
    } catch (err) {
        console.error("Failed to persist order", err);
    }
};

const getCreatedTime = (order) => {
    if (order.createdAt) {
        const t = new Date(order.createdAt).getTime();
        return isNaN(t) ? Date.now() : t;
    }

    if (order.date) {
        const t = new Date(order.date).getTime();
        return isNaN(t) ? Date.now() : t;
    }

    return Date.now();
};

const normalizeStatus = (status = "") =>
    status.toLowerCase().trim();

const STATUS_ORDER = {
    placed: 1,
    preparing: 2,
    "service pickup": 3,
    completed: 4
};

const resolveQty = (item) =>
    Number(item.qty ?? item.quantity ?? 0);

const resolveUnitPrice = (item) =>
    item.price != null
        ? Number(item.price)
        : resolveQty(item) > 0
            ? Number(item.totalPrice || 0) / resolveQty(item)
            : 0;

const resolveRevenue = (item) =>
    Number(item.totalPrice ?? resolveUnitPrice(item) * resolveQty(item));

const Orders = ({ order, handleSort, sortConfig }) => {
    const navigate = useNavigate();
    const [orders, setOrders] = useState(order?.orders || []);
    const [activeOrderId, setActiveOrderId] = useState(null);
    const [pendingStatus, setPendingStatus] = useState(null);
    const [pickupConfirm, setPickupConfirm] = useState(null);
    const [, forceTick] = useState(0);
    const todayISO = new Date().toISOString().split("T")[0];
    const [fromDate, setFromDate] = useState(todayISO);
    const [toDate, setToDate] = useState(todayISO);
    const location = useLocation();
    const orderRefs = useRef({});

    useEffect(() => {
        const interval = setInterval(() => {
            forceTick(t => t + 1);
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (order?.orders?.length) {
            setOrders(order.orders);
        }
    }, [order]);

    useEffect(() => {
        const id = location.state?.scrollToOrderId;
        if (!id) return;

        const el = orderRefs.current[id];
        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            el.classList.add("highlight-order");

            setTimeout(() => {
                el.classList.remove("highlight-order");
            }, 2000);
        }
    }, [location.state]);

    /* ---------------- SAFE TOTAL RESOLUTION ---------------- */
    const resolveItemTotal = useCallback(
        (item) =>
            Number(
                item.totalPrice ??
                (item.price && item.qty ? item.price * item.qty : 0)
            ),
        []
    );

    /* ---------------- NORMALIZE ORDERS (RUNS ONCE PER CHANGE) ---------------- */
    const normalizedOrders = useMemo(() => {
        return orders.map(o => ({
            ...o,
            resolvedTotal:
                o.totalAmount ??
                o.items.reduce(
                    (sum, item) => sum + resolveItemTotal(item),
                    0
                )
        }));
    }, [orders, resolveItemTotal]);

    const formatDuration = (ms) => {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;

        return `${minutes}m ${seconds}s`;
    };

    const renderTimer = (order) => {
        if (order.status === "completed") return "—";

        const elapsed = Date.now() - getCreatedTime(order);

        // STOP timers once pickup clicked
        if (order.status === "service pickup") return "—";

        if (elapsed <= SEVEN_MIN) {
            const remaining = SEVEN_MIN - elapsed;
            return (
                <span style={{ color: "#2e7d32", fontWeight: 600 }}>
                    {formatDuration(remaining)}
                </span>
            );
        }

        return (
            <span style={{ color: "#d32f2f", fontWeight: 600 }}>
                +{formatDuration(elapsed - SEVEN_MIN)}
            </span>
        );
    };

    const renderItemTimer = (item, order) => {
        if (isCompletedOrder(order)) return "—";

        if (
            item.status === "completed" ||
            item.status === "service pickup"
        ) {
            return "—";
        }

        const start = item.createdAt
            ? new Date(item.createdAt).getTime()
            : getCreatedTime(order);

        if (isNaN(start)) return "—";

        const elapsed = Date.now() - start;
        const limit = SEVEN_MIN;

        if (elapsed <= limit) {
            return (
                <span style={{ color: "#2e7d32", fontWeight: 600 }}>
                    {formatDuration(limit - elapsed)}
                </span>
            );
        }

        return (
            <span style={{ color: "#d32f2f", fontWeight: 600 }}>
                +{formatDuration(elapsed - limit)}
            </span>
        );
    };

    const filteredOrders = useMemo(() => {
        const from = new Date(fromDate);
        from.setHours(0, 0, 0, 0);

        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);

        return normalizedOrders.filter(order => {
            if (!order.date) return false;

            const orderDate = new Date(order.date);
            return orderDate >= from && orderDate <= to;
        });
    }, [normalizedOrders, fromDate, toDate]);

    const sortedOrders = useMemo(() => {
        const data = [...filteredOrders];

        const sortKey = sortConfig.key ?? "id";
        const sortDir = sortConfig.direction ?? "desc";

        data.sort((a, b) => {
            switch (sortKey) {
                case "id":
                    return sortDir === "asc"
                        ? a.id.localeCompare(b.id)
                        : b.id.localeCompare(a.id);

                case "date":
                    return sortDir === "asc"
                        ? new Date(a.date) - new Date(b.date)
                        : new Date(b.date) - new Date(a.date);

                case "total":
                    return sortDir === "asc"
                        ? a.resolvedTotal - b.resolvedTotal
                        : b.resolvedTotal - a.resolvedTotal;

                case "status":
                    return sortDir === "asc"
                        ? STATUS_ORDER[normalizeStatus(a.status)] -
                        STATUS_ORDER[normalizeStatus(b.status)]
                        : STATUS_ORDER[normalizeStatus(b.status)] -
                        STATUS_ORDER[normalizeStatus(a.status)];

                default:
                    return 0;
            }
        });

        return data;
    }, [filteredOrders, sortConfig]);

    const deriveOrderStatusFromItems = (items) => {
        if (items.every(i => i.status === "completed")) return "completed";
        if (items.some(i => i.status === "preparing" || i.status === "service pickup"))
            return "preparing";
        return "placed";
    };

    useEffect(() => {
        if (!orders.length) return;

        setOrders(prev =>
            prev.map(order => ({
                ...order,
                status: order.status ?? "placed",
                items: order.items.map(item => ({
                    ...item,
                    status: item.status ?? "placed",
                    createdAt: item.createdAt ?? order.createdAt,
                    pickupAt: item.pickupAt ?? null
                }))
            }))
        );
    }, [order]);

    useEffect(() => {
        const interval = setInterval(() => {
            setOrders(prev => {
                let changed = false;

                const updated = prev.map(order => {
                    if (order.status !== "placed") return order;

                    const start = new Date(order.createdAt).getTime();
                    if (Date.now() - start < ONE_MIN) return order;

                    changed = true;

                    const items = order.items.map(item => ({
                        ...item,
                        status: "preparing",
                        createdAt: item.createdAt ?? order.createdAt
                    }));

                    const updatedOrder = {
                        ...order,
                        status: "preparing",
                        items
                    };

                    persistOrder(updatedOrder);
                    return updatedOrder;
                });

                return changed ? updated : prev;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            setOrders(prev => {
                let hasAnyChange = false;

                const updated = prev.map(order => {
                    let changed = false;

                    const items = order.items.map(item => {
                        if (item.status !== "service pickup") return item;

                        const start = new Date(item.pickupAt).getTime();
                        if (Date.now() - start >= ONE_MIN) {
                            changed = true;
                            return { ...item, status: "completed" };
                        }

                        return item;
                    });

                    if (!changed) return order;

                    hasAnyChange = true;
                    const allDone = items.every(i => i.status === "completed");

                    const newStatus = deriveOrderStatusFromItems(items);

                    const updatedOrder = {
                        ...order,
                        items,
                        status: newStatus,
                        ...(newStatus === "completed" && {
                            completedAt: order.completedAt ?? new Date().toISOString()
                        })
                    };

                    persistOrder(updatedOrder);
                    return updatedOrder;
                });

                return hasAnyChange ? updated : prev;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    const isCompletedOrder = (order) =>
        normalizeStatus(order.status) === "completed";

    const exportOrders = (orders, from, to) => {
        if (!orders.length) {
            alert("No orders in selected date range");
            return;
        }

        const rows = [];

        orders.forEach(order => {
            order.items.forEach(item => {
                const isCustomized =
                    (Array.isArray(item.ingredients) && item.ingredients.length > 0) ||
                    Boolean(item.notes);

                const ingredientsText = isCustomized
                    ? item.ingredients
                        ?.map(ing => `${ing.name} - ${ing.quantity}g`)
                        .join(", ")
                    : "-";

                rows.push({
                    OrderID: order.id,
                    Date: order.date,
                    Time: order.time ?? new Date(order.createdAt).toLocaleTimeString(),
                    Customer: order.userName || "",
                    Category: item.categoryId,
                    Dish: item.dishName,
                    Quantity: resolveQty(item),
                    Customized: isCustomized ? "Yes" : "No",
                    Ingredients: ingredientsText,
                    UnitPrice: resolveUnitPrice(item),
                    TotalPrice: resolveRevenue(item)
                });
            });
        });

        const sheet = XLSX.utils.json_to_sheet(rows);

        /* ✅ Auto column width (alignment fix) */
        const colWidths = Object.keys(rows[0]).map(key => ({
            wch: Math.max(
                key.length,
                ...rows.map(r => String(r[key] ?? "").length)
            ) + 2
        }));
        sheet["!cols"] = colWidths;

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, sheet, "Orders");

        XLSX.writeFile(
            workbook,
            `orders_${from}_to_${to}.xlsx`
        );
    };

    return (
        <div className="orders-page">

            <div className="orders-header">
                <h2 className="orders-title">Orders</h2>

                <div className="orders-filter">
                    {/* FROM DATE */}
                    <input
                        type="date"
                        value={fromDate}
                        max={toDate}
                        onChange={(e) => {
                            const selected = e.target.value;
                            if (selected > toDate) {
                                setFromDate(selected);
                                setToDate(selected);
                            } else {
                                setFromDate(selected);
                            }
                        }}
                    />

                    {/* TO DATE */}
                    <input
                        type="date"
                        value={toDate}
                        min={fromDate}
                        max={todayISO}
                        onChange={(e) => {
                            const selected = e.target.value;
                            if (selected < fromDate) {
                                setToDate(fromDate);
                            } else if (selected > todayISO) {
                                setToDate(todayISO);
                            } else {
                                setToDate(selected);
                            }
                        }}
                    />
                </div>

                <button
                    className="orders-export-btn"
                    onClick={() => exportOrders(filteredOrders, fromDate, toDate)}
                >
                    Export
                </button>

            </div>

            <div className="orders-table-wrapper">
                <table className="orders-table">
                    <thead>
                        <tr>
                            <th
                                onClick={() => handleSort("id")}
                                className={sortConfig.key === "id" ? "sorted" : ""}
                            >
                                <span className="th-content sort-th">
                                    <span>Order ID</span>
                                    <span className="sort-arrow">
                                        {sortConfig.direction === "asc" ? "▲" : "▼"}
                                    </span>
                                </span>
                            </th>
                            <th
                                onClick={() => handleSort("date")}
                                className={sortConfig.key === "date" ? "sorted" : ""}
                            >
                                <span className="th-content sort-th">
                                    <span>Date</span>
                                    <span className="sort-arrow">
                                        {sortConfig.direction === "asc" ? "▲" : "▼"}
                                    </span>
                                </span>
                            </th>
                            <th>time of order</th>
                            <th>Customer Name</th>
                            <th>No of Items</th>
                            <th>Total</th>
                            <th
                                onClick={() => handleSort("status")}
                                className={sortConfig.key === "status" ? "sorted" : ""}
                            >
                                <span className="th-content sort-th">
                                    <span>Status</span>
                                    <span className="sort-arrow">
                                        {sortConfig.key === "status"
                                            ? sortConfig.direction === "asc"
                                                ? "▲"
                                                : "▼"
                                            : ""}
                                    </span>
                                </span>
                            </th>
                        </tr>
                    </thead>

                    <tbody>
                        {sortedOrders.length === 0 ? (
                            <EmptyRow colSpan={7} message="No orders for selected date range" />
                        ) : (
                            sortedOrders.map(order => {
                                const orderStatus = deriveOrderStatusFromItems(order.items);
                                const allItemsCompleted = order.items.every(
                                    i => i.status === "completed"
                                );

                                return (
                                    <React.Fragment key={order.id}>
                                        {/* MAIN ORDER ROW */}
                                        <tr
                                            ref={el => (orderRefs.current[order.id] = el)}
                                            className="order-main-row"
                                        >
                                            <td
                                                className="clickable"
                                                onClick={() => navigate(`/orders/${order.id}`)}
                                            >
                                                {order.id}
                                            </td>
                                            <td>{order.date}</td>
                                            <td>{order.time}</td>
                                            <td>{order.userName}</td>
                                            <td>{order.items.length}</td>
                                            <td>₹{order.resolvedTotal}</td>
                                            <td className={`status status-${normalizeStatus(orderStatus).replace(/\s+/g, "-")}`}>
                                                {orderStatus}
                                            </td>
                                        </tr>

                                        {/* SUB TABLE – ITEM LEVEL */}
                                        <tr className="order-sub-row">
                                            <td colSpan={7}>
                                                <table className="order-items-table">
                                                    <thead>
                                                        <tr>
                                                            <th>Dish</th>
                                                            <th>Notes</th>
                                                            <th>Qty</th>
                                                            {order.status !== "completed" &&
                                                                <th>Timer</th>
                                                            }
                                                            <th>Status</th>
                                                            {order.status === "preparing" &&
                                                                <th>Action</th>
                                                            }
                                                        </tr>
                                                    </thead>

                                                    <tbody>
                                                        {order.items.map((item, idx) => (
                                                            <tr key={idx}>
                                                                <td
                                                                    className={item.categoryId === "combo" ? "combo-item" : "clickable"}
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();

                                                                        if (item.categoryId === "combo") return;

                                                                        navigate(
                                                                            `/dishes/${item.categoryId}/${item.dishId || "__custom__"}`,
                                                                            {
                                                                                state: {
                                                                                    fromOrder: true,
                                                                                    orderItem: item
                                                                                }
                                                                            }
                                                                        );
                                                                    }}
                                                                >
                                                                    {item.dishName}
                                                                </td>
                                                                <td>{item.notes ? item.notes : '-----------'}</td>
                                                                <td>{item.qty ?? item.quantity}</td>

                                                                {/* ITEM TIMER */}
                                                                {order.status !== "completed" &&
                                                                    <td>{renderItemTimer(item, order)}</td>
                                                                }

                                                                {/* ITEM STATUS */}
                                                                <td
                                                                    className={`status status-${normalizeStatus(item.status).replace(/\s+/g, "-")}`}                                                                >
                                                                    {item.status}
                                                                </td>

                                                                {/* ITEM PICKUP */}
                                                                {order.status === "preparing" &&
                                                                    <td>
                                                                        {item.status === "preparing" && (
                                                                            <button
                                                                                className="pickup-btn"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setPickupConfirm({ orderId: order.id, itemIndex: idx, item });
                                                                                }}
                                                                            >
                                                                                Order Pickup
                                                                            </button>
                                                                        )}
                                                                    </td>
                                                                }
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </td>
                                        </tr>

                                    </React.Fragment>
                                );
                            }))}
                    </tbody>
                </table>
            </div>
            {pickupConfirm && (
                <div
                    className="pickup-overlay"
                    onClick={() => setPickupConfirm(null)}
                >
                    <div
                        className="pickup-modal"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3>Confirm Order Pickup</h3>
                        <p>Are you sure you want to mark this item as picked up?</p>

                        {pickupConfirm?.item?.notes && (
                            <div className="pickup-notes">
                                <strong>Notes:</strong>
                                <div className="pickup-notes-text">
                                    {pickupConfirm.item.notes}
                                </div>
                            </div>
                        )}

                        {!pickupConfirm?.item?.notes && (
                            <div className="pickup-notes muted">
                                <strong>Notes:</strong> -----
                            </div>
                        )}

                        <div className="pickup-actions">
                            <button
                                className="btn-cancel"
                                onClick={() => setPickupConfirm(null)}
                            >
                                Cancel
                            </button>

                            <button
                                className="btn-confirm"
                                onClick={() => {
                                    const { orderId, itemIndex } = pickupConfirm;

                                    setOrders(prev =>
                                        prev.map(o => {
                                            if (o.id !== orderId) return o;

                                            const items = o.items.map((i, index) =>
                                                index === itemIndex
                                                    ? {
                                                        ...i,
                                                        status: "service pickup",
                                                        pickupAt: new Date().toISOString()
                                                    }
                                                    : i
                                            );

                                            const newStatus = deriveOrderStatusFromItems(items);

                                            const updated = {
                                                ...o,
                                                items,
                                                status: newStatus
                                            };

                                            persistOrder(updated);
                                            return updated;
                                        })
                                    );

                                    setPickupConfirm(null);
                                }}
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

};

export default Orders;
