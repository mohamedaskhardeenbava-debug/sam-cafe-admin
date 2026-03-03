import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../api";
import "./Orders.css";
import * as XLSX from "xlsx";
import { EmptyRow } from "../App";
import { QRCodeCanvas } from "qrcode.react";
import { createPortal } from "react-dom"; import dayjs from "dayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { TextField } from "@mui/material";


const SEVEN_MIN = 7 * 60 * 1000;
const ONE_MIN = 60 * 1000;
const DATE_STORAGE_KEY = "orders_date_filter";

const formatIndianTime = (dateStr, timeStr) => {
    if (!dateStr || !timeStr) return "—";

    const dateTime = new Date(`${dateStr}T${timeStr}`);

    if (isNaN(dateTime.getTime())) return timeStr;

    return dateTime.toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "numeric",
        minute: "2-digit",
        hour12: true
    });
};

const sendWhatsApp = async (order, status) => {
    if (!order.mobile) return;

    const templateMap = {
        placed: "order_placed",

        preparing: "order_preparing",
        "service pickup": "order_ready",
        completed: "order_completed"
    };

    const template = templateMap[status];
    if (!template) return;

    try {
        await api.post("/whatsapp/order-status", {
            phone: `91${order.mobile}`,
            template,
            vars: [order.userName || "Customer", order.id]
        });
    } catch (err) {
        console.error("WhatsApp send failed", err);
    }
};

const persistOrder = async (order, refresh) => {
    try {
        await api.put(`/orders/${order.id}`, order);
        refresh && refresh();
    } catch (err) {
        console.error("Failed to persist order", err);
    }
};

const persistOrderEverywhere = async (updatedOrder) => {
    // 1️⃣ Update global orders (always valid)
    await api.put(`/orders/${updatedOrder.id}`, updatedOrder);

    // 2️⃣ If no userId → STOP (TAKE AWAY / guest orders)
    if (!updatedOrder.userId) {
        console.warn("ℹ️ Order has no userId, skipping user sync");
        return;
    }

    // 3️⃣ Fetch user safely
    let user;
    try {
        const userRes = await api.get(`/users/${updatedOrder.userId}`);
        user = userRes.data;
    } catch {
        console.warn("⚠️ User not found, skipping user sync");
        return;
    }

    if (!Array.isArray(user.orders)) return;

    // 4️⃣ Update embedded order
    const updatedUser = {
        ...user,
        orders: user.orders.map(o =>
            o.id === updatedOrder.id ? updatedOrder : o
        )
    };

    await api.put(`/users/${user.id}`, updatedUser);
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

const StableQRCode = React.memo(({ value }) => {
    return (
        <QRCodeCanvas
            value={value}
            size={120}
            level="M"
            includeMargin
        />
    );
});

const BillLayout = React.memo(({ order, editable, onQtyChange, buildUpiUrl, onClose }) => {
    const totals = useMemo(() => {
        const subTotal = order.items.reduce(
            (sum, i) => sum + Number(i.totalPrice || 0),
            0
        );
        const cgst = +(subTotal * 0.025).toFixed(2);
        const sgst = +(subTotal * 0.025).toFixed(2);
        return {
            subTotal,
            cgst,
            sgst,
            total: +(subTotal + cgst + sgst).toFixed(2)
        };
    }, [order.items]);

    const qrValue = useMemo(
        () => buildUpiUrl(totals.total, order.id),
        [totals.total, order.id, buildUpiUrl]
    );

    return (
        <div className="bill-receipt">
            <div className="bill-header">
                <button
                    className="orders-close-btn"
                    onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                    }}
                ></button>
                <h3>Sam Cafe</h3>
                <p>Contact: +91-9080179608</p>
                <hr />
                <p>Order : {order.id}</p>
                <p>Date  : {order.date}</p>
                <p>
                    Time  : {formatIndianTime(order.date, order.time)}
                </p>
                <hr />
            </div>

            <div className="bill-table">
                <div className="bill-row head">
                    <span>ITEM</span>
                    <span>QTY</span>
                    <span>TOTAL</span>
                </div>

                {order.items.map((item, idx) => (
                    <div key={idx} className="bill-row">
                        <span>{item.dishName}</span>

                        {editable ? (
                            <>
                                <input
                                    type="number"
                                    min="1"
                                    value={item.quantity}
                                    onChange={(e) =>
                                        onQtyChange(idx, {
                                            quantity: e.target.value,
                                            price: resolveUnitPrice(item)
                                        })
                                    }
                                />

                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={resolveUnitPrice(item)}
                                    onChange={(e) =>
                                        onQtyChange(idx, {
                                            quantity: item.quantity,
                                            price: Number(e.target.value)
                                        })
                                    }
                                />
                            </>
                        ) : (
                            <span>{item.quantity}</span>
                        )}

                        <span>₹{item.totalPrice}</span>
                    </div>
                ))}
            </div>

            <hr />

            <div className="bill-summary">
                <div><span>Subtotal</span><span>₹{totals.subTotal}</span></div>
                <div><span>CGST @2.5%</span><span>₹{totals.cgst}</span></div>
                <div><span>SGST @2.5%</span><span>₹{totals.sgst}</span></div>
                <div className="total">
                    <span>TOTAL</span>
                    <span>₹{totals.total}</span>
                </div>
            </div>

            <div className="bill-qr-section">
                <div className="bill-qr-title">Scan To Pay</div>
                <StableQRCode value={qrValue} />
            </div>
        </div>
    );
});

const Orders = ({ order, handleSort, sortConfig, adminData, setAdminData }) => {
    const navigate = useNavigate();
    const orders = adminData.orders;
    const [openOrderIds, setOpenOrderIds] = useState([]);
    const [pendingStatus, setPendingStatus] = useState(null);
    const [pickupConfirm, setPickupConfirm] = useState(null);
    const [statusFilter, setStatusFilter] = useState("all");
    const [modeFilter, setModeFilter] = useState("all");
    const [openStatusDropdown, setOpenStatusDropdown] = useState(false);
    const [openModeDropdown, setOpenModeDropdown] = useState(false);
    const [, forceTick] = useState(0);
    const todayISO = new Date().toISOString().split("T")[0];
    const toggleOrder = (orderId) => {
        setOpenOrderIds(prev => {
            if (prev.includes(orderId)) {
                // close it
                return prev.filter(id => id !== orderId);
            } else {
                // open it
                return [...prev, orderId];
            }
        });
    };

    const savedDates = JSON.parse(
        localStorage.getItem(DATE_STORAGE_KEY) || "null"
    );

    const [fromDate, setFromDate] = useState(
        savedDates?.fromDate || todayISO
    );

    const [toDate, setToDate] = useState(
        savedDates?.toDate || todayISO
    );
    const location = useLocation();
    const orderRefs = useRef({});
    const [selectedTemplate, setSelectedTemplate] = useState("");
    const [sendingOrderId, setSendingOrderId] = useState(null);
    const [openMenuOrderId, setOpenMenuOrderId] = useState(null);
    const [editBillOrder, setEditBillOrder] = useState(null);
    const [previewBillOrder, setPreviewBillOrder] = useState(null);
    const [editableBill, setEditableBill] = useState(null);
    const [menuPos, setMenuPos] = useState(null);

    const [openFrom, setOpenFrom] = useState(false);
    const [openTo, setOpenTo] = useState(false);

    useEffect(() => {
        const id = location.state?.scrollToOrderId;
        if (!id) return;

        const el = orderRefs.current[id];
        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            el.classList.add("blink");

            setTimeout(() => {
                el.classList.remove("blink");
            }, 900);
        }
    }, [location.state]);

    const buildUpiUrl = (amount, orderId) => {
        const upiId = "9019081708@upi";
        const name = "Sam Cafe";

        return (
            `upi://pay?pa=${upiId}` +
            `&pn=${encodeURIComponent(name)}` +
            `&am=${amount}` +
            `&cu=INR` +
            `&tn=Order%20${orderId}` +
            `&tr=ORDER_${orderId}`
        );
    };

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
                ),

            whatsappSent: o.whatsappSent || {},
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
        // If item is completed or picked up, stop timer
        if (
            item.status === "completed" ||
            item.status === "service pickup"
        ) {
            return "—";
        }

        // Use item created time if available, else fallback to order
        const start = item.createdAt
            ? new Date(item.createdAt).getTime()
            : getCreatedTime(order);

        if (isNaN(start)) return "—";

        const elapsed = Date.now() - start;

        if (elapsed <= SEVEN_MIN) {
            return (
                <span style={{ color: "#2e7d32", fontWeight: 600 }}>
                    {formatDuration(SEVEN_MIN - elapsed)}
                </span>
            );
        }

        return (
            <span style={{ color: "#d32f2f", fontWeight: 600 }}>
                +{formatDuration(elapsed - SEVEN_MIN)}
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
            const withinDate = orderDate >= from && orderDate <= to;

            const matchesStatus =
                statusFilter === "all" ||
                normalizeStatus(order.status) === statusFilter;

            const orderMode = (order.mode || "take away").toLowerCase();

            const matchesMode =
                modeFilter === "all" ||
                orderMode === modeFilter;

            return withinDate && matchesStatus && matchesMode;
        });
    }, [normalizedOrders, fromDate, toDate, statusFilter, modeFilter]);

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
        if (!order?.orders?.length) return;

        setAdminData(prev => ({
            ...prev,
            orders: order.orders.map(order => ({
                ...order,
                status: order.status || "placed",
                whatsappSent: order.whatsappSent || {},
                items: order.items.map(item => {
                    if (
                        item.status === "service pickup" ||
                        item.status === "completed"
                    ) {
                        return item;
                    }

                    return {
                        ...item,
                        status: item.status || "placed",
                        createdAt: item.createdAt || order.createdAt,
                        pickupAt: item.pickupAt || null
                    };
                })
            }))
        }));
    }, [order]);

    useEffect(() => {
        const interval = setInterval(() => {
            setAdminData(prev => {
                let hasChange = false;

                const updatedOrders = prev.orders.map(order => {
                    if (
                        order.items.some(
                            i => i.status === "service pickup" || i.status === "completed"
                        )
                    ) {
                        return order;
                    }

                    const start = new Date(order.createdAt).getTime();
                    if (Date.now() - start < ONE_MIN) return order;

                    hasChange = true;

                    const updatedItems = order.items.map(item => {
                        if (item.status !== "placed") return item;

                        return {
                            ...item,
                            status: "preparing"
                        };
                    });

                    return {
                        ...order,
                        items: updatedItems,
                        status: "preparing"
                    };
                });

                if (!hasChange) return prev;

                return {
                    ...prev,
                    orders: updatedOrders
                };
            });
        }, 5000); // 🔥 check every 5 seconds instead of 1

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            setAdminData(prev => {
                let hasAnyChange = false;

                const updated = prev.orders.map(order => {
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

                    return {
                        ...order,
                        items,
                        status: deriveOrderStatusFromItems(items)
                    };
                });

                if (!hasAnyChange) return prev;

                return {
                    ...prev,
                    orders: updated
                };
            });
        }, 5000); // 🔥 5 seconds

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        localStorage.setItem(
            DATE_STORAGE_KEY,
            JSON.stringify({ fromDate, toDate })
        );
    }, [fromDate, toDate]);

    useEffect(() => {
        if (!location.state) return;

        const { mode, status, fromDate: fd, toDate: td } = location.state;

        if (mode) setModeFilter(mode);
        if (status) setStatusFilter(status);
        if (fd) setFromDate(fd);
        if (td) setToDate(td);

    }, [location.state]);

    useEffect(() => {
        const close = () => {
            setOpenStatusDropdown(false);
            setOpenModeDropdown(false);
        };

        window.addEventListener("click", close);
        return () => window.removeEventListener("click", close);
    }, []);

    const exportOrders = (orders, from, to) => {
        if (!orders.length) {
            alert("No orders in selected date range");
            return;
        }

        const rows = [];

        sortedOrders.forEach(order => {
            order.items.forEach((item, index) => {
                const ingredients = (item.ingredients || [])
                    .map(i => `${i.name} - ${i.quantity}g`)
                    .join(", ");

                rows.push({
                    OrderID: index === 0 ? order.id : "",
                    Date: index === 0 ? order.date : "",
                    Time: index === 0 ? order.time : "",
                    Customer: index === 0 ? (order.userName || "Guest") : "",
                    Category: item.categoryName || item.categoryId || "",
                    Dish: item.dishName,
                    Quantity: item.quantity ?? item.qty ?? 0,
                    Customized: item.isCustomized ? "Yes" : "No",
                    Ingredients: ingredients
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

    const printBill = async (order) => {
        try {
            const billData = {
                orderId: order.id,
                date: order.date,
                time: order.time,
                customer: order.userName || "Guest",
                items: order.items.map(item => ({
                    name: item.dishName,
                    qty: item.quantity,
                    price: item.totalPrice
                })),
                subtotal: order.resolvedTotal,
                cgst: +(order.resolvedTotal * 0.025).toFixed(2),
                sgst: +(order.resolvedTotal * 0.025).toFixed(2),
                total: +(order.resolvedTotal * 1.05).toFixed(2),
                upiUrl: buildUpiUrl((order.resolvedTotal * 1.05).toFixed(2))
            };

            await api.post("http://localhost:9001/print/bill", billData);
        } catch (err) {
            alert("Failed to print bill");
            console.error(err);
        }
    };

    const buildBillTotals = (order) => {
        const subTotal = order.items.reduce(
            (sum, i) => sum + Number(i.totalPrice || 0),
            0
        );

        const cgst = +(subTotal * 0.025).toFixed(2);
        const sgst = +(subTotal * 0.025).toFixed(2);

        return {
            subTotal,
            cgst,
            sgst,
            total: +(subTotal + cgst + sgst).toFixed(2)
        };
    };

    const closeAllBillOverlays = () => {
        setEditBillOrder(null);
        setPreviewBillOrder(null);
    };

    const closeOptionsMenu = () => {
        setOpenMenuOrderId(null);
        setMenuPos(null);
    };

    const recalcOrderTotals = (order) => {
        const items = order.items.map(item => {
            const qty = Number(item.quantity || 0);
            const price = Number(
                item.price ??
                item.unitPrice ??
                resolveUnitPrice(item)
            );

            const totalPrice = +(qty * price).toFixed(2);

            return {
                ...item,
                quantity: qty,
                price,
                unitPrice: price,   // normalize
                totalPrice
            };
        });

        const subTotal = +items.reduce(
            (sum, i) => sum + i.totalPrice,
            0
        ).toFixed(2);

        const cgst = +(subTotal * 0.025).toFixed(2);
        const sgst = +(subTotal * 0.025).toFixed(2);
        const total = +(subTotal + cgst + sgst).toFixed(2);

        return {
            ...order,
            items,
            totalAmount: subTotal,
            totalWithGST: {
                subTotal,
                cgst,
                sgst,
                total
            }
        };
    };

    const OrderRow = React.memo(({
        order,
        toggleOrder,
        openOrderIds,
        navigate,
        renderItemTimer,
        deriveOrderStatusFromItems,
        normalizeStatus,
        orderRefs,
        setPickupConfirm
    }) => {

        const isOpen = openOrderIds.includes(order.id);
        const orderStatus = deriveOrderStatusFromItems(order.items);

        return (
            <>
                {/* ================= MAIN ROW ================= */}
                <tr
                    ref={el => (orderRefs.current[order.id] = el)}
                    className="order-main-row"
                    onClick={() => toggleOrder(order.id)}
                >
                    <td
                        className="clickable"
                        onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/orders/${order.id}`);
                        }}
                    >
                        {order.id}
                    </td>

                    <td>{order.date}</td>
                    <td>{formatIndianTime(order.date, order.time)}</td>
                    <td>{order.userName}</td>
                    <td>
                        {order.mode ? order.mode.toUpperCase() : "TAKE AWAY"}
                    </td>
                    <td>{order.tableNo ?? "---"}</td>
                    <td>{order.items.length}</td>
                    <td>₹{order.resolvedTotal}</td>

                    <td>
                        <div
                            className={`status status-${normalizeStatus(orderStatus).replace(/\s+/g, "-")}`}
                        >
                            {orderStatus}
                        </div>
                    </td>

                    <td>
                        <div className="bill-actions">
                            <button
                                className="options-btn"
                                onClick={(e) => e.stopPropagation()}
                            >
                                ⋮
                            </button>
                        </div>
                    </td>
                </tr>

                {/* ================= SUB ROW ================= */}
                <tr className={`order-sub-row ${isOpen ? "open" : ""}`}>
                    <td colSpan={10}>
                        <div className="order-sub-content">
                            <table className="order-items-table">
                                <thead>
                                    <tr>
                                        <th>Dish</th>
                                        <th>Notes</th>
                                        <th>Qty</th>
                                        <th>Timer</th>
                                        <th>Status</th>
                                        {order.status === "preparing" && (
                                            <th>Action</th>
                                        )}
                                    </tr>
                                </thead>

                                <tbody>
                                    {order.items.map((item, idx) => (
                                        <tr key={idx}>
                                            <td
                                                className={
                                                    item.categoryId === "combo"
                                                        ? "combo-item"
                                                        : "clickable"
                                                }
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

                                            <td>
                                                {item.notes ? item.notes : "-----------"}
                                            </td>

                                            <td>{item.qty ?? item.quantity}</td>

                                            {/* TIMER */}
                                            <td>
                                                {item.pickupStatus === "on_time" && (
                                                    <span style={{ color: "#2e7d32", fontWeight: 600 }}>
                                                        On Time
                                                    </span>
                                                )}

                                                {item.pickupStatus === "late" && (
                                                    <span style={{ color: "#d32f2f", fontWeight: 600 }}>
                                                        Late Order
                                                    </span>
                                                )}

                                                {!item.pickupStatus &&
                                                    renderItemTimer(item, order)}
                                            </td>

                                            {/* STATUS */}
                                            <td>
                                                <div
                                                    className={`status status-${normalizeStatus(item.status).replace(/\s+/g, "-")}`}
                                                >
                                                    {item.status}
                                                </div>
                                            </td>

                                            {/* PICKUP BUTTON */}
                                            {order.status === "preparing" && (
                                                <td>
                                                    {item.status === "preparing" && (
                                                        <button
                                                            className="pickup-btn"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setPickupConfirm({
                                                                    orderId: order.id,
                                                                    itemIndex: idx,
                                                                    item
                                                                });
                                                            }}
                                                        >
                                                            Order Pickup
                                                        </button>
                                                    )}
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </td>
                </tr>
            </>
        );
    },
        (prev, next) =>
            prev.order === next.order &&
            prev.openOrderIds === next.openOrderIds
    );

    return (
        <div className="orders-page">

            <div className="orders-header">
                <h2 className="orders-title">Orders</h2>

                <div className="orders-dropdown-wrapper">
                    <button
                        className="orders-status-dropdown"
                        onClick={(e) => {
                            e.stopPropagation();
                            setOpenModeDropdown(false);
                            setOpenStatusDropdown(prev => !prev);
                        }}
                    >
                        {statusFilter === "all" ? "All Status" : statusFilter}
                    </button>

                    {openStatusDropdown && (
                        <div className="orders-dropdown-menu">
                            {["all", "placed", "preparing", "service pickup", "completed"]
                                .map(status => (
                                    <div
                                        key={status}
                                        onClick={() => {
                                            setStatusFilter(status);
                                            setOpenStatusDropdown(false);
                                            status === "all"
                                                ? handleSort("id")
                                                : handleSort("status");
                                        }}
                                    >
                                        {status === "all"
                                            ? "All Status"
                                            : status}
                                    </div>
                                ))}
                        </div>
                    )}
                </div>

                <div className="orders-dropdown-wrapper">
                    <button
                        className="orders-status-dropdown"
                        onClick={(e) => {
                            e.stopPropagation();
                            setOpenStatusDropdown(false);
                            setOpenModeDropdown(prev => !prev);
                        }}
                    >
                        {modeFilter === "all" ? "All Modes" : modeFilter}
                    </button>

                    {openModeDropdown && (
                        <div className="orders-dropdown-menu">
                            {["all", "dine in", "take away"].map(mode => (
                                <div
                                    key={mode}
                                    onClick={() => {
                                        setModeFilter(mode);
                                        setOpenModeDropdown(false);
                                    }}
                                >
                                    {mode === "all"
                                        ? "All Modes"
                                        : mode}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="orders-filter">
                    <button
                        type="button"
                        className="orders-today-btn"
                        onClick={() => {
                            setFromDate(todayISO);
                            setToDate(todayISO);
                        }}
                    >
                        Today
                    </button>

                    <LocalizationProvider dateAdapter={AdapterDayjs}>

                        {/* FROM DATE WRAPPER */}
                        <div
                            style={{ display: "inline-block" }}
                            onClick={() => setOpenFrom(true)}
                        >
                            <DatePicker
                                open={openFrom}
                                onClose={() => setOpenFrom(false)}
                                value={dayjs(fromDate)}
                                format="DD/MM/YYYY"
                                maxDate={dayjs(toDate)}
                                onChange={(newValue) => {
                                    if (!newValue) return;

                                    const selected = newValue.format("YYYY-MM-DD");

                                    if (selected > toDate) {
                                        setFromDate(selected);
                                        setToDate(selected);
                                    } else {
                                        setFromDate(selected);
                                    }

                                    setOpenFrom(false);
                                }}
                                slotProps={{
                                    field: {
                                        sx: {
                                            minWidth: 140,
                                            maxWidth: 240,
                                            height: 38,
                                            borderRadius: "999px",
                                            backgroundColor: "#fff",
                                            overflow: "hidden",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",

                                            "&.Mui-focused": {
                                                boxShadow: "0 0 0 3px rgba(37, 99, 235, 0.15)"
                                            }
                                        }
                                    }
                                }}
                            />
                        </div>

                        {/* TO DATE WRAPPER */}
                        <div
                            style={{ display: "inline-block" }}
                            onClick={() => setOpenTo(true)}
                        >
                            <DatePicker
                                open={openTo}
                                onClose={() => setOpenTo(false)}
                                value={dayjs(toDate)}
                                format="DD/MM/YYYY"
                                minDate={dayjs(fromDate)}
                                maxDate={dayjs()}
                                onChange={(newValue) => {
                                    if (!newValue) return;

                                    setToDate(newValue.format("YYYY-MM-DD"));
                                    setOpenTo(false);
                                }}
                                slotProps={{
                                    field: {
                                        sx: {
                                            minWidth: 140,
                                            maxWidth: 240,
                                            height: 38,
                                            borderRadius: "999px",
                                            backgroundColor: "#fff",
                                            overflow: "hidden",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",

                                            "&.Mui-focused": {
                                                boxShadow: "0 0 0 3px rgba(37, 99, 235, 0.15)"
                                            }
                                        }
                                    }
                                }}
                            />
                        </div>

                    </LocalizationProvider>
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
                    <colgroup>
                        <col style={{ width: "120px" }} />  {/* Order ID */}
                        <col style={{ width: "120px" }} />                            {/* Date */}
                        <col style={{ width: "150px" }} />                            {/* Time */}
                        <col />                            {/* Customer */}
                        <col style={{ width: "110px" }} />  {/* Mode */}
                        <col style={{ width: "90px" }} />  {/* Table No */}
                        <col style={{ width: "120px" }} />  {/* Items */}
                        <col style={{ width: "90px" }} />  {/* Total */}
                        <col style={{ width: "110px" }} /> {/* Status */}
                        <col style={{ width: "60px" }} />  {/* Bill */}
                    </colgroup>
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
                            <th>Mode</th>
                            <th>Table No</th>
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
                            <th>Bill</th>
                        </tr>
                    </thead>

                    <tbody>
                        {sortedOrders.length === 0 ? (
                            <EmptyRow colSpan={10} message="No orders for selected date range" />
                        ) : (
                            sortedOrders.map(order => (
                                <OrderRow
                                    key={order.id}
                                    order={order}
                                    toggleOrder={toggleOrder}
                                    openOrderIds={openOrderIds}
                                    navigate={navigate}
                                    renderItemTimer={renderItemTimer}
                                    deriveOrderStatusFromItems={deriveOrderStatusFromItems}
                                    normalizeStatus={normalizeStatus}
                                    orderRefs={orderRefs}
                                    openMenuOrderId={openMenuOrderId}
                                    setOpenMenuOrderId={setOpenMenuOrderId}
                                    setMenuPos={setMenuPos}
                                />
                            )))}
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

                                    setAdminData(prev => ({
                                        ...prev,
                                        orders: prev.orders.map(o => {
                                            if (o.id !== orderId) return o;

                                            const now = Date.now();
                                            const created = getCreatedTime(o);

                                            const items = o.items.map((i, index) => {
                                                if (index !== itemIndex) return i;

                                                const now = Date.now();
                                                const start = i.createdAt
                                                    ? new Date(i.createdAt).getTime()
                                                    : getCreatedTime(o);

                                                const pickupStatus =
                                                    now - start <= SEVEN_MIN ? "on_time" : "late";

                                                return {
                                                    ...i,
                                                    status: "service pickup",
                                                    pickupAt: new Date().toISOString(),
                                                    pickupStatus   // ✅ ITEM LEVEL
                                                };
                                            });

                                            const newStatus = deriveOrderStatusFromItems(items);

                                            console.log("📦 Order WhatsApp data", {
                                                mobile: o.mobile,
                                                status: newStatus
                                            });

                                            const updated = {
                                                ...o,
                                                items,
                                                status: newStatus,
                                                whatsappSent: {
                                                    ...o.whatsappSent,
                                                    ...(o.whatsappSent?.[newStatus] ? {} : { [newStatus]: true })
                                                }
                                            };

                                            if (!o.whatsappSent?.[newStatus]) {
                                                sendWhatsApp(updated, newStatus);
                                            }
                                            persistOrder(updated, async () => {
                                                const res = await api.get("/orders");
                                                setAdminData(prev => ({
                                                    ...prev,
                                                    orders: res.data || []
                                                }));
                                            });
                                            return updated;
                                        })
                                    }));

                                    setPickupConfirm(null);
                                }}
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {openMenuOrderId && menuPos &&
                createPortal(
                    <div
                        className="options-menu portal"
                        style={{
                            top: menuPos.top,
                            left: menuPos.left
                        }}
                    >
                        <div
                            onClick={(e) => {
                                closeOptionsMenu();
                                closeAllBillOverlays();
                                e.stopPropagation();
                                setEditableBill(
                                    JSON.parse(JSON.stringify(
                                        orders.find(o => o.id === openMenuOrderId)
                                    ))
                                );
                                setEditBillOrder(true);
                            }}
                        >
                            Edit
                        </div>

                        <div
                            onClick={(e) => {
                                closeOptionsMenu();
                                closeAllBillOverlays();
                                e.stopPropagation();
                                setPreviewBillOrder(
                                    orders.find(o => o.id === openMenuOrderId)
                                );
                            }}
                        >
                            Preview
                        </div>

                        <div
                            onClick={(e) => {
                                closeOptionsMenu();
                                e.stopPropagation();
                                printBill(orders.find(o => o.id === openMenuOrderId));
                            }}
                        >
                            Print
                        </div>
                    </div>,
                    document.body
                )
            }

            {editBillOrder && (
                <div className="overlay">
                    <div className="bill-modal" onClick={(e) => e.stopPropagation()}>
                        <BillLayout
                            onClose={closeAllBillOverlays}
                            order={editableBill}
                            editable
                            buildUpiUrl={buildUpiUrl}
                            onQtyChange={(idx, { quantity, price }) => {
                                setEditableBill(prev => {
                                    const q =
                                        quantity === "" ? "" : Number(quantity);
                                    const p = Math.max(0, price);

                                    const newItems = prev.items.map((item, i) =>
                                        i === idx
                                            ? {
                                                ...item,
                                                quantity: q,
                                                price: p,
                                                totalPrice: quantity === "" ? item.totalPrice : +(q * p).toFixed(2)
                                            }
                                            : item
                                    );

                                    return {
                                        ...prev,
                                        items: newItems
                                    };
                                });
                            }}
                        />

                        <div className="bill-modal-actions">
                            <button className="secondary" onClick={() => setEditBillOrder(null)}>Cancel</button>
                            <button
                                className="secondary"
                                onClick={() => {
                                    const previewData = recalcOrderTotals(editableBill);

                                    setEditBillOrder(null);      // ✅ close Edit modal FIRST
                                    setPreviewBillOrder(previewData); // ✅ then open Preview modal
                                }}
                            >
                                Preview
                            </button>
                            <button
                                className="primary"
                                onClick={async () => {
                                    try {
                                        const updatedOrder = recalcOrderTotals(
                                            JSON.parse(JSON.stringify(editableBill))
                                        );

                                        await persistOrderEverywhere(updatedOrder);

                                        // ✅ update UI immediately
                                        setAdminData(prev => ({
                                            ...prev,
                                            orders: prev.orders.map(o =>
                                                o.id === updatedOrder.id ? updatedOrder : o
                                            )
                                        }));

                                        setEditBillOrder(null);
                                    } catch (err) {
                                        console.error("❌ Save failed", err);
                                        alert("Failed to save bill. Check console.");
                                    }
                                }}
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {previewBillOrder && (
                <div className="overlay">
                    <div className="bill-modal">
                        <BillLayout
                            onClose={closeAllBillOverlays}
                            order={previewBillOrder}
                            buildUpiUrl={buildUpiUrl}
                        />

                        <div className="bill-modal-actions">
                            <button
                                className="primary"
                                onClick={() => {
                                    printBill(previewBillOrder);
                                    setPreviewBillOrder(null);
                                }}
                            >
                                Print
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default Orders;
