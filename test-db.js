const mysql = require("mysql2/promise");

(async () => {
  try {
    const conn = await mysql.createConnection({
      host: "br-asc-web951.main-hosting.eu",
      user: "u407486422_bdcertificado",
      password: "Bdcert2025@",
      database: "u407486422_centrodeestudo",
      port: 3306,
      connectTimeout: 10000,
    });

    const [rows] = await conn.query("SELECT NOW() as agora");
    console.log("✅ Conectou! Resultado:", rows);
    await conn.end();
  } catch (err) {
    console.error("❌ ERRO COMPLETO:");
    console.error(err);
  }
})();
