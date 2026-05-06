(() => {
  const STORAGE_KEY = "baskahocaa_data_v1";
  const fmtCurrency = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 });
  const fmtDay = new Intl.DateTimeFormat("tr-TR", { weekday: "long" });
  const fmtDate = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });

  const emptyState = { students: [], lessons: [] };
  let state = loadState();
  let lessonMonthFilter = currentMonth();
  let paymentMonthFilter = currentMonth();
  let weeklySelectedDate = todayISO();
  let studentSearchTerm = "";

  const $ = (id) => document.getElementById(id);
  const qsa = (selector) => Array.from(document.querySelectorAll(selector));

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return structuredClone(emptyState);
      const parsed = JSON.parse(raw);
      return {
        students: Array.isArray(parsed.students) ? parsed.students : [],
        lessons: Array.isArray(parsed.lessons) ? parsed.lessons : []
      };
    } catch (error) {
      console.error(error);
      return structuredClone(emptyState);
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    renderAll();
  }

  function uid(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }

  function currentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }

  function todayISO() {
    const now = new Date();
    return dateToISO(now);
  }

  function addDays(date, days) {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + days);
    return copy;
  }

  function getWeekStartISO(dateText) {
    const date = dateText ? parseDate(dateText) : new Date();
    const day = date.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    return dateToISO(addDays(date, mondayOffset));
  }

  function getWeekDates(dateText) {
    const start = parseDate(getWeekStartISO(dateText));
    return Array.from({ length: 7 }, (_, index) => dateToISO(addDays(start, index)));
  }

  function dateToISO(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function escapeHtml(value = "") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function parseDate(dateText) {
    const [y, m, d] = dateText.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function minutesFromTime(timeText) {
    const [h, m] = timeText.split(":").map(Number);
    return h * 60 + m;
  }

  function timeFromMinutes(total) {
    const h = Math.floor(total / 60).toString().padStart(2, "0");
    const m = (total % 60).toString().padStart(2, "0");
    return `${h}:${m}`;
  }

  function formatDate(dateText) {
    if (!dateText) return "-";
    return fmtDate.format(parseDate(dateText));
  }

  function formatDay(dateText) {
    if (!dateText) return "-";
    const value = fmtDay.format(parseDate(dateText));
    return value.charAt(0).toLocaleUpperCase("tr-TR") + value.slice(1);
  }

  function getStudent(studentId) {
    return state.students.find((student) => student.id === studentId);
  }

  function getStudentName(studentId) {
    return getStudent(studentId)?.name || "Silinmiş öğrenci";
  }

  function getLessonEnd(lesson) {
    return minutesFromTime(lesson.time) + Number(lesson.duration || 60);
  }

  function sortLessons(a, b) {
    return `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`);
  }

  function lessonsForMonth(monthValue) {
    return state.lessons
      .filter((lesson) => lesson.date.startsWith(monthValue))
      .sort(sortLessons);
  }

  function buildMonthlySummary(monthValue) {
    const summaryMap = new Map();
    for (const student of state.students) {
      summaryMap.set(student.id, {
        studentId: student.id,
        name: student.name,
        lessons: 0,
        total: 0,
        paid: 0,
        unpaid: 0
      });
    }

    for (const lesson of lessonsForMonth(monthValue)) {
      const student = getStudent(lesson.studentId);
      const key = lesson.studentId;
      if (!summaryMap.has(key)) {
        summaryMap.set(key, { studentId: key, name: student?.name || "Silinmiş öğrenci", lessons: 0, total: 0, paid: 0, unpaid: 0 });
      }
      const row = summaryMap.get(key);
      const fee = Number(lesson.fee || 0);
      row.lessons += 1;
      row.total += fee;
      if (lesson.paid) row.paid += fee;
      else row.unpaid += fee;
    }

    return Array.from(summaryMap.values())
      .filter((row) => row.lessons > 0)
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }

  function totalsFromSummary(summary) {
    return summary.reduce((acc, row) => {
      acc.lessons += row.lessons;
      acc.total += row.total;
      acc.paid += row.paid;
      acc.unpaid += row.unpaid;
      return acc;
    }, { lessons: 0, total: 0, paid: 0, unpaid: 0 });
  }

  function showToast(message) {
    const toast = $("toast");
    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2300);
  }

  function fillInitialDates() {
    $("lessonDate").value = todayISO();
    $("lessonDuration").value = 60;
    $("lessonMonth").value = lessonMonthFilter;
    $("paymentMonth").value = paymentMonthFilter;
    $("weekDate").value = weeklySelectedDate;
  }

  function initTabs() {
    qsa(".tab").forEach((button) => {
      button.addEventListener("click", () => {
        qsa(".tab").forEach((tab) => tab.classList.remove("active"));
        qsa(".panel").forEach((panel) => panel.classList.remove("active"));
        button.classList.add("active");
        $(button.dataset.tab).classList.add("active");
      });
    });
  }

  function initForms() {
    $("studentForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const id = $("studentId").value || uid("student");
      const payload = {
        id,
        name: $("studentName").value.trim(),
        phone: $("studentPhone").value.trim(),
        level: $("studentLevel").value.trim(),
        fee: Number($("studentFee").value || 0),
        note: $("studentNote").value.trim()
      };

      if (!payload.name) {
        showToast("Öğrenci adı gerekli.");
        return;
      }

      const exists = state.students.some((student) => student.id === id);
      if (exists) state.students = state.students.map((student) => student.id === id ? payload : student);
      else state.students.push(payload);
      clearStudentForm();
      saveState();
      showToast("Öğrenci kaydedildi.");
    });

    $("studentCancelBtn").addEventListener("click", clearStudentForm);
    $("studentSearch").addEventListener("input", (event) => {
      studentSearchTerm = event.target.value.trim().toLocaleLowerCase("tr-TR");
      renderStudents();
    });

    $("lessonStudent").addEventListener("change", () => {
      const student = getStudent($("lessonStudent").value);
      if (student && !$("lessonId").value) $("lessonFee").value = student.fee || "";
      updateConflictPreview();
    });

    ["lessonDate", "lessonTime", "lessonDuration"].forEach((id) => {
      $(id).addEventListener("input", updateConflictPreview);
    });

    $("lessonForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const id = $("lessonId").value || uid("lesson");
      const studentId = $("lessonStudent").value;
      const date = $("lessonDate").value;
      const time = $("lessonTime").value;
      const duration = Number($("lessonDuration").value || 60);
      const fee = Number($("lessonFee").value || getStudent(studentId)?.fee || 0);

      if (!studentId || !date || !time || duration <= 0) {
        showToast("Öğrenci, tarih, saat ve süre alanları gerekli.");
        return;
      }

      const conflict = findConflict({ id, date, time, duration });
      if (conflict) {
        const name = getStudentName(conflict.studentId);
        showConflict(`Bu zaman dilimi dolu: ${name} - ${conflict.time} / ${timeFromMinutes(getLessonEnd(conflict))}`);
        showToast("Seçilen saat dolu. Lütfen başka saat seç.");
        return;
      }

      const payload = {
        id,
        studentId,
        date,
        time,
        duration,
        fee,
        paid: $("lessonPaid").checked,
        note: $("lessonNote").value.trim()
      };

      const exists = state.lessons.some((lesson) => lesson.id === id);
      if (exists) state.lessons = state.lessons.map((lesson) => lesson.id === id ? payload : lesson);
      else state.lessons.push(payload);
      clearLessonForm();
      saveState();
      showToast("Ders kaydedildi.");
    });

    $("lessonCancelBtn").addEventListener("click", clearLessonForm);
    $("lessonMonth").addEventListener("change", (event) => {
      lessonMonthFilter = event.target.value || currentMonth();
      renderLessons();
    });
    $("showAllLessons").addEventListener("click", () => {
      lessonMonthFilter = "";
      $("lessonMonth").value = "";
      renderLessons();
    });
    $("paymentMonth").addEventListener("change", (event) => {
      paymentMonthFilter = event.target.value || currentMonth();
      renderPayments();
    });

    $("weekDate").addEventListener("change", (event) => {
      weeklySelectedDate = event.target.value || todayISO();
      renderWeeklyProgram();
    });
    $("prevWeekBtn").addEventListener("click", () => {
      weeklySelectedDate = dateToISO(addDays(parseDate(getWeekStartISO(weeklySelectedDate)), -7));
      $("weekDate").value = weeklySelectedDate;
      renderWeeklyProgram();
    });
    $("nextWeekBtn").addEventListener("click", () => {
      weeklySelectedDate = dateToISO(addDays(parseDate(getWeekStartISO(weeklySelectedDate)), 7));
      $("weekDate").value = weeklySelectedDate;
      renderWeeklyProgram();
    });
    $("todayWeekBtn").addEventListener("click", () => {
      weeklySelectedDate = todayISO();
      $("weekDate").value = weeklySelectedDate;
      renderWeeklyProgram();
    });

    $("backupBtn").addEventListener("click", downloadBackup);
    $("restoreInput").addEventListener("change", restoreBackup);
  }

  function findConflict(candidate) {
    if (!candidate.date || !candidate.time) return null;
    const start = minutesFromTime(candidate.time);
    const end = start + Number(candidate.duration || 60);

    return state.lessons.find((lesson) => {
      if (lesson.id === candidate.id || lesson.date !== candidate.date) return false;
      const lessonStart = minutesFromTime(lesson.time);
      const lessonEnd = lessonStart + Number(lesson.duration || 60);
      return start < lessonEnd && end > lessonStart;
    }) || null;
  }

  function updateConflictPreview() {
    const id = $("lessonId").value || "new";
    const date = $("lessonDate").value;
    const time = $("lessonTime").value;
    const duration = Number($("lessonDuration").value || 60);
    const conflict = findConflict({ id, date, time, duration });
    if (!conflict) {
      hideConflict();
      return;
    }
    showConflict(`Uyarı: Bu saat dolu görünüyor. ${getStudentName(conflict.studentId)} dersi ${conflict.time} - ${timeFromMinutes(getLessonEnd(conflict))} arasında.`);
  }

  function showConflict(message) {
    const box = $("conflictBox");
    box.textContent = message;
    box.classList.remove("hidden");
  }

  function hideConflict() {
    $("conflictBox").classList.add("hidden");
    $("conflictBox").textContent = "";
  }

  function clearStudentForm() {
    $("studentId").value = "";
    $("studentForm").reset();
  }

  function clearLessonForm() {
    $("lessonId").value = "";
    $("lessonForm").reset();
    $("lessonDate").value = todayISO();
    $("lessonDuration").value = 60;
    hideConflict();
  }

  window.editStudent = (id) => {
    const student = getStudent(id);
    if (!student) return;
    $("studentId").value = student.id;
    $("studentName").value = student.name || "";
    $("studentPhone").value = student.phone || "";
    $("studentLevel").value = student.level || "";
    $("studentFee").value = student.fee || "";
    $("studentNote").value = student.note || "";
    switchTab("students");
    showToast("Öğrenci düzenleme modunda.");
  };

  window.deleteStudent = (id) => {
    const student = getStudent(id);
    if (!student) return;
    const lessonCount = state.lessons.filter((lesson) => lesson.studentId === id).length;
    const message = lessonCount
      ? `${student.name} silinsin mi? Bu öğrenciye ait ${lessonCount} ders kaydı da silinir.`
      : `${student.name} silinsin mi?`;
    if (!confirm(message)) return;
    state.students = state.students.filter((item) => item.id !== id);
    state.lessons = state.lessons.filter((lesson) => lesson.studentId !== id);
    saveState();
    showToast("Öğrenci silindi.");
  };

  window.editLesson = (id) => {
    const lesson = state.lessons.find((item) => item.id === id);
    if (!lesson) return;
    $("lessonId").value = lesson.id;
    $("lessonStudent").value = lesson.studentId;
    $("lessonDate").value = lesson.date;
    $("lessonTime").value = lesson.time;
    $("lessonDuration").value = lesson.duration || 60;
    $("lessonFee").value = lesson.fee || "";
    $("lessonPaid").checked = !!lesson.paid;
    $("lessonNote").value = lesson.note || "";
    hideConflict();
    switchTab("lessons");
    showToast("Ders düzenleme modunda.");
  };

  window.deleteLesson = (id) => {
    const lesson = state.lessons.find((item) => item.id === id);
    if (!lesson) return;
    if (!confirm(`${formatDate(lesson.date)} ${lesson.time} tarihli ders silinsin mi?`)) return;
    state.lessons = state.lessons.filter((item) => item.id !== id);
    saveState();
    showToast("Ders silindi.");
  };

  window.togglePaid = (id) => {
    state.lessons = state.lessons.map((lesson) => lesson.id === id ? { ...lesson, paid: !lesson.paid } : lesson);
    saveState();
    showToast("Ödeme durumu güncellendi.");
  };

  function switchTab(tabId) {
    qsa(".tab").forEach((button) => button.classList.toggle("active", button.dataset.tab === tabId));
    qsa(".panel").forEach((panel) => panel.classList.toggle("active", panel.id === tabId));
  }

  function renderAll() {
    renderStudentSelect();
    renderStudents();
    renderLessons();
    renderWeeklyProgram();
    renderPayments();
    renderDashboard();
  }

  function renderStudentSelect() {
    const select = $("lessonStudent");
    const selected = select.value;
    if (!state.students.length) {
      select.innerHTML = `<option value="">Önce öğrenci ekleyin</option>`;
      return;
    }
    select.innerHTML = `<option value="">Öğrenci seçin</option>` + state.students
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, "tr"))
      .map((student) => `<option value="${student.id}">${escapeHtml(student.name)}</option>`)
      .join("");
    if (selected) select.value = selected;
  }

  function renderStudents() {
    const body = $("studentBody");
    const students = state.students
      .filter((student) => {
        if (!studentSearchTerm) return true;
        return `${student.name} ${student.level} ${student.phone}`.toLocaleLowerCase("tr-TR").includes(studentSearchTerm);
      })
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));

    if (!students.length) {
      body.innerHTML = `<tr><td class="empty" colspan="4">Henüz öğrenci yok.</td></tr>`;
      return;
    }

    body.innerHTML = students.map((student) => `
      <tr>
        <td><strong>${escapeHtml(student.name)}</strong><br><span class="hint">${escapeHtml(student.phone || student.note || "-")}</span></td>
        <td>${escapeHtml(student.level || "-")}</td>
        <td>${fmtCurrency.format(Number(student.fee || 0))}</td>
        <td>
          <div class="actions">
            <button class="btn icon muted" onclick="editStudent('${student.id}')" type="button">Düzenle</button>
            <button class="btn icon danger" onclick="deleteStudent('${student.id}')" type="button">Sil</button>
          </div>
        </td>
      </tr>
    `).join("");
  }

  function renderLessons() {
    const body = $("lessonBody");
    let lessons = state.lessons.slice().sort(sortLessons);
    if (lessonMonthFilter) lessons = lessons.filter((lesson) => lesson.date.startsWith(lessonMonthFilter));

    if (!lessons.length) {
      body.innerHTML = `<tr><td class="empty" colspan="8">Bu filtrede ders kaydı yok.</td></tr>`;
      return;
    }

    body.innerHTML = lessons.map((lesson) => `
      <tr>
        <td>${formatDate(lesson.date)}</td>
        <td>${formatDay(lesson.date)}</td>
        <td><strong>${lesson.time}</strong> - ${timeFromMinutes(getLessonEnd(lesson))}</td>
        <td>${escapeHtml(getStudentName(lesson.studentId))}</td>
        <td>${Number(lesson.duration || 60)} dk</td>
        <td>${fmtCurrency.format(Number(lesson.fee || 0))}</td>
        <td><span class="badge ${lesson.paid ? "paid" : "unpaid"}">${lesson.paid ? "Ödendi" : "Bekliyor"}</span></td>
        <td>
          <div class="actions">
            <button class="btn icon muted" onclick="editLesson('${lesson.id}')" type="button">Düzenle</button>
            <button class="btn icon danger" onclick="deleteLesson('${lesson.id}')" type="button">Sil</button>
          </div>
        </td>
      </tr>
    `).join("");
  }

  function renderWeeklyProgram() {
    const head = $("weeklyProgramHead");
    const body = $("weeklyProgramBody");
    const weekDates = getWeekDates(weeklySelectedDate);
    const weekStart = weekDates[0];
    const weekEnd = weekDates[6];

    $("weekRangeText").textContent = `${formatDate(weekStart)} - ${formatDate(weekEnd)}`;

    const dayNames = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
    head.innerHTML = `
      <tr>
        <th>Saat / Gün</th>
        ${weekDates.map((date, index) => `<th>${dayNames[index]}<span class="schedule-day-date">${formatDate(date)}</span></th>`).join("")}
      </tr>
    `;

    const lessonsOfWeek = state.lessons
      .filter((lesson) => weekDates.includes(lesson.date))
      .sort(sortLessons);

    const defaultTimes = [];
    for (let hour = 8; hour <= 22; hour += 1) {
      defaultTimes.push(`${String(hour).padStart(2, "0")}:00`);
    }

    const timeRows = Array.from(new Set([
      ...defaultTimes,
      ...lessonsOfWeek.map((lesson) => lesson.time)
    ])).sort((a, b) => minutesFromTime(a) - minutesFromTime(b));

    body.innerHTML = timeRows.map((time) => {
      const cells = weekDates.map((date) => {
        const lessonsInCell = lessonsOfWeek.filter((lesson) => lesson.date === date && lesson.time === time);
        if (!lessonsInCell.length) return `<td class="schedule-cell"></td>`;
        return `<td class="schedule-cell has-lesson">${lessonsInCell.map((lesson) => `
          <button class="lesson-chip" onclick="editLesson('${lesson.id}')" type="button" title="Dersi düzenle">
            <strong>${escapeHtml(getStudentName(lesson.studentId))}</strong>
            <span>${lesson.time} - ${timeFromMinutes(getLessonEnd(lesson))}</span>
            ${lesson.note ? `<em>${escapeHtml(lesson.note)}</em>` : ""}
          </button>
        `).join("")}</td>`;
      }).join("");

      return `<tr><td class="schedule-time">${time}</td>${cells}</tr>`;
    }).join("");
  }

  function renderPayments() {
    const lessons = lessonsForMonth(paymentMonthFilter);
    const body = $("paymentBody");
    if (!lessons.length) {
      body.innerHTML = `<tr><td class="empty" colspan="7">Seçili ayda ders/ödeme kaydı yok.</td></tr>`;
    } else {
      body.innerHTML = lessons.map((lesson) => `
        <tr>
          <td>${formatDate(lesson.date)}<br><span class="hint">${formatDay(lesson.date)}</span></td>
          <td><strong>${lesson.time}</strong></td>
          <td>${escapeHtml(getStudentName(lesson.studentId))}</td>
          <td>${fmtCurrency.format(Number(lesson.fee || 0))}</td>
          <td>
            <label class="checkline" style="padding:0">
              <input type="checkbox" ${lesson.paid ? "checked" : ""} onchange="togglePaid('${lesson.id}')" />
              <span>${lesson.paid ? "Ödendi" : "Bekliyor"}</span>
            </label>
          </td>
          <td>${escapeHtml(lesson.note || "-")}</td>
          <td><button class="btn icon muted" onclick="editLesson('${lesson.id}')" type="button">Düzenle</button></td>
        </tr>
      `).join("");
    }

    const summary = buildMonthlySummary(paymentMonthFilter);
    const totals = totalsFromSummary(summary);
    $("paymentSummaryCards").innerHTML = `
      <article class="summary-card"><span>Toplam ders</span><strong>${totals.lessons}</strong></article>
      <article class="summary-card"><span>Ödenen toplam</span><strong>${fmtCurrency.format(totals.paid)}</strong></article>
      <article class="summary-card"><span>Ödenmeyen toplam</span><strong>${fmtCurrency.format(totals.unpaid)}</strong></article>
    `;

    const summaryBody = $("paymentSummaryBody");
    if (!summary.length) {
      summaryBody.innerHTML = `<tr><td class="empty" colspan="5">Seçili ayda öğrenci bazlı ödeme yok.</td></tr>`;
    } else {
      summaryBody.innerHTML = summary.map((row) => `
        <tr>
          <td>${escapeHtml(row.name)}</td>
          <td>${row.lessons}</td>
          <td>${fmtCurrency.format(row.total)}</td>
          <td><span class="badge paid">${fmtCurrency.format(row.paid)}</span></td>
          <td><span class="badge ${row.unpaid > 0 ? "unpaid" : "paid"}">${fmtCurrency.format(row.unpaid)}</span></td>
        </tr>
      `).join("");
    }

    $("totalLessonsFoot").textContent = totals.lessons;
    $("totalAmountFoot").textContent = fmtCurrency.format(totals.total);
    $("totalPaidFoot").textContent = fmtCurrency.format(totals.paid);
    $("totalUnpaidFoot").textContent = fmtCurrency.format(totals.unpaid);
  }

  function renderDashboard() {
    const month = currentMonth();
    const monthLessons = lessonsForMonth(month);
    const summary = buildMonthlySummary(month);
    const totals = totalsFromSummary(summary);

    $("statStudents").textContent = state.students.length;
    $("statMonthLessons").textContent = monthLessons.length;
    $("statPaid").textContent = fmtCurrency.format(totals.paid);
    $("statUnpaid").textContent = fmtCurrency.format(totals.unpaid);
    $("dashboardMonthText").textContent = month;

    const nowDate = todayISO();
    const upcoming = state.lessons
      .filter((lesson) => lesson.date >= nowDate)
      .sort(sortLessons)
      .slice(0, 8);

    $("upcomingLessonsBody").innerHTML = upcoming.length ? upcoming.map((lesson) => `
      <tr>
        <td>${formatDate(lesson.date)}<br><span class="hint">${formatDay(lesson.date)}</span></td>
        <td><strong>${lesson.time}</strong></td>
        <td>${escapeHtml(getStudentName(lesson.studentId))}</td>
        <td>${fmtCurrency.format(Number(lesson.fee || 0))}</td>
      </tr>
    `).join("") : `<tr><td class="empty" colspan="4">Yaklaşan ders yok.</td></tr>`;

    $("dashboardPaymentBody").innerHTML = summary.length ? summary.map((row) => `
      <tr>
        <td>${escapeHtml(row.name)}</td>
        <td>${row.lessons}</td>
        <td>${fmtCurrency.format(row.paid)}</td>
        <td>${fmtCurrency.format(row.unpaid)}</td>
      </tr>
    `).join("") : `<tr><td class="empty" colspan="4">Bu ay ödeme kaydı yok.</td></tr>`;
  }

  function downloadBackup() {
    const payload = {
      app: "baskahocaa",
      exportedAt: new Date().toISOString(),
      data: state
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `baskahocaa-yedek-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function restoreBackup(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const data = parsed.data || parsed;
        if (!Array.isArray(data.students) || !Array.isArray(data.lessons)) throw new Error("Geçersiz yedek");
        if (!confirm("Yedek yüklenince mevcut bilgiler bu yedekle değiştirilecek. Devam edilsin mi?")) return;
        state = { students: data.students, lessons: data.lessons };
        saveState();
        showToast("Yedek yüklendi.");
      } catch (error) {
        console.error(error);
        alert("Yedek dosyası okunamadı. Lütfen doğru JSON dosyasını seçin.");
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  }

  function registerServiceWorker() {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("service-worker.js").catch(() => undefined);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    fillInitialDates();
    initTabs();
    initForms();
    renderAll();
    registerServiceWorker();
  });
})();
