document.addEventListener("DOMContentLoaded", () => {
  const error = new URLSearchParams(window.location.search).get("erro");
  if (!error) return;
  const messages = {
    credenciais: "Usuário ou senha incorretos.",
    interno: "Não foi possível entrar agora. Tente novamente.",
  };
  const box = document.getElementById("login-error");
  box.textContent = messages[error] || messages.interno;
  box.hidden = false;
  window.history.replaceState({}, "", "/login");
});
