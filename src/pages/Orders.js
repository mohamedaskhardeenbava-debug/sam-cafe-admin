import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../api";
import "./Orders.css";
import * as XLSX from "xlsx";
import { EmptyRow } from "../App";
import { QRCodeCanvas } from "qrcode.react";
import { createPortal } from "react-dom";
import dayjs from "dayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { formatDisplayDate } from "../App"
import { formatIndianTime } from "../App"

const SEVEN_MIN = 7 * 60 * 1000;
const ONE_MIN = 60 * 1000;
const DATE_STORAGE_KEY = "orders_date_filter";

const formatDuration = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}m ${seconds}s`;
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

const BillLayout = React.memo(({
    order,
    editable,
    onQtyChange,
    buildUpiUrl,
    onClose,
    splitPeople,
    setSplitPeople,
    splitBills,
    setSplitBills,
    applySplitAmount,
    applySplitBill
}) => {
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

    const finalAmount =
        order.splitType === "amount"
            ? order.splitDetails?.perHead
            : order.splitType === "bill"
                ? order.splitDetails?.[0]?.total
                : totals.total;

    const qrValue = useMemo(
        () => buildUpiUrl(finalAmount, order.id),
        [finalAmount, order.id]
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
                <p>Name : {order.userName}</p>
                <p>Order : {order.id}</p>
                <p>Date  : {formatDisplayDate(order.date)}</p>
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
                {/* 🔥 SPLIT DISPLAY */}
                {order.splitType === "amount" && (
                    <div className="bill-split-info">
                        Split: {order.splitDetails?.customers} people <br />
                        Per Head: ₹{order.splitDetails?.perHead}
                    </div>
                )}

                {order.splitType === "bill" && (
                    <div className="bill-split-info">
                        {order.splitDetails?.map((bill, i) => (
                            <div key={i}>
                                Bill {i + 1}: ₹{bill.total}
                            </div>
                        ))}
                    </div>
                )}
                <div><span>Subtotal</span><span>₹{totals.subTotal}</span></div>
                <div><span>CGST @2.5%</span><span>₹{totals.cgst}</span></div>
                <div><span>SGST @2.5%</span><span>₹{totals.sgst}</span></div>
                <div className="total">
                    <span>TOTAL</span>
                    <span>₹{totals.total}</span>
                </div>
            </div>

            {editable && (
                <div className="bill-split-actions">

                    {/* SPLIT BY PEOPLE */}
                    <div className="split-box">
                        <input
                            type="number"
                            placeholder="No. of people"
                            value={splitPeople}
                            onChange={(e) => setSplitPeople(e.target.value)}
                        />
                        <button onClick={applySplitAmount}>
                            Split Amount
                        </button>
                    </div>

                    {/* SPLIT BY BILL */}
                    <div className="split-box">
                        <input
                            type="number"
                            placeholder="No. of bills"
                            value={splitBills}
                            onChange={(e) => setSplitBills(e.target.value)}
                        />
                        <button onClick={applySplitBill}>
                            Split Bill
                        </button>
                    </div>

                </div>
            )}

            <div className="bill-qr-section">
                <div className="bill-qr-title">Scan To Pay</div>
                <StableQRCode value={qrValue} />
            </div>
        </div>
    );
});

const ItemTimer = React.memo(({ item, order }) => {
    const [, setTick] = useState(0);

    const isDone =
        item.status === "completed" ||
        item.status === "service pickup";

    useEffect(() => {
        if (isDone) return;
        const interval = setInterval(() => setTick(t => t + 1), 1000);
        return () => clearInterval(interval);
    }, [isDone]);

    if (isDone) return "—";

    if (item.pickupStatus) return null; // handled by pickupStatus block above

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
});

const OrderRow = React.memo(({
    order,
    isActive,
    onToggle,
    onPickup,
    onOptionsClick,
    navigate,
    orderStatus
}) => {
    const allItemsCompleted = order.items.every(i => i.status === "completed");

    return (
        <React.Fragment>
            <tr
                ref={undefined}
                className="order-main-row"
                onClick={(e) => {
                    if (e.target.closest(".options-btn")) return;
                    onToggle(order.id);
                }}
            >
                <td className="clickable" onClick={() => navigate(`/orders/${order.id}`)}>
                    {order.id}
                </td>
                <td>{formatDisplayDate(order.date)}</td>
                <td>{formatIndianTime(order.date, order.time)}</td>
                <td>{order.userName}</td>
                <td>{order.mode ? order.mode.toUpperCase() : "TAKE AWAY"}</td>
                <td>{order.tableNo != null ? order.tableNo : "---"}</td>
                <td>{order.items.length}</td>
                <td>₹{order.resolvedTotal}</td>
                <td>
                    <div className={`status status-${normalizeStatus(orderStatus).replace(/\s+/g, "-")}`}>
                        {orderStatus}
                    </div>
                </td>
                <td>
                    <div className="bill-actions">
                        <button
                            className="options-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                const rect = e.currentTarget.getBoundingClientRect();
                                onOptionsClick(order.id, {
                                    top: rect.bottom + 6,
                                    left: rect.right - 90
                                });
                            }}
                        >
                            ⋮
                        </button>
                    </div>
                </td>
            </tr>

            <tr className={`order-sub-row ${isActive ? "open" : ""}`}>
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
                                    {order.status === "preparing" && <th>Action</th>}
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
                                                    { state: { fromOrder: true, orderItem: item } }
                                                );
                                            }}
                                        >
                                            {item.dishName}
                                        </td>
                                        <td>{item.notes ? item.notes : "-----------"}</td>
                                        <td>{item.qty ?? item.quantity}</td>
                                        <td>
                                            {item.pickupStatus === "on_time" && (
                                                <span style={{ color: "#2e7d32", fontWeight: 600 }}>On Time</span>
                                            )}
                                            {item.pickupStatus === "late" && (
                                                <span style={{ color: "#d32f2f", fontWeight: 600 }}>Late Order</span>
                                            )}
                                            {!item.pickupStatus && <ItemTimer item={item} order={order} />}
                                        </td>
                                        <td>
                                            <div className={`status status-${normalizeStatus(item.status).replace(/\s+/g, "-")}`}>
                                                {item.status}
                                            </div>
                                        </td>
                                        {order.status === "preparing" && (
                                            <td>
                                                {item.status === "preparing" && (
                                                    <button
                                                        className="pickup-btn"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onPickup({ orderId: order.id, itemIndex: idx, item });
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
        </React.Fragment>
    );
});

const Orders = ({ adminData, setAdminData, handleSort, sortConfig }) => {
    const navigate = useNavigate();
    const orders = adminData.orders || [];
    const [activeOrderIds, setActiveOrderIds] = useState([]);
    const [pickupConfirm, setPickupConfirm] = useState(null);
    const [openStatusDropdown, setOpenStatusDropdown] = useState(false);
    const [openModeDropdown, setOpenModeDropdown] = useState(false);
    const [statusFilter, setStatusFilter] = useState("all");
    const [modeFilter, setModeFilter] = useState("all");
    const [openFrom, setOpenFrom] = useState(false);
    const [openTo, setOpenTo] = useState(false);
    const [originalBill, setOriginalBill] = useState(null);
    const [splitPeople, setSplitPeople] = useState("");
    const [splitBills, setSplitBills] = useState("");

    const todayISO = new Date().toISOString().split("T")[0];
    const toggleOrder = useCallback((orderId) => {
        setActiveOrderIds(prev =>
            prev.includes(orderId)
                ? prev.filter(id => id !== orderId)
                : [...prev, orderId]
        );
    }, []);

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
    const isOrdersPage = location.pathname === "/orders";
    const orderRefs = useRef({});
    const [openMenuOrderId, setOpenMenuOrderId] = useState(null);
    const [editBillOrder, setEditBillOrder] = useState(null);
    const [previewBillOrder, setPreviewBillOrder] = useState(null);
    const [editableBill, setEditableBill] = useState(null);
    const [menuPos, setMenuPos] = useState(null);



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
        }));
    }, [orders, resolveItemTotal]);

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
        if (!orders.length) return;

        let changed = false;

        const normalized = orders.map(o => {
            const items = o.items.map(item => {
                const updated = {
                    ...item,
                    status: item.status || "placed",
                    createdAt: item.createdAt || o.createdAt,
                    pickupAt: item.pickupAt || null
                };

                if (
                    item.status === updated.status &&
                    item.createdAt === updated.createdAt &&
                    item.pickupAt === updated.pickupAt
                ) {
                    return item;
                }

                changed = true;
                return updated;
            });

            if (items === o.items && o.status) {
                return o;
            }

            changed = true;

            return {
                ...o,
                status: o.status || "placed",
                items
            };
        });

        if (!changed) return;

        setAdminData(prev => ({
            ...prev,
            orders: normalized
        }));
    }, []);

    useEffect(() => {

        if (!isOrdersPage) return;

        const interval = setInterval(() => {

            setAdminData(prev => {

                let changed = false;

                const updatedOrders = prev.orders.map(order => {

                    let orderChanged = false;
                    const start = new Date(order.createdAt).getTime();

                    const items = order.items.map(item => {

                        if (item.status === "placed" && Date.now() - start >= ONE_MIN) {
                            orderChanged = true;
                            return { ...item, status: "preparing" };
                        }

                        if (item.status === "service pickup" && item.pickupAt) {
                            const pickupStart = new Date(item.pickupAt).getTime();

                            if (!isNaN(pickupStart) && Date.now() - pickupStart >= ONE_MIN) {
                                orderChanged = true;
                                return { ...item, status: "completed" };
                            }
                        }

                        return item;
                    });

                    const newStatus = deriveOrderStatusFromItems(items);

                    if (!orderChanged && newStatus === order.status) return order;

                    const updatedOrder = {
                        ...order,
                        items,
                        status: newStatus
                    };

                    persistOrder(updatedOrder);

                    return updatedOrder;
                });

                return changed
                    ? { ...prev, orders: updatedOrders }
                    : prev;

            });

        }, 10000);

        return () => clearInterval(interval);

    }, [isOrdersPage]);

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
        const closeDropdowns = () => {
            setOpenStatusDropdown(false);
            setOpenModeDropdown(false);
        };

        window.addEventListener("click", closeDropdowns);

        return () => window.removeEventListener("click", closeDropdowns);
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

    const closeAllBillOverlays = () => {
        setEditBillOrder(null);
        setPreviewBillOrder(null);

        // 🔥 RESET BACK
        if (originalBill) {
            setEditableBill(originalBill);
        }

        setOriginalBill(null);
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

    const applySplitAmount = () => {
        if (!splitPeople || isNaN(splitPeople)) return;

        const total = editableBill.items.reduce(
            (sum, i) => sum + Number(i.totalPrice || 0),
            0
        );

        const perHead = (total / Number(splitPeople)).toFixed(2);

        setEditableBill(prev => ({
            ...prev,
            splitType: "amount",
            splitDetails: {
                customers: Number(splitPeople),
                perHead
            }
        }));
    };

    const applySplitBill = () => {
        if (!splitBills || isNaN(splitBills)) return;

        const total = editableBill.items.reduce(
            (sum, i) => sum + Number(i.totalPrice || 0),
            0
        );

        const perBill = (total / Number(splitBills)).toFixed(2);

        const splitDetails = Array.from({ length: Number(splitBills) }, () => ({
            total: perBill
        }));

        setEditableBill(prev => ({
            ...prev,
            splitType: "bill",
            splitDetails
        }));
    };

    const handleSplitAmount = (order) => {
        const customers = prompt("Enter number of people:");
        if (!customers || isNaN(customers)) return;

        const total = order.items.reduce(
            (sum, i) => sum + Number(i.totalPrice || 0),
            0
        );

        const perHead = (total / Number(customers)).toFixed(2);

        const updatedOrder = {
            ...order,
            splitType: "amount",
            splitDetails: {
                customers: Number(customers),
                perHead
            }
        };

        // ✅ INSTANT UI UPDATE
        setEditableBill(updatedOrder);
    };

    const handleSplitBill = (order) => {
        const bills = prompt("Enter number of bills:");
        if (!bills || isNaN(bills)) return;

        const total = order.items.reduce(
            (sum, i) => sum + Number(i.totalPrice || 0),
            0
        );

        const perBill = (total / Number(bills)).toFixed(2);

        const splitDetails = Array.from({ length: Number(bills) }, () => ({
            total: perBill
        }));

        const updatedOrder = {
            ...order,
            splitType: "bill",
            splitDetails
        };

        // ✅ INSTANT UI UPDATE
        setEditableBill(updatedOrder);
    };
    
    const fromDay = useMemo(() => dayjs(fromDate), [fromDate]);
    const toDay = useMemo(() => dayjs(toDate), [toDate]);

    return (
        <div className="orders-page">

            <div className="orders-header">
                <h2 className="orders-title">Orders</h2>

                <div className="orders-dropdown-wrapper">
                    <button
                        className="orders-status-dropdown"
                        onClick={(e) => {
                            e.stopPropagation();
                            setOpenStatusDropdown(prev => !prev);
                        }}
                    >
                        {statusFilter === "all" ? "All Status" : statusFilter}
                    </button>

                    {openStatusDropdown && (
                        <div className="orders-dropdown-menu">
                            {["all", "placed", "preparing", "service pickup", "completed"].map(status => (
                                <div
                                    key={status}
                                    onClick={() => {
                                        setStatusFilter(status);
                                        setOpenStatusDropdown(false);
                                    }}
                                >
                                    {status === "all" ? "All Status" : status}
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
                                    {mode === "all" ? "All Modes" : mode}
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

                        {/* FROM DATE */}
                        <div
                            style={{ display: "inline-block" }}
                            onClick={() => setOpenFrom(true)}
                        >
                            <DatePicker
                                open={openFrom}
                                onClose={() => setOpenFrom(false)}
                                value={fromDay}
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

                        {/* TO DATE */}
                        <div
                            style={{ display: "inline-block" }}
                            onClick={() => setOpenTo(true)}
                        >
                            <DatePicker
                                open={openTo}
                                onClose={() => setOpenTo(false)}
                                value={toDay}
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
                        <col style={{ width: "120px" }} />
                        <col style={{ width: "120px" }} />
                        <col style={{ width: "150px" }} />
                        <col />
                        <col style={{ width: "110px" }} />
                        <col style={{ width: "90px" }} />
                        <col style={{ width: "120px" }} />
                        <col style={{ width: "90px" }} />
                        <col style={{ width: "110px" }} />
                        <col style={{ width: "60px" }} />
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
                            sortedOrders.map(order => {
                                const orderStatus = deriveOrderStatusFromItems(order.items);
                                return (
                                    <OrderRow
                                        key={order.id}
                                        order={order}
                                        orderStatus={orderStatus}
                                        isActive={activeOrderIds.includes(order.id)}
                                        onToggle={toggleOrder}
                                        onPickup={setPickupConfirm}
                                        onOptionsClick={(id, pos) => {
                                            setMenuPos(pos);
                                            setOpenMenuOrderId(prev => prev === id ? null : id);
                                        }}
                                        navigate={navigate}
                                    />
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

                                            const updated = {
                                                ...o,
                                                items,
                                                status: newStatus
                                            };
                                            persistOrder(updated);
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
                                e.stopPropagation();
                                closeOptionsMenu();
                                closeAllBillOverlays();

                                const selectedOrder = orders.find(o => o.id === openMenuOrderId);

                                const cloned = JSON.parse(JSON.stringify(selectedOrder));

                                setEditableBill(cloned);
                                setOriginalBill(cloned);   // ✅ backup
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

                            splitPeople={splitPeople}
                            setSplitPeople={setSplitPeople}
                            splitBills={splitBills}
                            setSplitBills={setSplitBills}
                            applySplitAmount={applySplitAmount}
                            applySplitBill={applySplitBill}

                            onQtyChange={(idx, { quantity, price }) => {
                                setEditableBill(prev => {
                                    const q = quantity === "" ? "" : Number(quantity);
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
