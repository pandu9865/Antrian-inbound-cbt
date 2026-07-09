const API_URL_V2 =
  "https://script.google.com/macros/s/AKfycbyjby6UR8H0H397xkHbpx9F57BhPKeTCndn3Ic3aKpqvEeQnIGYUmwBMa9JzPBhIoeD/exec";

const columns = [
  "Timestamp",
  "location_id",
  "request_shipping_date",
  "arrived_time",
  "slot",
  "destination_name",
  "vendor_name",
  "po_status",
  "po_number",
  "receiving_time",
  "done_time",
  "total_request_quantity",
  "actual_quantity",
  "Count SKU",
  "Is Cancelled",
  "WH TYPE",
  "Destination Name Adjusted",
  "Req Ship Date",
  "Date Arrival",
  "Licence Plate",
  "Vhiecle Type",
  "Vhiecle Max Handling Hour Duration",
  "Slot Adjusted",
  "SLA Slot Time",
  "End Time Slot",
  "Status SO Adjusted",
  "Duration\nArrived Time To SLA Slot Time",
  "Arrive to now",
  "Arrival Status",
  "Max Late Duration",
  "Max Early Duration",
  "Arrive to Receive\nDuration",
  "Processing Duration",
  "Target SLA Processing Duration",
  "SLA Time Refrence",
  "SLA Finished At",
  "OLD SLA Status",
  "NEW SLA Status",
  "Active Duration",
  "Qty Refrences",
];

const LOCAL_TICKETS_KEY = "inbound_cbt_manual_tickets_v2";
let v2RawResponse = null;
let v2PoIndex = null;

function hasApiV2() {
  return API_URL_V2 && !API_URL_V2.includes("PASTE_GAS_WEB_APP_URL_HERE");
}

function apiUrlV2(action, params = {}) {
  const u = new URL(API_URL_V2);
  if (action && action !== "raw") u.searchParams.set("action", action);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") u.searchParams.set(k, v);
  });
  u.searchParams.set("_", Date.now());
  return u.toString();
}

async function apiGetV2(action = "raw", params = {}) {
  if (!hasApiV2()) throw new Error("API_URL_V2 belum diganti.");
  const res = await fetch(apiUrlV2(action, params), {
    method: "GET",
    redirect: "follow",
  });
  const json = await res.json();
  if (json.status && json.status !== "success") {
    throw new Error(json.message || "API V2 error");
  }
  return json.data || json;
}

async function fetchV2Data() {
  return apiGetV2("raw");
}

function getCell(row, keys, fallback = "") {
  for (const key of keys) {
    if (row && row[key] !== undefined && row[key] !== null && row[key] !== "") {
      return row[key];
    }
  }
  return fallback;
}

function normalizeKey(v) {
  return String(v || "")
    .trim()
    .toUpperCase();
}

function toNumberV2(v) {
  if (typeof v === "number") return v;
  const n = Number(String(v || "0").replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? 0 : n;
}

function uniqueCount(arr) {
  return new Set(arr.map((x) => String(x || "").trim()).filter(Boolean)).size;
}

function buildPoIndex(tableRows = []) {
  const index = {};
  for (const row of tableRows) {
    const po = normalizeKey(
      getCell(row, ["po_number", "po", "PO Number", "PO NUMBER"]),
    );
    if (!po) continue;

    if (!index[po]) {
      index[po] = {
        po_number: getCell(row, ["po_number", "po", "PO Number", "PO NUMBER"]),
        vendor_name: getCell(row, [
          "vendor_name",
          "Vendor Name",
          "VENDOR NAME",
        ]),
        slot: String(getCell(row, ["Slot Adjusted", "slot"], "3") || "3"),
        total_po_qty: 0,
        count_po_sku: 0,
        rows: 0,
        sample: row,
      };
    }

    index[po].rows += 1;
    index[po].total_po_qty += toNumberV2(
      getCell(row, [
        "total_request_quantity",
        "total_request_qty",
        "Total Request Quantity",
      ]),
    );
    index[po].count_po_sku += toNumberV2(
      getCell(row, ["Count SKU", "count_sku", "SKU Count"]),
    );
  }
  return index;
}

function getLocalTickets() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_TICKETS_KEY) || "[]");
  } catch (err) {
    return [];
  }
}

function saveLocalTickets(rows) {
  localStorage.setItem(LOCAL_TICKETS_KEY, JSON.stringify(rows || []));
}

function buildQueueFromV2Table(tableRows = []) {
  const seqBySlot = {};
  return tableRows.map((row, idx) => {
    const slot =
      String(getCell(row, ["Slot Adjusted", "slot"], "3") || "3").trim() || "3";
    seqBySlot[slot] = (seqBySlot[slot] || 0) + 1;

    const status = String(
      getCell(
        row,
        ["Status SO Adjusted", "NEW SLA Status", "Arrival Status", "po_status"],
        "WAITING",
      ),
    ).toUpperCase();

    const arrived = getCell(row, ["arrived_time", "Date Arrival", "Timestamp"]);
    const done = getCell(row, ["done_time", "SLA Finished At"], "");
    const plate = normalizePlateValue(
      getCell(row, ["Licence Plate", "license_plate", "plat_number"], ""),
    );

    return {
      source: "DATA_V2",
      row_no: idx + 2,
      queue_no: `REG ${slot}-${seqBySlot[slot]}`,
      ticket_type: "REG",
      slot,
      created_at: arrived || getCell(row, ["Timestamp"]),
      completed_at: done,
      vendor_name: getCell(row, ["vendor_name", "Vendor Name"]),
      fleet_type: getCell(row, ["Vhiecle Type", "Vehicle Type", "fleet_type"]),
      plat_number: plate,
      driver_name: "",
      phone_number: "",
      ktp_6_digit: "",
      po_number: getCell(row, ["po_number", "po"]),
      gate: getCell(
        row,
        ["Destination Name Adjusted", "destination_name"],
        "-",
      ),
      status,
      po_status: getCell(row, ["po_status"]),
      arrival_status: getCell(row, ["Arrival Status"]),
      unload_sla: getCell(
        row,
        ["NEW SLA Status", "OLD SLA Status", "SLA Status"],
        "",
      ),
      total_po_qty: toNumberV2(getCell(row, ["total_request_quantity"])),
      actual_quantity: toNumberV2(getCell(row, ["actual_quantity"])),
      count_po_sku: toNumberV2(getCell(row, ["Count SKU"])),
      waiting_text: getCell(row, ["Arrive to now", "Active Duration"], ""),
      waiting_minutes: minutesFromCreated(arrived),
      raw: row,
    };
  });
}

function buildKpis(kpiRaw = [], tableRows = [], queue = []) {
  const raw = kpiRaw.length ? kpiRaw : tableRows;
  const totalRows = tableRows.length;
  const uniquePo = uniqueCount(
    tableRows.map((r) => getCell(r, ["po_number", "po"])),
  );
  const uniqueVendor = uniqueCount(
    tableRows.map((r) => getCell(r, ["vendor_name"])),
  );

  const totalRequestQty = raw.reduce(
    (s, r) =>
      s +
      toNumberV2(getCell(r, ["total_request_quantity", "total_request_qty"])),
    0,
  );

  const completed = queue.filter((q) => q.status.includes("COMPLETED")).length;
  const pending = queue.filter((q) => !q.status.includes("COMPLETED")).length;
  const late = queue.filter((q) => {
    const a = normalizeKey(q.arrival_status);
    const s = normalizeKey(q.unload_sla);
    return (
      a.includes("LATE") || s.includes("MISS") || q.status.includes("LATE")
    );
  }).length;
  const slaOk = queue.filter((q) => {
    const s = normalizeKey(q.unload_sla);
    return s.includes("OK") || s.includes("EARLY") || s.includes("ON TIME");
  }).length;
  const slaPct = queue.length
    ? Math.round((slaOk / queue.length) * 1000) / 10
    : 0;

  return [
    {
      label: "Total Data",
      display_value: num(totalRows),
      value: totalRows,
      icon: "database",
      color: "primary",
      source: "Data V2",
      metric: "rows",
    },
    {
      label: "Pending",
      display_value: num(pending),
      value: pending,
      icon: "schedule",
      color: "tertiary",
      source: "Data V2",
      metric: "not_completed",
    },
    {
      label: "Completed",
      display_value: num(completed),
      value: completed,
      icon: "check_circle",
      color: "success",
      source: "Data V2",
      metric: "completed",
    },
    {
      label: "Unique PO",
      display_value: num(uniquePo),
      value: uniquePo,
      icon: "inventory_2",
      color: "secondary",
      source: "Data V2",
      metric: "unique_po",
    },
    {
      label: "Total Qty",
      display_value: num(totalRequestQty),
      value: totalRequestQty,
      icon: "deployed_code",
      color: "primary",
      source: "Raw KPI",
      metric: "total_request_quantity",
    },
    {
      label: "Late / Miss",
      display_value: num(late),
      value: late,
      icon: "warning",
      color: late ? "error" : "success",
      source: "Data V2",
      metric: "late_rows",
    },
  ];
}

function buildSummary(kpiRaw = [], tableRows = [], queue = []) {
  const completed = queue.filter((q) => q.status.includes("COMPLETED")).length;
  const waiting = queue.filter(
    (q) =>
      q.status.includes("WAIT") ||
      q.status.includes("PENDING") ||
      q.status.includes("ON DELIVERY") ||
      !q.status.includes("COMPLETED"),
  ).length;
  const onDock = queue.filter(
    (q) =>
      q.status.includes("ON_DOCK") ||
      q.status.includes("ON DOCK") ||
      q.status.includes("RECEIVE"),
  ).length;
  const called = queue.filter((q) => q.status.includes("CALLED")).length;
  const late = queue.filter((q) =>
    normalizeKey(q.arrival_status).includes("LATE"),
  ).length;
  const totalRequestQty = tableRows.reduce(
    (s, r) => s + toNumberV2(getCell(r, ["total_request_quantity"])),
    0,
  );

  return {
    ticket: {
      count_waiting: waiting,
      count_called: called,
      count_on_dock: onDock,
      count_completed: completed,
    },
    checker: {
      on_process: onDock + called,
      completed,
      sla_ok_pct: queue.length
        ? Math.round((completed / queue.length) * 1000) / 10
        : 0,
      sla_miss: late,
    },
    caphand: {
      rows: tableRows.length,
      unique_po: uniqueCount(
        tableRows.map((r) => getCell(r, ["po_number", "po"])),
      ),
      unique_sku: tableRows.reduce(
        (s, r) => s + toNumberV2(getCell(r, ["Count SKU"])),
        0,
      ),
      unique_vendor: uniqueCount(
        tableRows.map((r) => getCell(r, ["vendor_name"])),
      ),
      total_request_qty: totalRequestQty,
      late_rows: late,
    },
  };
}

function buildOptionsFromV2(tableRows = []) {
  const vendors = [
    ...new Set(
      tableRows.map((r) => getCell(r, ["vendor_name"])).filter(Boolean),
    ),
  ].sort();
  const po = [
    ...new Set(
      tableRows.map((r) => getCell(r, ["po_number", "po"])).filter(Boolean),
    ),
  ].sort();
  const vehicle = [
    ...new Set(
      tableRows
        .map((r) => getCell(r, ["Vhiecle Type", "Vehicle Type", "fleet_type"]))
        .filter(Boolean),
    ),
  ].sort();

  return {
    ...state.options,
    vendor_name: vendors,
    po_number: po,
    fleet_type: vehicle.length ? vehicle : state.options.fleet_type,
  };
}

function getTableV2Rows(response) {
  // GAS terbaru return Data V2 di key `tablev2`.
  // Fallback `tableDatav2` dipasang untuk jaga-jaga kalau nama key berubah,
  // lalu `table` sebagai fallback versi lama.
  if (Array.isArray(response?.tablev2)) return response.tablev2;
  if (Array.isArray(response?.tableDatav2)) return response.tableDatav2;
  if (Array.isArray(response?.data?.tablev2)) return response.data.tablev2;
  if (Array.isArray(response?.data?.tableDatav2))
    return response.data.tableDatav2;
  if (Array.isArray(response?.table)) return response.table;
  return [];
}

function getKpiRawRows(response) {
  if (Array.isArray(response?.kpiRaw)) return response.kpiRaw;
  if (Array.isArray(response?.data?.kpiRaw)) return response.data.kpiRaw;
  return [];
}

function buildDashboardFromV2(response) {
  const tableRows = getTableV2Rows(response);
  const kpiRaw = getKpiRawRows(response);
  v2PoIndex = buildPoIndex(tableRows);

  const rawQueue = buildQueueFromV2Table(tableRows);
  const localQueue = getLocalTickets();
  const queue = localQueue.concat(rawQueue);
  const summary = buildSummary(kpiRaw, tableRows, queue);
  const kpis = buildKpis(kpiRaw, tableRows, queue);

  const dockMap = {};
  for (const q of queue) {
    const gate = q.gate || "-";
    if (!dockMap[gate])
      dockMap[gate] = { gate, status: "KOSONG", queue_no: "", plat_number: "" };
    if (!q.status.includes("COMPLETED")) {
      dockMap[gate] = {
        gate,
        status: q.status || "AKTIF",
        queue_no: q.queue_no,
        plat_number: q.plat_number,
      };
    }
  }

  return {
    timestamp: response?.timestamp || new Date().toISOString(),
    kpis,
    summary,
    queue,
    priority: queue
      .filter((q) => !String(q.status || "").includes("COMPLETED"))
      .slice(0, 8),
    dock: Object.values(dockMap).slice(0, 24),
    report_preview: queue,
    raw: {
      kpiRaw,
      tablev2: tableRows,
      table: Array.isArray(response?.table) ? response.table : [],
    },
    options: buildOptionsFromV2(tableRows),
  };
}

function updateApiPill(mode, text) {
  const pill = document.getElementById("api-pill");
  if (!pill) return;
  const color =
    mode === "on"
      ? "bg-success"
      : mode === "loading"
        ? "bg-warning"
        : "bg-error";
  pill.innerHTML = `<span class="w-2 h-2 rounded-full ${color} ${mode === "on" ? "status-pulse" : ""}"></span>${text}`;
}

async function initApi() {
  updateApiPill("loading", "Cek API V2...");
  if (!hasApiV2()) {
    updateApiPill("off", "API V2 belum diset");
    return;
  }

  try {
    v2RawResponse = await fetchV2Data();
    state.dashboard = buildDashboardFromV2(v2RawResponse);
    state.options = state.dashboard.options || state.options;
    state.lastCalled = state.dashboard.queue[0] || state.lastCalled;
    updateApiPill("on", "API live");
    renderPage(state.page || "daftar", false);
  } catch (err) {
    console.error(err);
    updateApiPill("error", "API error");
    showToast("API V2 error: " + err.message);
  }
}

async function refreshDashboard() {
  await initApi();
  showToast("Data V2 refresh");
}

function parsePoNumbers(value) {
  return [
    ...new Set(
      String(value || "")
        .split(/[,\n;]+/)
        .map((x) => x.trim())
        .filter(Boolean),
    ),
  ];
}

function lookupMultiplePo(poText) {
  const poNumbers = parsePoNumbers(poText);
  const items = [];
  const missing = [];

  for (const po of poNumbers) {
    const key = normalizeKey(po);
    const found = v2PoIndex?.[key];
    if (found) {
      items.push({
        ...found,
        po_number: found.po_number || po,
        po_input: po,
      });
    } else {
      missing.push(po);
    }
  }

  const vendors = [
    ...new Set(
      items.map((x) => String(x.vendor_name || "").trim()).filter(Boolean),
    ),
  ];

  const slots = [
    ...new Set(items.map((x) => String(x.slot || "").trim()).filter(Boolean)),
  ];

  const totalQty = items.reduce(
    (sum, x) => sum + toNumberV2(x.total_po_qty),
    0,
  );
  const totalSku = items.reduce(
    (sum, x) => sum + toNumberV2(x.count_po_sku),
    0,
  );

  return {
    found: items.length > 0,
    all_found: poNumbers.length > 0 && missing.length === 0,
    po_numbers: poNumbers,
    items,
    missing_po: missing,
    summary: {
      po_number: poNumbers.join(", "),
      po_numbers: poNumbers,
      vendor_name: vendors.join(", "),
      vendor_names: vendors,
      slot: slots[0] || "3",
      slots,
      total_po_qty: totalQty,
      count_po_sku: totalSku,
      found_count: items.length,
      missing_count: missing.length,
    },
  };
}

function updatePoLookupUi(lookup) {
  const form = document.getElementById("security-form");
  if (!form) return;

  if (form.vendor_name)
    form.vendor_name.value = lookup?.summary?.vendor_name || "";
  if (form.slot && lookup?.summary?.slot)
    form.slot.value = String(lookup.summary.slot || form.slot.value || "3");

  const total = document.getElementById("security-total-qty");
  const sku = document.getElementById("security-count-sku");
  if (total) total.textContent = num(lookup?.summary?.total_po_qty || 0);
  if (sku) sku.textContent = num(lookup?.summary?.count_po_sku || 0);

  if (typeof renderPoSelectedChips === "function") {
    renderPoSelectedChips(parsePoNumbers(form.po_number?.value || ""));
  }
  if (typeof filterPoDropdown === "function") filterPoDropdown();

  const box = document.getElementById("po-lookup-summary");
  if (box && typeof renderPoLookupSummary === "function") {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = renderPoLookupSummary(lookup);
    const next = wrapper.firstElementChild;
    if (next) box.replaceWith(next);
  }
}

function nextLocalQueueNo(ticketType, slot) {
  const queue = (state.dashboard?.queue || []).concat(getLocalTickets());
  return nextLocalQueueNoFromList(ticketType, slot, queue);
}

function lookupPo(silent = false) {
  const form = document.getElementById("security-form");
  if (!form) return null;

  const poText = form.po_number?.value || "";
  const poNumbers = parsePoNumbers(poText);
  if (!poNumbers.length) {
    state.poLookup = null;
    updatePoLookupUi(null);
    return null;
  }

  const lookup = lookupMultiplePo(poText);
  state.poLookup = lookup;
  updatePoLookupUi(lookup);

  if (!silent) {
    if (lookup.all_found) {
      showToast(`${lookup.items.length} PO ditemukan dari Data V2`);
    } else if (lookup.found) {
      showToast(
        `${lookup.items.length} PO ditemukan, ${lookup.missing_po.length} tidak ketemu`,
      );
    } else {
      showToast("PO tidak ketemu di Data V2");
    }
  }

  return lookup.found ? lookup : null;
}

function nextLocalQueueNo(ticketType, slot) {
  const queue = (state.dashboard?.queue || []).concat(getLocalTickets());
  const type = String(ticketType || "REG").toUpperCase();
  const slotText = String(slot || "3");

  if (type === "DROP") {
    const count =
      queue.filter((q) => String(q.queue_no || "").startsWith("DROP")).length +
      1;
    return `DROP-${count}`;
  }

  const count =
    queue.filter((q) =>
      String(q.queue_no || "").startsWith(`${type} ${slotText}-`),
    ).length + 1;
  return `${type} ${slotText}-${count}`;
}

function submitSecurity(e) {
  e.preventDefault();
  const form = e.target;
  if (!validateSecurityForm(form)) return;

  const lookup = lookupPo(true);
  if (!lookup || !lookup.all_found) {
    const missingText = lookup?.missing_po?.length
      ? " Missing: " + lookup.missing_po.join(", ")
      : "";
    showToast("Semua PO wajib valid sebelum buat nomor." + missingText);
    return;
  }

  const base = Object.fromEntries(new FormData(form).entries());
  const poItems = lookup.items || [];

  if (!poItems.length) {
    showToast("PO belum valid.");
    return;
  }

  const rows = getLocalTickets();
  const newRows = [];
  const registerTime = base.register_time || formatDateTimeLocal(new Date());
  let queuePool = (state.dashboard?.queue || []).concat(rows);

  for (const item of poItems) {
    const rowSlot =
      String(base.ticket_type || "").toUpperCase() === "DROP"
        ? base.slot || item.slot || "3"
        : item.slot || base.slot || "3";

    const row = {
      ...base,
      po_number: item.po_number,
      po_numbers: lookup.summary.po_numbers,
      vendor_name: item.vendor_name || base.vendor_name || "",
      slot: rowSlot,
      plat_number: normalizePlateValue(base.plat_number),
      status: "WAITING",
      total_po_qty: toNumberV2(item.total_po_qty),
      count_po_sku: toNumberV2(item.count_po_sku),
      created_at: registerTime,
      register_time: registerTime,
      queue_no: nextLocalQueueNoFromList(
        base.ticket_type,
        rowSlot,
        queuePool.concat(newRows),
      ),
      gate: "-",
      source: "LOCAL_SECURITY",
    };

    newRows.push(row);
  }

  rows.unshift(...newRows);
  saveLocalTickets(rows);

  if (v2RawResponse) {
    state.dashboard = buildDashboardFromV2(v2RawResponse);
    state.options = state.dashboard.options || state.options;
  } else {
    state.dashboard.queue.unshift(...newRows);
    state.dashboard.report_preview.unshift(...newRows);
  }

  state.lastCalled = newRows[0];
  document.getElementById("new-queue-number").textContent = newRows[0].queue_no;
  showToast(`${newRows.length} ticket dibuat dari ${poItems.length} PO`);
  renderPage("daftar", false);
}

function submitChecker(e) {
  e.preventDefault();
  const form = e.target;
  const requiredOk = validateRequiredFields(form);
  const plateOk = validatePlateInput(form.plat_number);
  if (!requiredOk || !plateOk) {
    showToast("Checker belum lengkap / plat tidak valid.");
    return;
  }

  const body = Object.fromEntries(new FormData(form).entries());
  body.plat_number = normalizePlateValue(body.plat_number);

  const local = getLocalTickets();
  let updated = false;
  for (const row of local) {
    if (normalizePlateValue(row.plat_number) === body.plat_number) {
      Object.assign(row, body, {
        updated_at: formatDateTimeLocal(new Date()),
        completed_at: String(body.status || "")
          .toUpperCase()
          .includes("COMPLETED")
          ? formatDateTimeLocal(new Date())
          : row.completed_at || "",
      });
      updated = true;
    }
  }
  saveLocalTickets(local);

  if (v2RawResponse) {
    state.dashboard = buildDashboardFromV2(v2RawResponse);
  }

  showToast(
    updated
      ? "Checker tersimpan lokal"
      : "Plat dari Data V2 tidak bisa disimpan ke backend read-only",
  );
  renderPage("checker", false);
}

function callNext(btn) {
  if (btn) btn.classList.add("calling-effect");
  const gate = document.getElementById("call-gate")?.value || "Dock 01";
  const local = getLocalTickets();
  const next = local.find((q) =>
    String(q.status || "")
      .toUpperCase()
      .includes("WAITING"),
  );

  if (next) {
    next.status = "CALLED";
    next.gate = gate;
    next.called_at = formatDateTimeLocal(new Date());
    saveLocalTickets(local);
    state.lastCalled = next;
    if (v2RawResponse) state.dashboard = buildDashboardFromV2(v2RawResponse);
    showToast("Memanggil " + next.queue_no + " ke " + gate);
  } else {
    const first = (state.dashboard?.queue || []).find(
      (q) => !String(q.status || "").includes("COMPLETED"),
    );
    state.lastCalled = first || state.lastCalled;
    showToast("Mode read-only: tampilkan data pertama dari Data V2");
  }

  setTimeout(() => {
    if (btn) btn.classList.remove("calling-effect");
    renderPage(state.page || "panggil", false);
  }, 450);
}

function recall() {
  showToast("Panggil ulang " + (state.lastCalled?.queue_no || "-"));
}

async function loadDebug() {
  const out = document.getElementById("debug-output");
  if (out) out.textContent = "Loading debug V2...";
  try {
    if (!v2RawResponse) v2RawResponse = await fetchV2Data();
    state.debug = {
      api_url: API_URL_V2,
      timestamp: v2RawResponse.timestamp,
      kpiRaw_rows: getKpiRawRows(v2RawResponse).length || 0,
      table_rows_old: Array.isArray(v2RawResponse.table)
        ? v2RawResponse.table.length
        : 0,
      tablev2_rows: getTableV2Rows(v2RawResponse).length || 0,
      tablev2_sample: getTableV2Rows(v2RawResponse).slice(0, 3),
      table_old_sample: (Array.isArray(v2RawResponse.table)
        ? v2RawResponse.table
        : []
      ).slice(0, 3),
      kpi_sample: getKpiRawRows(v2RawResponse).slice(0, 3),
      po_index_sample: Object.values(v2PoIndex || {}).slice(0, 5),
      local_tickets: getLocalTickets(),
    };
    if (out) out.textContent = JSON.stringify(state.debug, null, 2);
    showToast("Debug V2 selesai");
  } catch (err) {
    if (out) out.textContent = err.stack || err.message;
    showToast("Debug gagal");
  }
}

function openApi(action) {
  if (!hasApiV2()) {
    showToast("API_URL_V2 belum diset");
    return;
  }

  if (action === "reload") {
    initApi();
    return;
  }

  if (action === "debug") {
    switchPage("debug");
    setTimeout(loadDebug, 100);
    return;
  }

  window.open(apiUrlV2("raw"), "_blank");
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-page]");
  if (btn) switchPage(btn.dataset.page);
});

window.addEventListener("hashchange", () =>
  renderPage((location.hash || "#daftar").replace("#", ""), false),
);

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  setInterval(tickClock, 1000);
  tickClock();
  initShader();
  renderPage((location.hash || "#daftar").replace("#", ""), false);
  initApi();

  setInterval(() => {
    if (["monitor", "laporan", "antrian", "checker"].includes(state.page)) {
      renderPage(state.page, false);
    }
  }, 60000);
});
