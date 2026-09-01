let currentPage = 1;
let totalPages = 1;
let debounceTimer;

const el = (id) => document.getElementById(id);

function formatDate(value) {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function initials(name) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function actionLink({ label, title, href, className = "", onClick }) {
  const node = document.createElement(href ? "a" : "button");
  node.className = `action-link ${className}`.trim();
  node.textContent = label;
  node.title = title;
  node.setAttribute("aria-label", title);
  if (href) node.href = href;
  if (onClick) node.addEventListener("click", onClick);
  return node;
}

function renderRows(students) {
  const tbody = el("student-list");
  tbody.replaceChildren();
  el("table-message").hidden = students.length > 0;
  el("table-message").textContent = "Nenhum certificado encontrado com estes filtros.";
  for (const student of students) {
    const row = document.createElement("tr");
    const studentTd = document.createElement("td");
    const studentBox = document.createElement("div");
    studentBox.className = "student-cell";
    const monogram = document.createElement("span");
    monogram.className = "student-monogram";
    monogram.textContent = initials(student.nome_aluno);
    const identity = document.createElement("span");
    const name = document.createElement("strong");
    name.textContent = student.nome_aluno;
    const issued = document.createElement("small");
    issued.textContent = `Registro #${student.id}`;
    identity.append(name, issued);
    studentBox.append(monogram, identity);
    studentTd.append(studentBox);

    const schoolTd = document.createElement("td");
    schoolTd.textContent = student.escola;
    const periodTd = document.createElement("td");
    periodTd.textContent = `${formatDate(student.data_inicio)} — ${formatDate(student.data_fim)}`;
    const codeTd = document.createElement("td");
    const code = document.createElement("div");
    code.className = "code-mini";
    code.title = student.codigo_identificacao;
    code.textContent = student.codigo_identificacao;
    codeTd.append(code);

    const actionsTd = document.createElement("td");
    actionsTd.className = "actions-cell";
    const actions = document.createElement("div");
    actions.className = "actions";
    actions.append(
      actionLink({ label: "PDF", title: "Baixar certificado", href: `/certificado/${student.id}` }),
      actionLink({ label: "QR", title: "Abrir QR Code", href: `/qr/${student.id}` }),
      actionLink({ label: "✎", title: "Editar cadastro", onClick: () => openEdit(student) }),
      actionLink({ label: "×", title: "Excluir cadastro", className: "danger", onClick: () => deleteStudent(student) })
    );
    actionsTd.append(actions);
    row.append(studentTd, schoolTd, periodTd, codeTd, actionsTd);
    tbody.append(row);
  }
}

function renderPagination(page, pages, total) {
  totalPages = pages;
  el("page-info").textContent = total ? `Página ${page} de ${pages}` : "Nenhum registro";
  const pagination = el("pagination");
  pagination.replaceChildren();
  const previous = document.createElement("button");
  previous.textContent = "‹";
  previous.disabled = page <= 1;
  previous.setAttribute("aria-label", "Página anterior");
  previous.addEventListener("click", () => goToPage(page - 1));
  pagination.append(previous);

  const start = Math.max(1, page - 2);
  const end = Math.min(pages, page + 2);
  for (let number = start; number <= end; number += 1) {
    const button = document.createElement("button");
    button.textContent = number;
    if (number === page) button.className = "active";
    button.addEventListener("click", () => goToPage(number));
    pagination.append(button);
  }
  const next = document.createElement("button");
  next.textContent = "›";
  next.disabled = page >= pages;
  next.setAttribute("aria-label", "Próxima página");
  next.addEventListener("click", () => goToPage(page + 1));
  pagination.append(next);
}

async function loadStudents() {
  const params = new URLSearchParams({
    page: currentPage,
    limit: 10,
    busca: el("search").value.trim(),
    inicio: el("start-date").value,
    fim: el("end-date").value,
  });
  try {
    const data = await apiRequest(`/api/alunos?${params}`);
    currentPage = data.page;
    renderRows(data.alunos);
    renderPagination(data.page, data.pages, data.total);
    el("result-count").textContent = `${data.total} ${data.total === 1 ? "registro encontrado" : "registros encontrados"}`;
  } catch (error) {
    el("table-message").textContent = error.message;
    el("table-message").hidden = false;
  }
}

async function loadStats() {
  const stats = await apiRequest("/api/stats");
  el("stat-total").textContent = stats.total;
  el("stat-active").textContent = stats.ativos;
  el("stat-month").textContent = stats.novos_mes;
}

function goToPage(page) {
  if (page < 1 || page > totalPages) return;
  currentPage = page;
  loadStudents();
}

function openEdit(student) {
  if (window.CES.user.must_change_password) {
    window.location.href = "/configuracoes";
    return;
  }
  el("edit-id").value = student.id;
  el("edit-name").value = student.nome_aluno;
  el("edit-school").value = student.escola;
  el("edit-teacher").value = student.professor;
  el("edit-coordinator").value = student.coordenador;
  el("edit-start").value = student.data_inicio;
  el("edit-end").value = student.data_fim;
  el("edit-message").hidden = true;
  el("edit-dialog").showModal();
}

async function deleteStudent(student) {
  if (window.CES.user.must_change_password) {
    window.location.href = "/configuracoes";
    return;
  }
  if (!window.confirm(`Excluir o certificado de ${student.nome_aluno}? Esta ação não pode ser desfeita.`)) return;
  try {
    await apiRequest(`/api/alunos/${student.id}`, { method: "DELETE" });
    await Promise.all([loadStudents(), loadStats()]);
  } catch (error) {
    window.alert(error.message);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  el("filter-form").addEventListener("submit", (event) => {
    event.preventDefault();
    currentPage = 1;
    loadStudents();
  });
  el("search").addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => { currentPage = 1; loadStudents(); }, 350);
  });
  el("clear-filters").addEventListener("click", () => {
    el("filter-form").reset();
    currentPage = 1;
    loadStudents();
  });
  document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => el("edit-dialog").close()));
  el("edit-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.submitter;
    button.disabled = true;
    try {
      await apiRequest(`/api/alunos/${el("edit-id").value}`, { method: "PUT", body: JSON.stringify({
        nome_aluno: el("edit-name").value, escola: el("edit-school").value,
        professor: el("edit-teacher").value, coordenador: el("edit-coordinator").value,
        data_inicio: el("edit-start").value, data_fim: el("edit-end").value,
      }) });
      el("edit-dialog").close();
      await loadStudents();
    } catch (error) {
      showMessage(el("edit-message"), error.message);
    } finally {
      button.disabled = false;
    }
  });
});

document.addEventListener("ces:ready", (event) => {
  el("password-warning").hidden = !event.detail.user.must_change_password;
  Promise.all([loadStudents(), loadStats()]).catch(() => {});
});
