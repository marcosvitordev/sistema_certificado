window.CES = { csrfToken: "", user: null, defaults: {} };

async function apiRequest(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && !(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
  if (window.CES.csrfToken) headers["X-CSRF-Token"] = window.CES.csrfToken;
  const response = await fetch(url, { ...options, headers });
  if (response.status === 401) {
    window.location.href = "/login";
    throw new Error("Sessão expirada");
  }
  const type = response.headers.get("content-type") || "";
  const data = type.includes("application/json") ? await response.json() : { erro: await response.text() };
  if (!response.ok) {
    const error = new Error(data.erro || "Não foi possível concluir a operação.");
    error.code = data.codigo;
    throw error;
  }
  return data;
}

function showMessage(element, message, type = "error") {
  element.textContent = message;
  element.className = `alert ${type}`;
  element.hidden = false;
}

async function loadSession() {
  const response = await fetch("/api/me");
  if (!response.ok) {
    window.location.href = "/login";
    return null;
  }
  const data = await response.json();
  window.CES = data;
  document.querySelectorAll("#user-name").forEach((el) => { el.textContent = data.user.nome; });
  document.querySelectorAll("#user-login").forEach((el) => { el.textContent = `@${data.user.username}`; });
  document.querySelectorAll("#user-initial").forEach((el) => { el.textContent = data.user.nome.charAt(0).toUpperCase(); });
  document.dispatchEvent(new CustomEvent("ces:ready", { detail: data }));
  return data;
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelector("[data-menu]")?.addEventListener("click", () => document.getElementById("sidebar")?.classList.toggle("open"));
  document.querySelectorAll("[data-logout]").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await apiRequest("/logout", { method: "POST", body: "{}" });
        window.location.href = "/login";
      } catch {
        button.disabled = false;
      }
    });
  });
  loadSession().catch(() => {});
});

window.apiRequest = apiRequest;
window.showMessage = showMessage;
