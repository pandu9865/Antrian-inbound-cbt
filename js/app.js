const state = {
  page: "daftar",
  loading: false,
  schema: null,
  options: {
    fleet_type: [
      "CDD",
      "CDE",
      "WING BOX",
      "VAN",
      "L300",
      "TRONTON",
      "PROTON",
      "FUSO",
      "MINI BUS",
      "KR2",
      "KR3",
    ],
    security_status: ["WAITING"],
    checker_status: [
      "ARRIVED",
      "ON_DOCK",
      "UNLOADING",
      "CHECKING",
      "COMPLETED",
      "HOLD",
    ],
    unload_sla: ["SLA OK", "SLA MISS", "ON PROCESS"],
    gate: [
      "Dock 01",
      "Dock 02",
      "Dock 03",
      "Dock 04",
      "Dock 05",
      "Dock 06",
      "Chiller 01",
      "Chiller 02",
    ],
    vendor_name: [],
    po_number: [],
  },
  dashboard: demoDashboard(),
  lastCalled: {
    queue_no: "IB-023",
    gate: "Dock 04",
    vendor_name: "Supplier Demo",
  },
  poLookup: null,
  poCache: {},
  debug: null,
};

const pageMeta = {
  daftar: {
    title: "Daftar",
    subtitle: "Security input: vendor, armada, plat, dan PO",
  },
  checker: {
    title: "Checker",
    subtitle: "Checker input: gate, status, dan SLA bongkar",
  },
  antrian: {
    title: "Antrian",
    subtitle: "Pantau urutan dan panggil driver inbound",
  },
  panggil: {
    title: "Panggil",
    subtitle: "Layar panggilan untuk TV/display",
  },
  monitor: {
    title: "Waiting List Monitoring",
    subtitle: "Monitor plat nomor, gate, status, dan waktu tunggu berjalan",
  },
  laporan: {
    title: "Waiting List",
    subtitle: "List input security, update gate/status dari checker",
  },
  setting: { title: "Setting", subtitle: "Set API URL dan refresh data" },
  debug: {
    title: "Debug",
    subtitle: "Cek raw data API dan sample response",
  },
};

const navBase =
  "flex items-center gap-3 text-on-surface-variant px-4 py-3 mx-2 hover:bg-surface-container-high rounded-full transition-all group active:scale-98";
const navActive =
  "flex items-center gap-3 bg-secondary-container text-on-secondary-container rounded-full px-4 py-3 mx-2 transition-all active:scale-98";
const mobBase =
  "px-4 py-2 rounded-full text-label-sm bg-surface-container text-on-surface-variant border border-outline-variant";
const mobActive =
  "px-4 py-2 rounded-full text-label-sm bg-secondary-container text-on-secondary-container border border-secondary-container font-bold";

function kpiCards() {
  const kpis =
    (state.dashboard && state.dashboard.kpis) || demoDashboard().kpis;
  return `<div class="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-gutter">
    ${kpis.map(kpiCard).join("")}
    <div class="bg-primary-container p-6 rounded-xl flex flex-col justify-between shadow-lg shadow-primary-container/20 group hover:brightness-110 transition-all cursor-pointer overflow-hidden relative">
      <div class="flex justify-between items-start"><span class="font-headline-md text-xl text-on-primary-container">Panggil</span><span class="material-symbols-outlined text-on-primary-container">arrow_forward_ios</span></div>
      <button class="mt-4 bg-on-primary text-primary-container py-3 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-black hover:text-white transition-colors" onclick="callNext(this)">
        <span class="material-symbols-outlined">campaign</span>PANGGIL NEXT
      </button>
    </div>
  </div>`;
}

function kpiCard(k) {
  const cls =
    {
      primary: "text-primary",
      secondary: "text-secondary",
      tertiary: "text-tertiary",
      success: "text-success",
      warning: "text-warning",
      error: "text-error",
    }[k.color] || "text-primary";
  return `<div class="glass-card p-5 rounded-xl flex flex-col gap-2 relative overflow-hidden group">
    <div class="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><span class="material-symbols-outlined text-4xl">${k.icon || "analytics"}</span></div>
    <span class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">${esc(k.label)}</span>
    <span class="font-headline-md text-3xl ${cls}">${esc(k.display_value ?? k.value ?? 0)}</span>
    <span class="text-[11px] text-on-surface-variant">${esc(k.source || "api")}.${esc(k.metric || "metric")}</span>
  </div>`;
}

function renderPoLookupSummary(lookup) {
  if (!lookup) {
    return `<div id="po-lookup-summary" class="mt-3 text-[12px] text-on-surface-variant">
      Input bisa multiple PO pakai koma. Contoh: <b>PO1, PO2, PO3</b>.
    </div>`;
  }

  const found = lookup.items || [];
  const missing = lookup.missing_po || [];
  const chips = found
    .map(
      (x) =>
        `<span class="inline-flex items-center rounded-full bg-primary/10 border border-primary/20 text-primary px-2 py-1 mr-1 mb-1 text-[11px] font-bold">${esc(x.po_number || "-")}</span>`,
    )
    .join("");

  const missingChips = missing
    .map(
      (x) =>
        `<span class="inline-flex items-center rounded-full bg-error/10 border border-error/20 text-error px-2 py-1 mr-1 mb-1 text-[11px] font-bold">${esc(x)}</span>`,
    )
    .join("");

  return `<div id="po-lookup-summary" class="mt-3 rounded-lg border border-outline-variant/40 bg-surface-container/35 p-3 text-[12px] text-on-surface-variant">
    <div class="font-bold text-on-surface mb-2">PO terdeteksi: ${num(found.length)} ditemukan${missing.length ? `, ${num(missing.length)} tidak ketemu` : ""}</div>
    <div>${chips || `<span class="text-on-surface-variant">Belum ada PO valid.</span>`}</div>
    ${missing.length ? `<div class="mt-2"><span class="font-bold text-error">Missing:</span> ${missingChips}</div>` : ""}
    <div class="mt-2">Delimiter pakai koma. Saat submit, setiap PO akan dibuat row/ticket sendiri.</div>
  </div>`;
}

function pageDaftar() {
  const o = state.options;
  const lookup = state.poLookup;
  const nowText = formatDateTimeLocal(new Date());
  return `<div class="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
    <div class="lg:col-span-2 glass-card rounded-xl p-6">
      <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
        <div>
          <h3 class="font-headline-md text-headline-md mb-1">Security Input</h3>
          <p class="text-on-surface-variant">Isi PO dulu. PO bisa multiple pakai koma; vendor, qty, SKU, dan slot auto lookup dari Data V2.</p>
        </div>
        <div class="thin-tab rounded-lg px-4 py-2 font-label-sm flex items-center gap-2 w-fit opacity-80">
          <span class="material-symbols-outlined">sync</span>Auto lookup PO
        </div>
      </div>
      <form id="security-form" onsubmit="submitSecurity(event)">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          ${poMultiSelectInput(lookup?.summary?.po_number || "")}
          ${textInput("vendor_name", "Vendor Name", "Auto dari PO terpilih", "vendor-list", lookup?.summary?.vendor_name, "required readonly")}
          ${selectInput("ticket_type", "Tipe Tiket", ["REG", "VIP", "DROP"], "REG", 'required onchange="handleTicketTypeChange()"')}
          ${selectInput("slot", "Slot", buildSlotOptions(lookup?.summary?.slot), lookup?.summary?.slot || "3", "required")}
          ${selectInput("fleet_type", "Fleet Type", o.fleet_type, "", 'required onchange="updateFleetPreview()"')}
          ${fleetPreviewCard("")}
          ${textInput("plat_number", "Plat Number", "Contoh: B 1234 XYZ → B1234XYZ", "", "", 'required oninput="normalizePlateInput(this)" onblur="normalizePlateInput(this); validatePlateInput(this)" autocomplete="off"')}
          ${textInput("driver_name", "Driver's Name", "Nama driver", "", "", "required")}
          ${textInput("ktp_6_digit", "6 Digit No KTP", "Optional. Contoh: 123456", "", "", 'maxlength="6" inputmode="numeric" pattern="[0-9]{6}" oninput="this.value=this.value.replace(/\\D/g, \'\').slice(0,6)"')}
          ${textInput("phone_number", "Phone Number", "08xxxxxxxxxx", "", "", 'required inputmode="tel"')}
          <label class="flex flex-col gap-2"><span class="font-label-sm text-label-sm text-on-surface-variant uppercase">Register Time</span><input name="register_time" class="form-input opacity-80" value="${esc(nowText)}" readonly /></label>
          <label class="flex flex-col gap-2">
            <span class="font-label-sm text-label-sm text-on-surface-variant uppercase">Status Security</span>
            <input type="hidden" name="status" value="WAITING" />
            <div class="bg-tertiary/15 border border-tertiary/30 rounded-lg px-4 py-3 text-tertiary font-bold">WAITING</div>
          </label>
          <label class="flex flex-col gap-2"><span class="font-label-sm text-label-sm text-on-surface-variant uppercase">Auto Summary</span><div class="grid grid-cols-2 gap-2">
            <div class="bg-surface-container/60 border border-outline-variant rounded-lg p-3"><div class="text-[10px] uppercase text-on-surface-variant font-bold">Total PO Qty</div><div id="security-total-qty" class="font-queue-id text-primary">${num(lookup?.summary?.total_po_qty || 0)}</div></div>
            <div class="bg-surface-container/60 border border-outline-variant rounded-lg p-3"><div class="text-[10px] uppercase text-on-surface-variant font-bold">Count SKU</div><div id="security-count-sku" class="font-queue-id text-primary">${num(lookup?.summary?.count_po_sku || 0)}</div></div>
          </div></label>
        </div>
        ${renderPoLookupSummary(lookup)}
        <p class="form-help mt-3">Catatan: No KTP tidak wajib. Plat otomatis disimpan tanpa spasi; contoh B 1234 XYZ jadi B1234XYZ. Plat angka doang ditolak.</p>
        ${datalists()}
        <button class="mt-6 bg-primary-container text-on-primary-container px-6 py-3 rounded-lg font-bold flex items-center gap-2 hover:brightness-110" type="submit">
          <span class="material-symbols-outlined">confirmation_number</span>Buat Nomor
        </button>
      </form>
    </div>
    <div class="glass-card rounded-xl p-6 flex flex-col justify-center items-center text-center">
      <span class="text-on-surface-variant uppercase font-label-sm">Nomor Terakhir</span>
      <div id="new-queue-number" class="font-queue-id text-[64px] md:text-[78px] leading-none text-primary my-6">${esc(state.lastCalled.queue_no || "REG 3-0")}</div>
      <p class="text-on-surface-variant">Format: REG 3-12 = reguler slot 3 urutan 12. DROP = drop barang.</p>
    </div>
  </div>`;
}

function pageChecker() {
  const o = state.options;
  const rows = state.dashboard?.queue || [];
  return `<div class="grid grid-cols-1 xl:grid-cols-12 gap-gutter">
    <div class="xl:col-span-7 glass-card rounded-xl p-6">
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
        <div>
          <h3 class="font-headline-md text-headline-md mb-1">List Security</h3>
          <p class="text-on-surface-variant">Pilih mobil dari hasil Security Input, lalu tentukan gate/status bongkar.</p>
        </div>
        <button onclick="refreshDashboard()" class="thin-tab rounded-lg px-4 py-2 font-bold flex items-center gap-2 w-fit"><span class="material-symbols-outlined">refresh</span>Refresh</button>
      </div>
      <div class="flex flex-col md:flex-row gap-3 mb-4">
        <input id="checker-filter" oninput="filterTable('checker-security-table', this.value)" class="form-input" placeholder="Cari vendor / PO / nopol / driver..." />
        <select id="checker-status-filter" class="form-select md:max-w-[180px]" onchange="filterCheckerStatus(this.value)">
          <option value="ALL">Semua Status</option>
          <option value="WAITING">WAITING</option>
          <option value="ON_DOCK">ON_DOCK</option>
          <option value="UNLOADING">UNLOADING</option>
          <option value="COMPLETED">COMPLETED</option>
          <option value="HOLD">HOLD</option>
        </select>
      </div>
      <div class="overflow-x-auto max-h-[520px] overflow-y-auto border border-outline-variant/30 rounded-lg">
        <table id="checker-security-table" class="w-full text-left">
          <thead class="bg-surface-container text-on-surface-variant sticky top-0 z-10">
            <tr>${["Pilih", "Queue", "Vendor", "PO", "Plat", "Driver", "Gate", "Status", "Menunggu"].map((h) => `<th class="px-4 py-3 font-label-sm uppercase">${h}</th>`).join("")}</tr>
          </thead>
          <tbody class="divide-y divide-outline-variant/10">
            ${rows.map((r, i) => checkerListRow(r, i)).join("") || `<tr><td colspan="9" class="px-6 py-8 text-center text-on-surface-variant">Belum ada data Security.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
    <div class="xl:col-span-5 glass-card rounded-xl p-6">
      <h3 class="font-headline-md text-headline-md mb-1">Checker Input</h3>
      <p class="text-on-surface-variant mb-6">Data dari list akan otomatis masuk form. Checker tinggal pilih gate, status, dan SLA.</p>
      <form id="checker-form" onsubmit="submitChecker(event)">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          ${textInput("vendor_name", "Vendor Name", "Pilih dari list", "vendor-list", "", "required")}
          ${selectInput("fleet_type", "Fleet Type", o.fleet_type, "", "required")}
          ${textInput("plat_number", "Plat Number", "Pilih dari list", "", "", 'required oninput="normalizePlateInput(this)" onblur="normalizePlateInput(this); validatePlateInput(this)"')}
          ${selectInput("gate", "Gate", o.gate, "Dock 01", "required")}
          ${selectInput("status", "Status", o.checker_status, "ON_DOCK", "required")}
          ${selectInput("unload_sla", "Unload SLA", o.unload_sla, "ON PROCESS")}
        </div>
        ${datalists()}
        <button class="mt-6 bg-primary-container text-on-primary-container px-6 py-3 rounded-lg font-bold flex items-center gap-2 hover:brightness-110" type="submit">
          <span class="material-symbols-outlined">save</span>Simpan Checker
        </button>
      </form>
    </div>
  </div>`;
}

function pageAntrian() {
  return `${kpiCards()}
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
    <div class="lg:col-span-2 glass-card rounded-xl p-6">
      <div class="flex justify-between items-start mb-6"><div><h3 class="font-headline-md text-headline-md">Ringkasan Antrian</h3><p class="font-label-sm text-on-surface-variant">Urutan driver dari QUEUE_TICKET / Security Input</p></div><div class="flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full border border-primary/20"><div class="w-2 h-2 rounded-full bg-primary status-pulse"></div><span class="text-[10px] uppercase font-bold text-primary">Live</span></div></div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">${miniMetric("Waiting", state.dashboard?.summary?.ticket?.count_waiting || 0, "text-tertiary")}${miniMetric("Called", state.dashboard?.summary?.ticket?.count_called || 0, "text-primary")}${miniMetric("On Dock", state.dashboard?.summary?.ticket?.count_on_dock || 0, "text-warning")}${miniMetric("Completed", state.dashboard?.summary?.ticket?.count_completed || 0, "text-success")}</div>
    </div>
    <div class="glass-card rounded-xl p-6 flex flex-col gap-4">
      <div class="flex justify-between items-center"><h3 class="font-headline-md text-headline-md">Prioritas</h3><span class="material-symbols-outlined text-on-surface-variant">more_vert</span></div>
      ${(state.dashboard?.priority || []).slice(0, 4).map(priorityItem).join("") || emptyBox("Belum ada prioritas.")}
      <button onclick="switchPage('panggil')" class="w-full py-2 border border-outline-variant rounded text-label-sm hover:bg-surface-container transition-colors uppercase font-bold tracking-widest mt-auto">Buka Panggilan</button>
    </div>
  </div>${queueTable()}`;
}

function pagePanggil() {
  const last = state.lastCalled || (state.dashboard?.queue || [])[0] || {};
  return `<div class="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
    <div class="lg:col-span-8 glass-card rounded-xl p-8 min-h-[520px] flex flex-col items-center justify-center text-center">
      <span class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-[0.35em]">Nomor Dipanggil</span>
      <div id="display-queue" class="font-queue-id text-[96px] md:text-[150px] leading-none text-primary my-8">${esc(last.queue_no || "IB-000")}</div>
      <div class="bg-primary-container text-on-primary-container rounded-xl px-10 py-5 text-3xl md:text-5xl font-extrabold"><span id="display-dock">${esc(last.gate || "Dock 01")}</span></div>
      <p class="text-on-surface-variant mt-8 text-lg">${esc(last.vendor_name || "Silakan menuju dock yang tertera.")}</p>
    </div>
    <div class="lg:col-span-4 flex flex-col gap-gutter">
      <div class="glass-card rounded-xl p-6"><h3 class="font-headline-md text-headline-md mb-4">Kontrol Panggilan</h3>
        <select id="call-gate" class="form-select mb-3">${(state.options.gate || []).map((g) => `<option>${esc(g)}</option>`).join("")}</select>
        <button onclick="callNext(this)" class="w-full bg-primary-container text-on-primary-container py-4 rounded-lg font-bold flex items-center justify-center gap-2 hover:brightness-110"><span class="material-symbols-outlined">campaign</span>Panggil Berikutnya</button>
        <button onclick="recall()" class="w-full mt-3 border border-outline-variant py-4 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-surface-container"><span class="material-symbols-outlined">replay</span>Panggil Ulang</button>
      </div>
      <div class="glass-card rounded-xl p-6 flex-1"><h3 class="font-headline-md text-headline-md mb-4">Queue Terbaru</h3>${(
        state.dashboard?.queue || []
      )
        .slice(0, 6)
        .map(
          (x) =>
            `<div class="py-3 border-b border-outline-variant/30"><span class="font-queue-id">${esc(x.queue_no)}</span><span class="float-right text-on-surface-variant">${esc(x.gate || x.status || "-")}</span></div>`,
        )
        .join("")}</div>
    </div>
  </div>`;
}

function pageDock() {
  const docks = state.dashboard?.dock || [];
  return `<div class="glass-card rounded-xl p-6">
    <div class="flex justify-between items-center mb-8"><div><h3 class="font-headline-md text-headline-md">Status Dock</h3><p class="text-on-surface-variant">Cek dock kosong, aktif, dan warning.</p></div><button onclick="refreshDashboard()" class="bg-surface-container-high px-4 py-2 rounded-lg font-label-sm flex items-center gap-2"><span class="material-symbols-outlined">refresh</span>Refresh</button></div>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">${docks.map(dockCard).join("") || emptyBox("Belum ada data dock.")}</div>
  </div>`;
}

function pageMonitor() {
  const rows = (state.dashboard?.queue || []).filter(
    (r) =>
      !String(r.status || "")
        .toUpperCase()
        .includes("COMPLETED"),
  );
  const waiting = rows.filter((r) =>
    String(r.status || "")
      .toUpperCase()
      .includes("WAIT"),
  );
  const cap = state.dashboard?.summary?.caphand || {};
  return `${kpiCards()}
  <div class="grid grid-cols-1 xl:grid-cols-3 gap-gutter">
    <div class="xl:col-span-2 glass-card rounded-xl p-6">
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h3 class="font-headline-md text-headline-md">Waiting List Monitoring</h3>
          <p class="text-on-surface-variant">Fokus pantau plat nomor, gate, status, dan waktu tunggu berjalan.</p>
        </div>
        <button onclick="refreshDashboard()" class="thin-tab rounded-lg px-4 py-3 font-bold flex items-center gap-2 w-fit"><span class="material-symbols-outlined">refresh</span>Refresh</button>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        ${miniMetric("Total Aktif", rows.length, "text-primary")}
        ${miniMetric("Masih Waiting", waiting.length, "text-tertiary")}
        ${miniMetric("PO Data V2", cap.unique_po || 0, "text-secondary")}
      </div>
      <div class="overflow-x-auto">
        <table id="monitor-table" class="w-full text-left">
          <thead class="bg-surface-container text-on-surface-variant">
            <tr>${["Plat", "Queue", "Vendor", "PO", "Gate", "Status", "Menunggu"].map((h) => `<th class="px-4 py-3 font-label-sm uppercase">${h}</th>`).join("")}</tr>
          </thead>
          <tbody class="divide-y divide-outline-variant/10">
            ${rows.map((r) => monitorRow(r)).join("") || `<tr><td colspan="7" class="px-6 py-8 text-center text-on-surface-variant">Belum ada waiting list aktif.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
    <div class="glass-card rounded-xl p-6">
      <h3 class="font-headline-md text-headline-md mb-4">Data V2 Summary</h3>
      <div class="space-y-3">
        ${miniMetric("Rows Data V2", cap.rows || 0, "text-primary")}
        ${miniMetric("Unique SKU", cap.unique_sku || 0, "text-secondary")}
        ${miniMetric("Total Request Qty", num(cap.total_request_qty || 0), "text-success")}
        ${miniMetric("Late Rows", cap.late_rows || 0, "text-error")}
      </div>
    </div>
  </div>`;
}

function monitorRow(r) {
  const st = String(r.status || "").toUpperCase();
  const wait = r.waiting_text || liveWaitingText(r.created_at, r.completed_at);
  const danger =
    Number(r.waiting_minutes || minutesFromCreated(r.created_at)) >= 60;
  return `<tr class="hover:bg-primary/5 ${danger ? "bg-error/5" : ""}">
    <td class="px-4 py-3 font-queue-id text-primary">${esc(r.plat_number || "-")}</td>
    <td class="px-4 py-3 font-queue-id">${esc(r.queue_no || "-")}</td>
    <td class="px-4 py-3">${esc(r.vendor_name || "-")}</td>
    <td class="px-4 py-3 text-sm">${esc(r.po_number || "-")}</td>
    <td class="px-4 py-3">${esc(r.gate || "-")}</td>
    <td class="px-4 py-3">${esc(st || "-")}</td>
    <td class="px-4 py-3 font-queue-id ${danger ? "text-error" : "text-tertiary"}">${esc(wait)}</td>
  </tr>`;
}

function pageLaporan() {
  const rows = state.dashboard?.report_preview || [];
  return `<div class="glass-card rounded-xl p-6">
    <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
      <div>
        <h3 class="font-headline-md text-headline-md">Waiting List</h3>
        <p class="text-on-surface-variant">Hasil input Security. Status dan gate ikut berubah setelah Checker submit berdasarkan plat nomor.</p>
      </div>
      <div class="flex gap-2">
        <button onclick="refreshDashboard()" class="thin-tab rounded-lg px-4 py-3 font-bold flex items-center gap-2"><span class="material-symbols-outlined">refresh</span>Refresh</button>
        <button onclick="exportCsv()" class="bg-primary-container text-on-primary-container px-5 py-3 rounded-lg font-bold flex items-center gap-2"><span class="material-symbols-outlined">download</span>Export CSV</button>
      </div>
    </div>
    ${reportTable(rows)}
  </div>`;
}

function pageSetting() {
  return `<div class="grid grid-cols-1 lg:grid-cols-2 gap-gutter">
    <div class="glass-card rounded-xl p-6"><h3 class="font-headline-md text-headline-md mb-4">API Setup</h3>
      <p class="text-on-surface-variant mb-4">Edit file HTML, ganti konstanta <b>API_URL_V2</b> dengan URL Web App GAS.</p>
      <pre class="bg-surface-container-high/60 border border-outline-variant rounded-lg p-4 text-xs overflow-x-auto">const API_URL_V2 = "${esc(typeof API_URL_V2 !== "undefined" ? API_URL_V2 : "")}";</pre>
      <button onclick="initApi()" class="mt-4 bg-primary-container text-on-primary-container px-6 py-3 rounded-lg font-bold">Test API</button>
    </div>
    <div class="glass-card rounded-xl p-6"><h3 class="font-headline-md text-headline-md mb-4">Endpoint Cepat</h3>
      ${["raw", "reload", "debug"].map((a) => `<button onclick="openApi('${a}')" class="thin-tab rounded-lg px-4 py-2 mr-2 mb-2">${a}</button>`).join("")}
      <p class="text-on-surface-variant text-sm mt-3">Kalau API URL sudah benar, tombol ini buka endpoint di tab baru.</p>
    </div>
  </div>`;
}

function pageDebug() {
  return `<div class="glass-card rounded-xl p-6">
    <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4"><div><h3 class="font-headline-md text-headline-md">Debug API</h3><p class="text-on-surface-variant">Cek schema, sample row, dan hasil agregasi.</p></div><button onclick="loadDebug()" class="bg-primary-container text-on-primary-container px-5 py-3 rounded-lg font-bold flex items-center gap-2"><span class="material-symbols-outlined">bug_report</span>Run Debug</button></div>
    <pre id="debug-output" class="bg-surface-container-high/60 border border-outline-variant rounded-lg p-4 text-xs overflow-auto max-h-[650px]">${esc(JSON.stringify(state.debug || { info: "Klik Run Debug" }, null, 2))}</pre>
  </div>`;
}

function textInput(name, label, placeholder, list, value = "", extra = "") {
  return `<label class="flex flex-col gap-2"><span class="font-label-sm text-label-sm text-on-surface-variant uppercase">${label}</span><input name="${name}" ${list ? `list="${list}"` : ""} ${extra || ""} class="form-input" placeholder="${placeholder || ""}" value="${esc(value || "")}" /></label>`;
}

function selectInput(name, label, options = [], value = "", extra = "") {
  return `<label class="flex flex-col gap-2"><span class="font-label-sm text-label-sm text-on-surface-variant uppercase">${label}</span><select name="${name}" class="form-select" ${extra}>${(options || []).map((o) => `<option ${String(o) === String(value) ? "selected" : ""}>${esc(o)}</option>`).join("")}</select></label>`;
}

function buildSlotOptions(preferred) {
  const base = ["1", "2", "3", "4", "5", "6"];
  const val = String(preferred || "").trim();
  return val && !base.includes(val) ? [val].concat(base) : base;
}

function normalizeFleetType(type) {
  return String(type || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function fleetVisualConfig(type) {
  const key = normalizeFleetType(type);
  const map = {
    "3PL": {
      label: "3PL",
      kind: "truck",
      note: "Third party logistics / armada partner",
      body: "#2563eb",
      accent: "#f59e0b",
      cargo: "#dbeafe",
    },
    CDD: {
      label: "CDD",
      kind: "truck",
      note: "Colt diesel double",
      body: "#2563eb",
      accent: "#22c55e",
      cargo: "#e0f2fe",
    },
    CDDL: {
      label: "CDDL",
      kind: "truck-long",
      note: "CDD long / extended cargo",
      body: "#1d4ed8",
      accent: "#38bdf8",
      cargo: "#dbeafe",
    },
    CDE: {
      label: "CDE",
      kind: "truck-small",
      note: "Colt diesel engkel",
      body: "#2563eb",
      accent: "#a78bfa",
      cargo: "#ede9fe",
    },
    "DROP-OFF": {
      label: "DROP-OFF",
      kind: "box",
      note: "Drop barang / quick unload",
      body: "#ea580c",
      accent: "#f97316",
      cargo: "#ffedd5",
    },
    GMX: {
      label: "GMX",
      kind: "van",
      note: "GMX / small logistics van",
      body: "#0f766e",
      accent: "#14b8a6",
      cargo: "#ccfbf1",
    },
    "L300 BOX": {
      label: "L300 BOX",
      kind: "van-box",
      note: "L300 box",
      body: "#7c3aed",
      accent: "#a78bfa",
      cargo: "#ede9fe",
    },
    MOBIL: {
      label: "MOBIL",
      kind: "car",
      note: "Mobil passenger / small cargo",
      body: "#0284c7",
      accent: "#38bdf8",
      cargo: "#e0f2fe",
    },
    PICKUP: {
      label: "PICKUP",
      kind: "pickup",
      note: "Pickup bak terbuka",
      body: "#16a34a",
      accent: "#4ade80",
      cargo: "#dcfce7",
    },
    "RODA 2": {
      label: "RODA 2",
      kind: "motor",
      note: "Motor / kendaraan roda dua",
      body: "#dc2626",
      accent: "#f87171",
      cargo: "#fee2e2",
    },
    "TRONTON/FUSO": {
      label: "TRONTON/FUSO",
      kind: "truck-heavy",
      note: "Tronton / Fuso heavy cargo",
      body: "#334155",
      accent: "#64748b",
      cargo: "#e2e8f0",
    },
    TRONTON: {
      label: "TRONTON",
      kind: "truck-heavy",
      note: "Tronton heavy cargo",
      body: "#334155",
      accent: "#64748b",
      cargo: "#e2e8f0",
    },
    FUSO: {
      label: "FUSO",
      kind: "truck-heavy",
      note: "Fuso heavy cargo",
      body: "#334155",
      accent: "#64748b",
      cargo: "#e2e8f0",
    },
    VAN: {
      label: "VAN",
      kind: "van",
      note: "Van cargo",
      body: "#0891b2",
      accent: "#22d3ee",
      cargo: "#cffafe",
    },
    "WING BOX": {
      label: "WING BOX",
      kind: "wingbox",
      note: "Truck wing box",
      body: "#2563eb",
      accent: "#60a5fa",
      cargo: "#dbeafe",
    },
    WINGBOX: {
      label: "WING BOX",
      kind: "wingbox",
      note: "Truck wing box",
      body: "#2563eb",
      accent: "#60a5fa",
      cargo: "#dbeafe",
    },
  };

  return (
    map[key] || {
      label: key || "FLEET",
      kind: "truck",
      note: "Preview kendaraan",
      body: "#2563eb",
      accent: "#60a5fa",
      cargo: "#dbeafe",
    }
  );
}

function fleetSvgMarkup(type) {
  const cfg = fleetVisualConfig(type);
  const label = esc(cfg.label || "FLEET");
  const note = esc(cfg.note || "Preview kendaraan");
  const body = cfg.body;
  const accent = cfg.accent;
  const cargo = cfg.cargo;

  const wheel = `<circle cx="170" cy="248" r="24" fill="#0f172a"/><circle cx="170" cy="248" r="10" fill="#94a3b8"/><circle cx="430" cy="248" r="24" fill="#0f172a"/><circle cx="430" cy="248" r="10" fill="#94a3b8"/>`;

  const motor = `
    <circle cx="185" cy="253" r="31" fill="#0f172a"/><circle cx="185" cy="253" r="13" fill="#94a3b8"/>
    <circle cx="412" cy="253" r="31" fill="#0f172a"/><circle cx="412" cy="253" r="13" fill="#94a3b8"/>
    <path d="M215 245 L275 198 L345 200 L405 245" fill="none" stroke="${body}" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M284 197 L304 154 L345 201" fill="none" stroke="${accent}" stroke-width="16" stroke-linecap="round"/>
    <path d="M330 190 L375 155 L418 160" fill="none" stroke="#334155" stroke-width="10" stroke-linecap="round"/>
    <rect x="250" y="160" width="72" height="34" rx="12" fill="${cargo}" stroke="${body}" stroke-width="5"/>
  `;

  const car = `
    <path d="M145 225 H455 C470 225 480 236 480 251 V260 H120 V250 C120 236 131 225 145 225Z" fill="${body}"/>
    <path d="M190 225 L232 174 H360 L410 225Z" fill="${cargo}" stroke="${body}" stroke-width="8" stroke-linejoin="round"/>
    <path d="M239 181 H299 V222 H205Z" fill="#eff6ff"/><path d="M307 181 H356 L394 222 H307Z" fill="#eff6ff"/>
    ${wheel}
  `;

  const pickup = `
    <rect x="130" y="190" width="160" height="58" rx="12" fill="${body}"/>
    <path d="M170 190 L205 150 H275 L310 190Z" fill="${cargo}" stroke="${body}" stroke-width="8"/>
    <rect x="306" y="196" width="175" height="52" rx="10" fill="${cargo}" stroke="${body}" stroke-width="8"/>
    <path d="M320 210 H468" stroke="${accent}" stroke-width="8" stroke-linecap="round"/>
    ${wheel}
  `;

  const van = `
    <rect x="115" y="170" width="360" height="78" rx="18" fill="${body}"/>
    <path d="M115 208 H475 V250 H115Z" fill="${body}"/>
    <rect x="150" y="184" width="80" height="45" rx="8" fill="#eff6ff"/>
    <rect x="245" y="184" width="78" height="45" rx="8" fill="${cargo}"/>
    <rect x="340" y="184" width="78" height="45" rx="8" fill="${cargo}"/>
    ${wheel}
  `;

  const truckBase = (extra = "") => `
    <rect x="112" y="156" width="260" height="92" rx="14" fill="${cargo}" stroke="${body}" stroke-width="9"/>
    <path d="M378 184 H442 L482 218 V248 H378Z" fill="${body}"/>
    <rect x="398" y="193" width="39" height="29" rx="5" fill="#eff6ff"/>
    <path d="M130 182 H354" stroke="${accent}" stroke-width="9" stroke-linecap="round"/>
    <path d="M130 210 H322" stroke="${accent}" stroke-width="9" stroke-linecap="round" opacity=".65"/>
    ${extra}
    ${wheel}
  `;

  const kindMap = {
    motor,
    car,
    pickup,
    van,
    "van-box": `
      <rect x="118" y="158" width="245" height="90" rx="14" fill="${cargo}" stroke="${body}" stroke-width="9"/>
      <path d="M363 184 H442 L482 218 V248 H363Z" fill="${body}"/>
      <rect x="391" y="193" width="42" height="29" rx="5" fill="#eff6ff"/>
      <rect x="145" y="178" width="165" height="50" rx="10" fill="#fff" opacity=".5"/>
      ${wheel}
    `,
    box: truckBase(
      `<text x="185" y="215" font-size="31" font-weight="900" fill="${body}" font-family="Montserrat, Arial">DROP</text>`,
    ),
    wingbox: truckBase(`
      <path d="M124 153 L252 105 L366 153" fill="none" stroke="${accent}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M139 156 L252 122 L352 156" fill="none" stroke="#ffffff" stroke-width="7" opacity=".75"/>
    `),
    "truck-heavy": `
      <rect x="92" y="150" width="300" height="98" rx="12" fill="${cargo}" stroke="${body}" stroke-width="10"/>
      <path d="M399 178 H455 L502 218 V248 H399Z" fill="${body}"/>
      <rect x="421" y="189" width="39" height="31" rx="5" fill="#eff6ff"/>
      <circle cx="146" cy="250" r="24" fill="#0f172a"/><circle cx="146" cy="250" r="10" fill="#94a3b8"/>
      <circle cx="370" cy="250" r="24" fill="#0f172a"/><circle cx="370" cy="250" r="10" fill="#94a3b8"/>
      <circle cx="455" cy="250" r="24" fill="#0f172a"/><circle cx="455" cy="250" r="10" fill="#94a3b8"/>
      <path d="M120 182 H360" stroke="${accent}" stroke-width="9" stroke-linecap="round"/>
      <path d="M120 212 H335" stroke="${accent}" stroke-width="9" stroke-linecap="round" opacity=".65"/>
    `,
    "truck-long": `
      <rect x="86" y="154" width="306" height="94" rx="14" fill="${cargo}" stroke="${body}" stroke-width="9"/>
      <path d="M398 184 H454 L492 218 V248 H398Z" fill="${body}"/>
      <rect x="416" y="193" width="39" height="29" rx="5" fill="#eff6ff"/>
      <path d="M112 182 H366" stroke="${accent}" stroke-width="9" stroke-linecap="round"/>
      <path d="M112 210 H345" stroke="${accent}" stroke-width="9" stroke-linecap="round" opacity=".65"/>
      ${wheel}
    `,
    "truck-small": `
      <rect x="138" y="164" width="226" height="84" rx="14" fill="${cargo}" stroke="${body}" stroke-width="9"/>
      <path d="M371 188 H438 L478 218 V248 H371Z" fill="${body}"/>
      <rect x="395" y="196" width="37" height="27" rx="5" fill="#eff6ff"/>
      <path d="M160 192 H340" stroke="${accent}" stroke-width="9" stroke-linecap="round"/>
      ${wheel}
    `,
    truck: truckBase(""),
  };

  const vehicle = kindMap[cfg.kind] || kindMap.truck;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="620" height="340" viewBox="0 0 620 340" role="img" aria-label="${label}">
    <defs>
      <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stop-color="#eef4ff"/>
        <stop offset="1" stop-color="#dbeafe"/>
      </linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="12" stdDeviation="12" flood-color="#0f172a" flood-opacity=".22"/>
      </filter>
    </defs>
    <rect width="620" height="340" rx="34" fill="url(#bg)"/>
    <circle cx="530" cy="70" r="72" fill="${accent}" opacity=".13"/>
    <circle cx="90" cy="272" r="54" fill="${body}" opacity=".12"/>
    <g filter="url(#shadow)">${vehicle}</g>
    <text x="310" y="54" text-anchor="middle" font-size="30" font-weight="900" fill="#0f172a" font-family="Montserrat, Arial">${label}</text>
    <text x="310" y="91" text-anchor="middle" font-size="15" font-weight="700" fill="#475569" font-family="Montserrat, Arial">${note}</text>
  </svg>`;
}

function fleetImageDataUrl(type) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(fleetSvgMarkup(type))}`;
}

function fleetPreviewCard(selectedType = "") {
  const initial = selectedType || "3PL";
  const cfg = fleetVisualConfig(initial);
  return `<div id="fleet-preview-card" class="md:col-span-2 rounded-xl border border-outline-variant bg-surface-container/50 p-4">
    <div class="flex flex-col md:flex-row items-center gap-4">
      <div class="w-full md:w-[240px] h-[135px] rounded-xl border border-outline-variant bg-surface-container-high overflow-hidden flex items-center justify-center">
        <img id="fleet-preview-image" src="${fleetImageDataUrl(initial)}" alt="${esc(cfg.label)}" class="w-full h-full object-contain" />
      </div>
      <div class="flex-1 text-center md:text-left">
        <div class="text-[11px] uppercase font-bold text-on-surface-variant">Preview Fleet Type</div>
        <div id="fleet-preview-label" class="text-2xl font-extrabold text-primary mt-1">${esc(cfg.label)}</div>
        <div id="fleet-preview-note" class="text-sm text-on-surface-variant mt-2">${esc(cfg.note)}</div>
        <div class="text-[11px] text-on-surface-variant mt-2">Gambar otomatis mengikuti pilihan armada.</div>
      </div>
    </div>
  </div>`;
}

function updateFleetPreview() {
  const form = document.getElementById("security-form");
  if (!form) return;

  const type = form.querySelector('[name="fleet_type"]')?.value || "";
  const cfg = fleetVisualConfig(type);
  const img = document.getElementById("fleet-preview-image");
  const label = document.getElementById("fleet-preview-label");
  const note = document.getElementById("fleet-preview-note");

  if (img) {
    img.src = fleetImageDataUrl(type);
    img.alt = cfg.label;
  }
  if (label) label.textContent = cfg.label;
  if (note) note.textContent = cfg.note;
}

function parsePoInputText(value) {
  if (typeof parsePoNumbers === "function") return parsePoNumbers(value);
  return [
    ...new Set(
      String(value || "")
        .split(/[,\n;]+/)
        .map((x) => x.trim())
        .filter(Boolean),
    ),
  ];
}

function poEncode(value) {
  return encodeURIComponent(String(value || ""));
}

function poDecode(value) {
  try {
    return decodeURIComponent(String(value || ""));
  } catch (err) {
    return String(value || "");
  }
}

function getSelectedPoNumbers() {
  const form = document.getElementById("security-form");
  return parsePoInputText(form?.po_number?.value || "");
}

function setSelectedPoNumbers(values, runLookup = true) {
  const form = document.getElementById("security-form");
  if (!form || !form.po_number) return;
  const clean = [
    ...new Set(
      (values || []).map((x) => String(x || "").trim()).filter(Boolean),
    ),
  ];
  form.po_number.value = clean.join(", ");
  renderPoSelectedChips(clean);
  filterPoDropdown();
  if (runLookup && typeof lookupPo === "function") lookupPo(true);
}

function renderPoSelectedChips(values) {
  const target = document.getElementById("po-selected-chips");
  if (!target) return;
  const selected = values || [];
  target.innerHTML = selected.length
    ? selected
        .map(
          (
            po,
          ) => `<span class="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/25 text-primary px-2 py-1 text-[11px] font-extrabold">
            ${esc(po)}
            <button type="button" class="w-5 h-5 rounded-full bg-primary/10 hover:bg-primary/20 leading-none" onclick="event.stopPropagation(); removePoChoice('${poEncode(po)}')" title="Hapus PO">×</button>
          </span>`,
        )
        .join("")
    : `<span class="text-[12px] text-on-surface-variant px-1">Belum ada PO dipilih</span>`;
}

function getFilteredPoOptions() {
  const q = normalizeKey(
    document.getElementById("po-search-input")?.value || "",
  );
  const selected = new Set(getSelectedPoNumbers().map((x) => normalizeKey(x)));
  return (state.options.po_number || [])
    .filter((po) => {
      const key = normalizeKey(po);
      if (!key || selected.has(key)) return false;
      return !q || key.includes(q);
    })
    .slice(0, 120);
}

function filterPoDropdown() {
  const list = document.getElementById("po-dropdown-list");
  if (!list) return;
  const options = getFilteredPoOptions();
  const q = String(
    document.getElementById("po-search-input")?.value || "",
  ).trim();
  if (!options.length) {
    list.innerHTML = `<div class="px-3 py-3 text-[12px] text-on-surface-variant">${q ? "PO tidak ada di list. Klik Tambah untuk input manual; saat submit tetap divalidasi ke Data V2." : "Ketik PO untuk cari dari Data V2."}</div>`;
    return;
  }
  list.innerHTML = options
    .map((po) => {
      const meta =
        typeof v2PoIndex !== "undefined" ? v2PoIndex?.[normalizeKey(po)] : null;
      const vendor = meta?.vendor_name
        ? `<span class="text-[10px] text-on-surface-variant font-bold truncate">${esc(meta.vendor_name)}</span>`
        : "";
      return `<button type="button" onclick="selectPoChoice('${poEncode(po)}')" class="w-full px-3 py-2 rounded-lg hover:bg-primary/10 text-left flex items-center justify-between gap-3">
        <span class="font-queue-id text-[12px] text-on-surface">${esc(po)}</span>${vendor}
      </button>`;
    })
    .join("");
}

function addPoChoice(value) {
  const incoming = parsePoInputText(value);
  if (!incoming.length) return;
  setSelectedPoNumbers(getSelectedPoNumbers().concat(incoming), true);
  const input = document.getElementById("po-search-input");
  if (input) input.value = "";
  filterPoDropdown();
}

function selectPoChoice(encodedPo) {
  addPoChoice(poDecode(encodedPo));
  const input = document.getElementById("po-search-input");
  if (input) input.focus();
}

function removePoChoice(encodedPo) {
  const key = normalizeKey(poDecode(encodedPo));
  setSelectedPoNumbers(
    getSelectedPoNumbers().filter((po) => normalizeKey(po) !== key),
    true,
  );
}

function addPoFromSearch() {
  addPoChoice(document.getElementById("po-search-input")?.value || "");
}

function handlePoSearchInput(input) {
  const value = String(input?.value || "");
  if (/[,\n;]/.test(value)) addPoChoice(value);
  else filterPoDropdown();
}

function handlePoSearchKeydown(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    const first = getFilteredPoOptions()[0];
    addPoChoice(first || event.target.value);
  } else if (event.key === "Backspace" && !event.target.value) {
    const selected = getSelectedPoNumbers();
    selected.pop();
    setSelectedPoNumbers(selected, true);
  }
}

function openPoDropdown() {
  const dd = document.getElementById("po-dropdown");
  if (!dd) return;
  dd.classList.remove("hidden");
  filterPoDropdown();
}

function closePoDropdownSoon() {
  setTimeout(() => {
    document.getElementById("po-dropdown")?.classList.add("hidden");
  }, 180);
}

function poMultiSelectInput(value = "") {
  const selected = parsePoInputText(value);
  const chipHtml = selected.length
    ? selected
        .map(
          (
            po,
          ) => `<span class="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/25 text-primary px-2 py-1 text-[11px] font-extrabold">
            ${esc(po)}
            <button type="button" class="w-5 h-5 rounded-full bg-primary/10 hover:bg-primary/20 leading-none" onclick="event.stopPropagation(); removePoChoice('${poEncode(po)}')" title="Hapus PO">×</button>
          </span>`,
        )
        .join("")
    : `<span class="text-[12px] text-on-surface-variant px-1">Belum ada PO dipilih</span>`;

  return `<label class="flex flex-col gap-2 md:col-span-2">
    <span class="font-label-sm text-label-sm text-on-surface-variant uppercase">PO Number</span>
    <input type="hidden" name="po_number" value="${esc(selected.join(", "))}" required />
    <div class="relative">
      <div class="form-input min-h-[48px] flex items-center flex-wrap gap-2 py-2 cursor-text" onclick="document.getElementById('po-search-input')?.focus(); openPoDropdown();">
        <div id="po-selected-chips" class="contents">${chipHtml}</div>
        <input id="po-search-input" type="text" class="min-w-[220px] flex-1 bg-transparent border-0 outline-none focus:ring-0 p-1 text-on-surface placeholder:text-on-surface-variant/70" placeholder="Cari PO, klik banyak pilihan, atau paste PO1, PO2" autocomplete="off" onfocus="openPoDropdown()" onblur="closePoDropdownSoon()" oninput="handlePoSearchInput(this)" onkeydown="handlePoSearchKeydown(event)" />
        <button type="button" class="thin-tab rounded-md px-3 py-2 text-[11px] font-extrabold" onclick="event.stopPropagation(); addPoFromSearch()">Tambah</button>
      </div>
      <div id="po-dropdown" class="hidden absolute z-50 left-0 right-0 mt-2 rounded-xl border border-outline-variant bg-surface-container-lowest shadow-2xl max-h-[320px] overflow-y-auto p-2">
        <div id="po-dropdown-list"></div>
      </div>
    </div>
    <span class="form-help">Bisa pilih banyak PO dari dropdown. Vendor Name otomatis mengikuti PO yang dipilih.</span>
  </label>`;
}

let poLookupTimer = null;
function schedulePoLookup() {
  clearTimeout(poLookupTimer);
  poLookupTimer = setTimeout(() => lookupPo(true), 220);
}

function handleTicketTypeChange() {
  const form = document.getElementById("security-form");
  if (!form) return;
  const type = form.querySelector('[name="ticket_type"]')?.value;
  const slot = form.querySelector('[name="slot"]');
  if (slot) {
    slot.disabled = type === "DROP";
    slot.parentElement.style.opacity = type === "DROP" ? "0.45" : "1";
  }
}

function datalists() {
  return `<datalist id="vendor-list">${(state.options.vendor_name || [])
    .slice(0, 500)
    .map((v) => `<option value="${esc(v)}"></option>`)
    .join("")}</datalist><datalist id="po-list">${(
    state.options.po_number || []
  )
    .slice(0, 1000)
    .map((v) => `<option value="${esc(v)}"></option>`)
    .join("")}</datalist>`;
}

function miniMetric(label, value, color) {
  return `<div class="p-4 rounded-lg bg-surface-container/50 border border-outline-variant/30"><span class="text-[10px] text-on-surface-variant uppercase font-bold">${esc(label)}</span><div class="text-xl font-bold ${color}">${esc(value)}</div></div>`;
}

function priorityItem(r) {
  return `<div class="p-4 rounded-lg bg-surface-container/30 border border-outline-variant/30 flex justify-between items-center group hover:bg-primary/10 transition-colors cursor-pointer"><div class="flex flex-col"><span class="font-queue-id text-primary">${esc(r.queue_no || "-")}</span><span class="text-[10px] font-bold text-on-surface-variant uppercase">${esc(r.vendor_name || r.note || "-")}</span></div><div class="text-right"><span class="font-label-sm block">${esc(r.gate || "-")}</span><span class="text-[10px] text-on-surface-variant">${esc(r.status || "-")}</span></div></div>`;
}

function checkerListRow(r, i) {
  const st = String(r.status || "").toUpperCase();
  const wait = r.waiting_text || liveWaitingText(r.created_at, r.completed_at);
  return `<tr data-status="${esc(st || "-")}" class="hover:bg-primary/5 transition-colors">
    <td class="px-4 py-3"><button type="button" onclick="populateCheckerFromTicket(${i})" class="bg-primary-container text-on-primary-container px-3 py-2 rounded-lg font-bold text-xs">Pilih</button></td>
    <td class="px-4 py-3 font-queue-id text-primary">${esc(r.queue_no || "-")}</td>
    <td class="px-4 py-3">${esc(r.vendor_name || "-")}</td>
    <td class="px-4 py-3 text-sm">${esc(r.po_number || "-")}</td>
    <td class="px-4 py-3 font-queue-id text-sm">${esc(r.plat_number || "-")}</td>
    <td class="px-4 py-3">${esc(r.driver_name || "-")}</td>
    <td class="px-4 py-3">${esc(r.gate || "-")}</td>
    <td class="px-4 py-3">${esc(st || "-")}</td>
    <td class="px-4 py-3 font-queue-id text-tertiary">${esc(wait)}</td>
  </tr>`;
}

function populateCheckerFromTicket(index) {
  const row = (state.dashboard?.queue || [])[index];
  const form = document.getElementById("checker-form");
  if (!row || !form) return;
  if (form.vendor_name) form.vendor_name.value = row.vendor_name || "";
  if (form.fleet_type)
    form.fleet_type.value = row.fleet_type || form.fleet_type.value;
  if (form.plat_number)
    form.plat_number.value = normalizePlateValue(row.plat_number || "");
  if (form.gate && row.gate) form.gate.value = row.gate;
  if (form.status)
    form.status.value =
      row.status && row.status !== "WAITING" ? row.status : "ON_DOCK";
  showToast(
    "Data " + (row.queue_no || row.plat_number || "") + " masuk form Checker",
  );
}

function filterCheckerStatus(status) {
  const target = String(status || "ALL").toUpperCase();
  document
    .querySelectorAll("#checker-security-table tbody tr")
    .forEach((tr) => {
      if (target === "ALL") tr.style.display = "";
      else
        tr.style.display = (tr.dataset.status || "").includes(target)
          ? ""
          : "none";
    });
}

function queueTable() {
  const rows = state.dashboard?.queue || [];
  return `<div class="glass-card rounded-xl overflow-hidden border border-outline-variant/30">
    <div class="p-6 border-b border-outline-variant/30 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
      <div class="flex items-center gap-3"><span class="material-symbols-outlined text-primary">stream</span><h3 class="font-headline-md text-headline-md">Data Waiting List</h3></div>
      <input id="queue-search" oninput="filterTable('queue-table',this.value)" class="form-input md:max-w-xs" placeholder="Cari antrian / plat / vendor..." type="text"/>
    </div>
    <div class="overflow-x-auto"><table id="queue-table" class="w-full text-left">
      <thead class="bg-surface-container text-on-surface-variant"><tr>${["No. Antrian", "Vendor", "Plat", "PO", "Status", "Gate", "Menunggu", "Qty", "SKU"].map((h) => `<th class="px-6 py-4 font-label-sm uppercase tracking-wider">${h}</th>`).join("")}</tr></thead>
      <tbody class="divide-y divide-outline-variant/10">${rows.map(queueRow).join("") || `<tr><td colspan="9" class="px-6 py-8 text-center text-on-surface-variant">Belum ada data.</td></tr>`}</tbody>
    </table></div>
  </div>`;
}

function queueRow(q) {
  const st = String(q.status || "").toUpperCase();
  const color = st.includes("WAIT")
    ? "text-tertiary bg-tertiary/20 border-tertiary/30"
    : st.includes("COMP") || st.includes("DONE")
      ? "text-success bg-success/10 border-success/30"
      : st.includes("HOLD") || st.includes("MISS")
        ? "text-error bg-error/10 border-error/30"
        : "text-primary bg-primary/20 border-primary/30";
  return `<tr class="hover:bg-primary/5 transition-colors">
    <td class="px-6 py-4 font-queue-id text-primary">${esc(q.queue_no || "-")}</td>
    <td class="px-6 py-4">${esc(q.vendor_name || "-")}</td>
    <td class="px-6 py-4 font-queue-id text-sm">${esc(q.plat_number || "-")}</td>
    <td class="px-6 py-4 text-sm">${esc(q.po_number || "-")}</td>
    <td class="px-6 py-4"><span class="px-3 py-1 rounded-full text-[10px] font-bold ${color} border">${esc(st || "-")}</span></td>
    <td class="px-6 py-4">${esc(q.gate || "-")}</td>
    <td class="px-6 py-4 font-queue-id text-sm ${st.includes("WAIT") ? "text-tertiary" : "text-on-surface"}">${esc(q.waiting_text || liveWaitingText(q.created_at, q.completed_at))}</td>
    <td class="px-6 py-4">${num(q.total_po_qty || 0)}</td>
    <td class="px-6 py-4">${num(q.count_po_sku || 0)}</td>
  </tr>`;
}

function dockCard(d) {
  const st = String(d.status || "KOSONG").toUpperCase();
  const cls = st.includes("KOSONG")
    ? "border-2 border-dashed border-outline-variant text-on-surface-variant"
    : st.includes("WARN") || st.includes("HOLD") || st.includes("MISS")
      ? "bg-error-container text-on-error-container border-2 border-error status-pulse"
      : "bg-primary-container text-on-primary-container";
  return `<div class="rounded-xl p-5 ${cls} min-h-[140px] flex flex-col justify-between hover:-translate-y-1 transition-transform"><div class="font-headline-md text-xl font-bold">${esc(d.gate || "-")}</div><div><div class="font-label-sm text-label-sm uppercase opacity-80">${esc(st)}</div><div class="font-queue-id mt-1">${esc(d.queue_no || d.plat_number || "-")}</div></div></div>`;
}

function bottleneck(title, value, note, color) {
  return `<div class="bg-surface-container-high/50 p-4 rounded-lg border-l-4 border-current ${color} mb-3"><div class="flex justify-between"><span class="font-bold text-on-surface">${esc(title)}</span><span class="font-queue-id ${color}">${esc(value)}</span></div><p class="text-[12px] text-on-surface-variant mt-1">${esc(note)}</p></div>`;
}

function reportTable(rows) {
  return `<div class="overflow-x-auto"><table id="report-table" class="w-full text-left">
    <thead class="bg-surface-container text-on-surface-variant">
      <tr>${["Created", "Queue", "Vendor", "Fleet", "Plat", "PO", "Gate", "Status", "Menunggu", "Qty", "SKU", "SLA"].map((h) => `<th class="px-4 py-3 font-label-sm uppercase">${h}</th>`).join("")}</tr>
    </thead>
    <tbody class="divide-y divide-outline-variant/10">
      ${rows.map((r) => `<tr class="hover:bg-primary/5">${["created_at", "queue_no", "vendor_name", "fleet_type", "plat_number", "po_number", "gate", "status"].map((k) => `<td class="px-4 py-3 text-sm">${esc(r[k] ?? "")}</td>`).join("")}<td class="px-4 py-3 text-sm font-queue-id text-tertiary">${esc(r.waiting_text || liveWaitingText(r.created_at, r.completed_at))}</td><td class="px-4 py-3 text-sm">${esc(r.total_po_qty ?? "")}</td><td class="px-4 py-3 text-sm">${esc(r.count_po_sku ?? "")}</td><td class="px-4 py-3 text-sm">${esc(r.unload_sla ?? "")}</td></tr>`).join("") || `<tr><td colspan="14" class="px-6 py-8 text-center text-on-surface-variant">Belum ada waiting list.</td></tr>`}
    </tbody>
  </table></div>`;
}

function emptyBox(t) {
  return `<div class="p-6 rounded-lg border border-outline-variant text-on-surface-variant text-center">${esc(t)}</div>`;
}

function renderPage(page, toast = true) {
  const root = document.getElementById("page-root");
  const map = {
    daftar: pageDaftar,
    checker: pageChecker,
    antrian: pageAntrian,
    panggil: pagePanggil,
    monitor: pageMonitor,
    laporan: pageLaporan,
    setting: pageSetting,
    debug: pageDebug,
  };
  const safe = map[page] ? page : "daftar";
  state.page = safe;
  document.getElementById("page-title").textContent = pageMeta[safe].title;
  document.getElementById("page-subtitle").textContent =
    pageMeta[safe].subtitle;
  root.innerHTML = map[safe]();
  if (safe === "daftar")
    setTimeout(() => {
      handleTicketTypeChange();
      renderPoSelectedChips(getSelectedPoNumbers());
      filterPoDropdown();
      updateFleetPreview();
    }, 0);
  updateActiveNav(safe);
  requestAnimationFrame(() => updateActiveNav(safe));
  history.replaceState(null, "", "#" + safe);
  if (toast) showToast("Buka menu " + pageMeta[safe].title);
}

function updateActiveNav(page) {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    const on = btn.dataset.page === page;
    btn.className = on ? navActive : navBase;
    const icon = btn.querySelector(".material-symbols-outlined");
    const label = btn.querySelector("span:not(.material-symbols-outlined)");
    if (icon) icon.style.fontVariationSettings = on ? "'FILL' 1" : "'FILL' 0";
    if (label)
      label.className = on
        ? "font-label-sm text-label-sm font-bold"
        : "font-label-sm text-label-sm";
  });
  document.querySelectorAll(".mobile-nav-btn").forEach((btn) => {
    btn.className = btn.dataset.page === page ? mobActive : mobBase;
  });
}

function switchPage(page) {
  renderPage(page);
}

function exportCsv() {
  const rows = state.dashboard?.report_preview || [];
  if (!rows.length) {
    showToast("Data kosong");
    return;
  }
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(",")]
    .concat(rows.map((r) => headers.map((h) => csvSafe(r[h])).join(",")))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "laporan_antrian_inbound.csv";
  a.click();
  URL.revokeObjectURL(url);
  showToast("CSV didownload");
}

function filterTable(tableId, q) {
  q = String(q || "").toLowerCase();
  document.querySelectorAll(`#${tableId} tbody tr`).forEach((tr) => {
    tr.style.display = tr.textContent.toLowerCase().includes(q) ? "" : "none";
  });
}

function parseDateLocal(value) {
  if (!value) return null;
  const s = String(value);
  let d = null;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s)) {
    d = new Date(s.replace(" ", "T"));
  } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) {
    d = new Date(s);
  } else if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) {
    const p = s.split(/[\/ :]/);
    d = new Date(
      Number(p[2]),
      Number(p[1]) - 1,
      Number(p[0]),
      Number(p[3] || 0),
      Number(p[4] || 0),
      Number(p[5] || 0),
    );
  }
  return d && !isNaN(d.getTime()) ? d : null;
}

function minutesFromCreated(createdAt) {
  const d = parseDateLocal(createdAt);
  if (!d) return 0;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000));
}

function liveWaitingText(createdAt, completedAt) {
  if (completedAt) return "Selesai";
  const mins = minutesFromCreated(createdAt);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}j ${m}m` : `${m}m`;
}

function formatDateTimeLocal(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function normalizePlateValue(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function isValidPlate(value) {
  const plate = normalizePlateValue(value);
  return /^[A-Z]{1,2}\d{1,4}[A-Z]{1,3}$/.test(plate);
}

function normalizePlateInput(input) {
  if (!input) return "";
  input.value = normalizePlateValue(input.value);
  input.classList.remove("invalid");
  return input.value;
}

function validatePlateInput(input) {
  if (!input) return true;
  const plate = normalizePlateInput(input);
  const ok = isValidPlate(plate);
  input.classList.toggle("invalid", !ok && plate.length > 0);
  if (!ok && plate.length > 0)
    input.setCustomValidity(
      "Plat harus lengkap: huruf depan + angka + huruf belakang. Contoh B1234XYZ.",
    );
  else input.setCustomValidity("");
  return ok;
}

function validateRequiredFields(form) {
  let ok = true;
  form.querySelectorAll("input[required], select[required]").forEach((el) => {
    const filled = String(el.value || "").trim() !== "";
    el.classList.toggle("invalid", !filled);
    if (!filled) ok = false;
  });
  return ok;
}

function validateSecurityForm(form) {
  const requiredOk = validateRequiredFields(form);
  const plateOk = validatePlateInput(form.plat_number);
  const ktp = String(form.ktp_6_digit?.value || "").trim();
  if (ktp && !/^\d{6}$/.test(ktp)) {
    form.ktp_6_digit.classList.add("invalid");
    showToast("No KTP opsional, tapi kalau diisi harus 6 digit angka.");
    return false;
  }
  if (!requiredOk) {
    showToast("Field wajib belum lengkap.");
    return false;
  }
  if (!plateOk) {
    showToast("Plat nomor harus lengkap. Contoh valid: B1234XYZ.");
    return false;
  }
  return true;
}

function applyTheme(mode, withToast = true) {
  const html = document.documentElement;
  const icon = document.getElementById("theme-icon");
  const safe = mode === "light" ? "light" : "dark";
  html.classList.toggle("light", safe === "light");
  html.classList.toggle("dark", safe === "dark");
  if (icon) icon.innerText = safe === "light" ? "light_mode" : "dark_mode";
  localStorage.setItem("inboundQueueTheme", safe);
  if (withToast)
    showToast(safe === "light" ? "Light mode aktif" : "Dark mode aktif");
}

function initTheme() {
  applyTheme(localStorage.getItem("inboundQueueTheme") || "light", false);
}

function toggleTheme() {
  applyTheme(
    document.documentElement.classList.contains("dark") ? "light" : "dark",
  );
}

function tickClock() {
  const clock = document.getElementById("live-clock");
  if (clock) clock.textContent = new Date().toLocaleTimeString("id-ID");
}

function showToast(msg) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  document.getElementById("toast-message").innerText = msg;
  toast.classList.remove("opacity-0", "translate-y-10");
  toast.classList.add("opacity-100", "translate-y-0");
  setTimeout(() => {
    toast.classList.add("opacity-0", "translate-y-10");
    toast.classList.remove("opacity-100", "translate-y-0");
  }, 2500);
}

function esc(v) {
  return String(v ?? "").replace(
    /[&<>"']/g,
    (m) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[m],
  );
}

function num(v) {
  return Number(v || 0).toLocaleString("id-ID");
}

function cleanNumber(v) {
  return Number(String(v || "0").replace(/[^0-9.-]/g, "")) || 0;
}

function csvSafe(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

function demoDashboard() {
  return {
    kpis: [
      {
        label: "Total Antrian",
        display_value: "0",
        icon: "confirmation_number",
        color: "primary",
        source: "demo",
        metric: "count_all",
      },
      {
        label: "Menunggu",
        display_value: "0",
        icon: "schedule",
        color: "tertiary",
        source: "demo",
        metric: "waiting",
      },
      {
        label: "PO Hari Ini",
        display_value: "0",
        icon: "inventory_2",
        color: "primary",
        source: "demo",
        metric: "unique_po",
      },
      {
        label: "SKU CAPHAND",
        display_value: "0",
        icon: "barcode_scanner",
        color: "secondary",
        source: "demo",
        metric: "unique_sku",
      },
      {
        label: "Late Rows",
        display_value: "0",
        icon: "warning",
        color: "error",
        source: "demo",
        metric: "late_rows",
      },
      {
        label: "SLA OK",
        display_value: "0%",
        icon: "verified",
        color: "success",
        source: "demo",
        metric: "sla_ok_pct",
      },
    ],
    summary: {
      ticket: {
        count_waiting: 0,
        count_called: 0,
        count_on_dock: 0,
        count_completed: 0,
      },
      checker: {
        on_process: 0,
        completed: 0,
        sla_ok_pct: 0,
        sla_miss: 0,
      },
      caphand: { rows: 0, unique_po: 0, late_rows: 0 },
    },
    queue: [],
    priority: [],
    dock: [
      "Dock 01",
      "Dock 02",
      "Dock 03",
      "Dock 04",
      "Dock 05",
      "Dock 06",
      "Chiller 01",
      "Chiller 02",
    ].map((g) => ({ gate: g, status: "KOSONG" })),
    report_preview: [],
  };
}

function initShader() {
  const canvas = document.getElementById("shader-canvas");
  if (!canvas) return;
  const gl =
    canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
  if (!gl) return;
  function sync() {
    const w = canvas.clientWidth || 1280,
      h = canvas.clientHeight || 720;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }
  if (typeof ResizeObserver !== "undefined")
    new ResizeObserver(sync).observe(canvas);
  sync();
  const vs = `attribute vec2 a_position;varying vec2 v_texCoord;void main(){v_texCoord=a_position*0.5+0.5;gl_Position=vec4(a_position,0.0,1.0);}`;
  const fs = `precision highp float;uniform float u_time;uniform vec2 u_resolution;varying vec2 v_texCoord;float sdRoundRect(vec2 p,vec2 b,float r){vec2 d=abs(p)-b+r;return min(max(d.x,d.y),0.0)+length(max(d,0.0))-r;}void main(){vec2 uv=v_texCoord;vec2 p=(uv*2.0-1.0);p.x*=u_resolution.x/u_resolution.y;float d=length(p);vec3 bg=mix(vec3(0.03,0.08,0.15),vec3(0.01,0.02,0.05),d);float logo=0.0;for(float i=0.0;i<3.0;i++){float t=u_time*(0.5+i*0.2);vec2 off=vec2(sin(t+i),cos(t*0.8+i))*0.4;vec2 lp=p-off;float a=t*0.5;lp=mat2(cos(a),-sin(a),sin(a),cos(a))*lp;float box=sdRoundRect(lp,vec2(0.15,0.15),0.02);logo+=0.01/abs(box+0.01*sin(u_time*2.0+i));}vec3 finalColor=bg+vec3(0.15,0.4,0.9)*logo;float stream=0.0;for(float i=0.0;i<5.0;i++){float row=fract(uv.y+u_time*(0.1+i*0.05)+i*0.2);float line=smoothstep(0.01,0.0,abs(row-0.5));stream+=line*0.1*(0.5+0.5*sin(uv.x*10.0+u_time));}finalColor+=vec3(0.4,0.6,1.0)*stream;gl_FragColor=vec4(finalColor,1.0);}`;
  function sh(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  }
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(prog);
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  );
  const pos = gl.getAttribLocation(prog, "a_position");
  gl.enableVertexAttribArray(pos);
  gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
  const uTime = gl.getUniformLocation(prog, "u_time"),
    uRes = gl.getUniformLocation(prog, "u_resolution");
  function render(t) {
    if (typeof ResizeObserver === "undefined") sync();
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform1f(uTime, t * 0.001);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(render);
  }
  render(0);
}
