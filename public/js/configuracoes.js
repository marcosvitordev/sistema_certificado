const get = (id) => document.getElementById(id);

document.addEventListener("ces:ready", (event) => {
  get("required-warning").hidden = !event.detail.user.must_change_password;
});

document.addEventListener("DOMContentLoaded", () => {
  get("password-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.submitter;
    button.disabled = true;
    get("password-message").hidden = true;
    try {
      const result = await apiRequest("/api/me/password", { method: "POST", body: JSON.stringify({
        senha_atual: get("current-password").value,
        nova_senha: get("new-password").value,
        confirmacao: get("confirmation").value,
      }) });
      window.CES.user.must_change_password = false;
      get("required-warning").hidden = true;
      get("password-form").reset();
      showMessage(get("password-message"), result.mensagem, "success");
    } catch (error) {
      showMessage(get("password-message"), error.message);
    } finally {
      button.disabled = false;
    }
  });
});
