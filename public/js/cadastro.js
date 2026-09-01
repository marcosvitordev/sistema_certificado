const field = (id) => document.getElementById(id);

document.addEventListener("ces:ready", (event) => {
  const { defaults, user } = event.detail;
  field("school").value = defaults.escola;
  field("teacher").value = defaults.professor;
  field("coordinator").value = defaults.coordenador;
  field("password-warning").hidden = !user.must_change_password;
  field("submit-button").disabled = user.must_change_password;
});

document.addEventListener("DOMContentLoaded", () => {
  field("student-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = field("submit-button");
    button.disabled = true;
    button.textContent = "Emitindo...";
    field("form-message").hidden = true;
    try {
      const data = await apiRequest("/api/alunos", { method: "POST", body: JSON.stringify({
        nome_aluno: field("name").value,
        escola: field("school").value,
        professor: field("teacher").value,
        coordenador: field("coordinator").value,
        data_inicio: field("start-date").value,
        data_fim: field("end-date").value,
      }) });
      field("created-code").textContent = data.codigo_identificacao;
      field("download-link").href = `/certificado/${data.id}`;
      field("qr-link").href = data.qr_code_url;
      field("success-card").hidden = false;
      field("success-card").scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (error) {
      if (error.code === "CHANGE_PASSWORD_REQUIRED") window.location.href = "/configuracoes";
      else showMessage(field("form-message"), error.message);
    } finally {
      button.disabled = Boolean(window.CES.user?.must_change_password);
      button.textContent = "Emitir certificado";
    }
  });
  field("new-entry").addEventListener("click", () => {
    field("student-form").reset();
    field("school").value = window.CES.defaults.escola;
    field("teacher").value = window.CES.defaults.professor;
    field("coordinator").value = window.CES.defaults.coordenador;
    field("success-card").hidden = true;
    field("name").focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
});
