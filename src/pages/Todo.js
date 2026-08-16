/**
 * Todo.js — per-admin to-do list, filterable/reportable by time period
 * (daily / weekly / monthly). Redesigned to match the shared
 * "details page" visual language (details-container / details-header /
 * section) used across StaffDetails, DishDetails, OrderDetails, etc.
 *
 * UI-only redesign: creating a to-do now happens in a modal (matching
 * the create/edit modal pattern used across the rest of the admin
 * panel) instead of an inline form, and the list rows follow the
 * card-row layout from the reference design (round checkbox, title,
 * meta line, status chip). No data model or backend behavior changed.
 */
import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import Button3D from "../components/Button3D";
import useAnimatedModal from "../hooks/useAnimatedModal";
import CustomDropdown from "../components/CustomDropdown";
import CustomDatePicker, { todayStr } from "../components/CustomDatePicker";
import { FilterBar } from "../components/FilterBar";
import CollapseChevron from "../components/CollapseChevron";
import { allowTextInput } from "../App";
import closeIcon from "../icon/close-icon.png";
import "./ModalCSS.css";
import "./Todo.css";

const PERIODS = ["daily", "weekly", "monthly"];
const EMPTY_FORM = { title: "", notes: "", period: "daily", dueDate: "" };

const Todo = () => {
  const navigate = useNavigate();
  const [todos, setTodos] = useState([]);
  const [periodFilter, setPeriodFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const todoModal = useAnimatedModal("todo-add");
  const [form, setForm] = useState(EMPTY_FORM);
  const patchForm = (patch) => setForm((p) => ({ ...p, ...patch }));

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = {};
      if (periodFilter !== "all") params.period = periodFilter;
      if (statusFilter !== "all") params.status = statusFilter;
      const res = await api.get("/todos", { params });
      setTodos(res.data || []);
    } finally {
      setIsLoading(false);
    }
  }, [periodFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const openCreateModal = () => {
    setForm(EMPTY_FORM);
    setShowModal(true);
    todoModal.open();
  };

  const closeModal = () => todoModal.close(() => setShowModal(false));

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    await api.post("/todos", form);
    setForm(EMPTY_FORM);
    todoModal.close(() => setShowModal(false));
    load();
  };

  const toggleDone = async (todo) => {
    await api.patch(`/todos/${todo.id}`, { status: todo.status === "done" ? "pending" : "done" });
    load();
  };

  const remove = async (id) => {
    await api.delete(`/todos/${id}`);
    load();
  };

  // Simple report: counts per period, for the "time period report" requirement
  const report = useMemo(() => {
    const counts = { daily: { total: 0, done: 0 }, weekly: { total: 0, done: 0 }, monthly: { total: 0, done: 0 } };
    todos.forEach((t) => {
      if (!counts[t.period]) return;
      counts[t.period].total += 1;
      if (t.status === "done") counts[t.period].done += 1;
    });
    return counts;
  }, [todos]);

  const filteredTodos = useMemo(() => {
    if (!search.trim()) return todos;
    const q = search.trim().toLowerCase();
    return todos.filter(
      (t) => t.title?.toLowerCase().includes(q) || t.notes?.toLowerCase().includes(q)
    );
  }, [todos, search]);

  const isFilterActive = periodFilter !== "all" || statusFilter !== "all" || !!search.trim();
  const clearFilters = () => {
    setPeriodFilter("all");
    setStatusFilter("all");
    setSearch("");
  };

  const [reportCollapsed, setReportCollapsed] = useState(false);
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);

  return (
    <div className="details-container">
      {/* HEADER */}
      <div className="details-header">
        <button className="back-btn" onClick={() => navigate(-1)} />
        <button
          type="button"
          className="header-collapse-btn"
          onClick={() => {
            const next = !(reportCollapsed && filtersCollapsed);
            setReportCollapsed(next);
            setFiltersCollapsed(next);
          }}
          data-bs-toggle="tooltip" data-bs-placement="top" data-bs-title={reportCollapsed && filtersCollapsed ? "Expand" : "Collapse"}
          aria-expanded={!(reportCollapsed && filtersCollapsed)}
        >
          <CollapseChevron collapsed={reportCollapsed && filtersCollapsed} />
        </button>
        <h2>To-Do List</h2>
        <Button3D onClick={openCreateModal} className="todo-new-btn">
          + New Task
        </Button3D>
      </div>

      <div className="details-body">
        {/* REPORT */}
        <div className="section">
          <div className="section-title">
            <span>Completion by Period</span>
            <button
              type="button"
              className="header-collapse-btn"
              onClick={() => setReportCollapsed((prev) => !prev)}
              data-bs-toggle="tooltip" data-bs-placement="top" data-bs-title={reportCollapsed ? "Expand" : "Collapse"}
              aria-expanded={!reportCollapsed}
            >
              <CollapseChevron collapsed={reportCollapsed} />
            </button>
          </div>
          {!reportCollapsed && (
            <div className="todo-report">
              {PERIODS.map((p) => (
                <div key={p} className="todo-report-card">
                  <span className="todo-report-label">{p}</span>
                  <span className="todo-report-count">{report[p].done}/{report[p].total}</span>
                  <span className="todo-report-sub">completed</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* FILTER BAR */}
        <div className="section todo-filter-section">
          <div className="section-title">
            <span>Filters</span>
            <button
              type="button"
              className="header-collapse-btn"
              onClick={() => setFiltersCollapsed((prev) => !prev)}
              data-bs-toggle="tooltip" data-bs-placement="top" data-bs-title={filtersCollapsed ? "Expand filters" : "Collapse filters"}
              aria-expanded={!filtersCollapsed}
            >
              <CollapseChevron collapsed={filtersCollapsed} />
            </button>
          </div>
          {!filtersCollapsed && (
            <FilterBar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search tasks or notes…"
              groups={[
                {
                  label: "Period",
                  options: [
                    { value: "all", label: "All" },
                    ...PERIODS.map((p) => ({ value: p, label: p })),
                  ],
                  value: periodFilter,
                  onChange: setPeriodFilter,
                  toggle: false,
                },
                {
                  label: "Status",
                  options: [
                    { value: "all", label: "All" },
                    { value: "pending", label: "Pending" },
                    { value: "done", label: "Done" },
                  ],
                  value: statusFilter,
                  onChange: setStatusFilter,
                  toggle: false,
                },
              ]}
              onClear={clearFilters}
              active={isFilterActive}
            />
          )}
        </div>
        {/* LIST */}
        <div className="todo-list-card">
          <div className="todo-list-card-header">
            <span className="todo-list-card-title">Upcoming Tasks</span>
          </div>

          {isLoading ? (
            <p className="todo-empty">Loading...</p>
          ) : filteredTodos.length === 0 ? (
            <p className="todo-empty">No to-dos for this filter.</p>
          ) : (
            <ul className="todo-list">
              {filteredTodos.map((t) => (
                <li key={t.id} className={`todo-item ${t.status === "done" ? "todo-done" : ""}`}>
                  <button
                    type="button"
                    className={`todo-check${t.status === "done" ? " todo-check-on" : ""}`}
                    onClick={() => toggleDone(t)}
                    data-bs-toggle="tooltip"
                    data-bs-placement="top"
                    data-bs-title={t.status === "done" ? "Mark as pending" : "Mark as done"}
                  >
                    {t.status === "done" && (
                      <svg viewBox="0 0 16 16" width="10" height="10">
                        <path d="M2 8.5l3.2 3.2L14 3" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>

                  <div className="todo-item-body">
                    <span className="todo-item-title">{t.title}</span>
                    <span className="todo-item-meta-row">
                      <span className="todo-item-meta">
                        {t.status === "done" ? "Completed" : "Due"}
                        {t.dueDate ? ` ${t.dueDate}` : t.status === "done" ? " just now" : ""}
                      </span>
                      <span className={`todo-chip todo-chip-${t.period}`}>{t.period}</span>
                      {t.status === "done" && <span className="todo-chip todo-chip-done">DONE</span>}
                    </span>
                    {t.notes && <span className="todo-item-notes">{t.notes}</span>}
                  </div>

                  <Button3D variant="cancel" iconOnly title="Delete" onClick={() => remove(t.id)}>
                    <img src={closeIcon} alt="Delete" />
                  </Button3D>
                </li>
              ))}
            </ul>
          )}

          {/* Quick-add row, matching the "+ Add a task..." row in the reference */}
          <form className="todo-quick-add" onSubmit={handleAdd}>
            <span className="todo-quick-add-icon">+</span>
            <input
              className="todo-quick-add-input"
              placeholder="Add a task to 'Upcoming Tasks'..."
              value={form.title}
              onChange={(e) => patchForm({ title: allowTextInput(form.title, e.target.value, 100, 5) })}
            />
            <button type="submit" className="todo-quick-add-enter">ENTER</button>
          </form>
        </div>
      </div>

      {/* NEW TODO MODAL */}
      {todoModal.shouldRender && (
        <div className={`modal-overlay ${todoModal.overlayClass}`}>
          <form className={`admin-modal ${todoModal.modalClass}`} onSubmit={handleAdd}>
            <div className="admin-modal-header">
              <h3>New To-Do</h3>
              <Button3D variant="cancel" iconOnly onClick={closeModal}>
                <img src={closeIcon} alt="Close" />
              </Button3D>
            </div>

            <div className="admin-modal-body">
              <div className="admin-form-group">
                <div className="mat">
                  <input
                    className="mat-input"
                    placeholder=" "
                    value={form.title}
                    onChange={(e) => patchForm({ title: allowTextInput(form.title, e.target.value, 100, 5) })}
                    required
                    autoFocus
                  />
                  <label className="mat-label">What needs to be done?<span className="rf-req">*</span></label>
                  <span className="mat-bar" />
                </div>
              </div>

              <div className="admin-form-group">
                <CustomDropdown
                  label="Period"
                  value={form.period}
                  onChange={(val) => patchForm({ period: val })}
                  options={PERIODS.map((p) => ({ value: p, label: p }))}
                  placeholder={null}
                />
              </div>

              <div className="admin-form-group">
                <CustomDatePicker
                  label="Due Date"
                  value={form.dueDate}
                  onChange={(val) => patchForm({ dueDate: val })}
                  min={todayStr()}
                  placeholder="Select due date"
                />
              </div>

              <div className="admin-form-group">
                <div className="mat">
                  <textarea
                    className="mat-input mat-textarea"
                    placeholder=" "
                    value={form.notes}
                    onChange={(e) => patchForm({ notes: allowTextInput(form.notes, e.target.value, 500, 100000) })}
                  />
                  <label className="mat-label">Notes (optional)</label>
                  <span className="mat-bar" />
                </div>
              </div>
            </div>

            <div className="admin-modal-footer">
              <Button3D variant="cancel" onClick={closeModal}>
                Cancel
              </Button3D>
              <Button3D type="submit">Add Task</Button3D>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Todo;
