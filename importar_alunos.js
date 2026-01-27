const fs = require("fs-extra");
const path = require("path");
const mysql = require("mysql2/promise");
const QRCode = require("qrcode");

// ==== CONFIGURAR AQUI =====
const DB_CONFIG = {
  host: "localhost",
  user: "root",
  password: "1234",
  database: "sistema_cursos",
};

const ALUNOS_JSON = [
    {
        "codigo_identificacao": "236fb129-af91-4b5f-a856-7efa6b4fbced",
        "escola": "Centro de Estudo Sena - CES",
        "nome_aluno": "Marcos Vitor",
        "professor": "MARCOS VITOR LIMA DA COSTA",
        "coordenador": "JOAQUIM DE ARAÚJO MORAIS",
        "data_inicio": "15/10/2019",
        "data_fim": "07/10/2024"
    },
    {
        "codigo_identificacao": "f74c5e75-c3b7-4340-b53c-5901853feecb",
        "escola": "Centro de Estudo Sena - CES",
        "nome_aluno": "ANA BEATRIZ  SILVA DE SOUZA",
        "professor": "MARCOS VITOR LIMA DA COSTA",
        "coordenador": "JOAQUIM DE ARAUJO MORAIS",
        "data_inicio": "10/06/2024",
        "data_fim": "10/12/2024"
    },
    {
        "codigo_identificacao": "b4472bcd-fbfc-4300-ab4a-2a35dd09a355",
        "escola": "Centro de Estudo Sena - CES",
        "nome_aluno": "MARIA CLARA DE SOUZA QUEIROZ",
        "professor": "MARCOS VITOR LIMA DA COSTA",
        "coordenador": "JOAQUIM DE ARAUJO MORAIS",
        "data_inicio": "10/06/2024",
        "data_fim": "10/12/2024"
    },
    {
        "codigo_identificacao": "4ffe8536-7999-47c4-8bd5-92c44dd82a99",
        "escola": "Centro de Estudo Sena - CES",
        "nome_aluno": "SINGRIDY EMILLY MARQUES DA SILVA",
        "professor": "MARCOS VITOR LIMA DA COSTA",
        "coordenador": "JOAQUIM DE ARAUJO MORAIS",
        "data_inicio": "01/07/2025",
        "data_fim": "01/01/2025"
    },
    {
        "codigo_identificacao": "88e20cb0-7457-4129-8fe3-ee04d71b877b",
        "escola": "Centro de Estudo Sena - CES",
        "nome_aluno": "REINALDO COSTA DA SILVA",
        "professor": "MARCOS VITOR LIMA DA COSTA",
        "coordenador": "JOAQUIM DE ARAUJO MORAIS",
        "data_inicio": "15/07/2025",
        "data_fim": "15/01/2025"
    },
    {
        "codigo_identificacao": "4414563d-2f91-43b9-bdf1-d7d4ecd55370",
        "escola": "Centro de Estudo Sena - CES",
        "nome_aluno": "YASMIN THAELLY MARQUES DA SILVA",
        "professor": "MARCOS VITOR LIMA DA COSTA",
        "coordenador": "JOAQUIM DE ARAUJO MORAIS",
        "data_inicio": "02/09/2024",
        "data_fim": "02/03/2025"
    },
    {
        "codigo_identificacao": "6a65bfd9-ea60-4701-b329-11adadf1968a",
        "escola": "Centro de Estudo Sena - CES",
        "nome_aluno": "RONALEUDO SILVA DA ROCHA",
        "professor": "MARCOS VITOR LIMA DA COSTA",
        "coordenador": "JOAQUIM DE ARAUJO MORAIS",
        "data_inicio": "13/08/2024",
        "data_fim": "13/02/2025"
    },
    {
        "codigo_identificacao": "5e294892-b87e-454e-9513-9ef7e0329cdc",
        "escola": "Centro de Estudo Sena - CES",
        "nome_aluno": "MARLY RUFINO DE PAIVA",
        "professor": "MARCOS VITOR LIMA DA COSTA",
        "coordenador": "JOAQUIM DE ARAUJO MORAIS",
        "data_inicio": "13/08/2024",
        "data_fim": "13/02/2025"
    },
    {
        "codigo_identificacao": "001665ef-2c08-4846-9bbe-cba3822c6217",
        "escola": "Centro de Estudo Sena - CES",
        "nome_aluno": "ANA PAULA DA SILVA MOURA",
        "professor": "MARCOS VITOR LIMA DA COSTA",
        "coordenador": "JOAQUIM DE ARAUJO MORAIS",
        "data_inicio": "27/08/2024",
        "data_fim": "27/02/2025"
    },
    {
        "codigo_identificacao": "02c1492b-7e8d-4ea9-b4fe-8a7e6a507834",
        "escola": "Centro de Estudo Sena - CES",
        "nome_aluno": "ANTONIA NUNES DE PAIVA",
        "professor": "MARCOS VITOR LIMA DA COSTA",
        "coordenador": "JOAQUIM DE ARAUJO MORAIS",
        "data_inicio": "12/08/2024",
        "data_fim": "12/02/2025"
    },
    {
        "codigo_identificacao": "ad4d9978-a46a-4b07-88b5-25fa9e54a3b5",
        "escola": "Centro de Estudo Sena - CES",
        "nome_aluno": "JEFTÉR MATEUS DE SOUZA SANTOS",
        "professor": "MARCOS VITOR LIMA DA COSTA",
        "coordenador": "JOAQUIM DE ARAUJO MORAIS",
        "data_inicio": "05/08/2024",
        "data_fim": "05/02/2025"
    },
    {
        "codigo_identificacao": "64f567bf-0632-41c1-96bb-a35964aa07d7",
        "escola": "Centro de Estudo Sena - CES",
        "nome_aluno": "AMANDA VITÓRIA RODRIGUES SILVA",
        "professor": "MARCOS VITOR LIMA DA COSTA",
        "coordenador": "JOAQUIM DE ARAUJO MORAIS",
        "data_inicio": "26/08/2024",
        "data_fim": "26/02/2025"
    },
    {
        "codigo_identificacao": "4ab96e90-0913-484a-9eeb-9c889795c5ef",
        "escola": "Centro de Estudo Sena - CES",
        "nome_aluno": "MATHEUS ALMEIDA DE QUEIROZ",
        "professor": "MARCOS VITOR LIMA DA COSTA",
        "coordenador": "JOAQUIM DE ARAUJO MORAIS",
        "data_inicio": "08/10/2024",
        "data_fim": "08/04/2025"
    },
    {
        "codigo_identificacao": "24bf7a03-de6c-4ffb-8437-1b6990f19c11",
        "escola": "Centro de Estudo Sena - CES",
        "nome_aluno": "OGG KAUÊ TAVARES LIMA",
        "professor": "MARCOS VITOR LIMA DA COSTA",
        "coordenador": "JOAQUIM DE ARAUJO MORAIS",
        "data_inicio": "02/09/2024",
        "data_fim": "02/03/2025"
    },
    {
        "codigo_identificacao": "f3f61aa1-4fe4-4a8e-bc58-653dc2b67cca",
        "escola": "Centro de Estudo Sena - CES",
        "nome_aluno": "CALEBE SILVA ALENCAR",
        "professor": "MARCOS VITOR LIMA DA COSTA",
        "coordenador": "JOAQUIM DE ARAUJO MORAIS",
        "data_inicio": "09/12/2024",
        "data_fim": "09/06/2025"
    },
    {
        "codigo_identificacao": "0370d9f0-32ec-4d95-ab33-40448690d6a6",
        "escola": "Centro de Estudo Sena - CES",
        "nome_aluno": "GLEICIANE PEIXE DE SOUZA SANTOS",
        "professor": "MARCOS VITOR LIMA DA COSTA",
        "coordenador": "JOAQUIM DE ARAUJO MORAIS",
        "data_inicio": "21/10/2024",
        "data_fim": "21/04/2025"
    },
    {
        "codigo_identificacao": "54bdf43d-12ca-4838-92f0-c7f7407e8d00",
        "escola": "Centro de Estudo Sena - CES",
        "nome_aluno": "SIRLANDIA DOS SANTOS LOPES",
        "professor": "MARCOS VITOR LIMA DA COSTA",
        "coordenador": "JOAQUIM DE ARAUJO MORAIS",
        "data_inicio": "05/11/2024",
        "data_fim": "05/05/2025"
    },
    {
        "codigo_identificacao": "d21e308a-bdc1-4ee1-9f5c-3e4389bc53ec",
        "escola": "Centro de Estudo Sena - CES",
        "nome_aluno": "sadasdsa",
        "professor": "MARCOS VITOR LIMA DA COSTA",
        "coordenador": "JOAQUIM DE ARAUJO MORAIS",
        "data_inicio": "30/07/2025",
        "data_fim": "30/07/2025"
    },
    {
        "codigo_identificacao": "5e20b944-099e-47b8-930d-10acb41e1f03",
        "escola": "Centro de Estudo Sena - CES",
        "nome_aluno": "MESSIAS SILVA DE ALMEIDA",
        "professor": "MARCOS VITOR LIMA DA COSTA",
        "coordenador": "JOAQUIM DE ARAUJO MORAIS",
        "data_inicio": "31/01/2025",
        "data_fim": "13/07/2025"
    },
    {
        "codigo_identificacao": "28f9bc9f-d73b-413c-ab64-7d38cf19ee9a",
        "escola": "Centro de Estudo Sena - CES",
        "nome_aluno": "ROMEU SILVA DO NASCIMENTO",
        "professor": "MARCOS VITOR LIMA DA COSTA",
        "coordenador": "JOAQUIM DE ARAUJO MORAIS",
        "data_inicio": "31/01/2025",
        "data_fim": "13/07/2025"
    },
    {
        "codigo_identificacao": "807dc2dc-722f-4520-b394-1a02a5127094",
        "escola": "Centro de Estudo Sena - CES",
        "nome_aluno": "FRANCISCO DAS CHAGAS SILVA DE ALMEIDA",
        "professor": "MARCOS VITOR LIMA DA COSTA",
        "coordenador": "JOAQUIM DE ARAUJO MORAIS",
        "data_inicio": "31/01/2025",
        "data_fim": "13/07/2025"
    },
    {
        "codigo_identificacao": "65e49a05-8c93-4be4-9571-a1eaade2ade1",
        "escola": "Centro de Estudo Sena - CES",
        "nome_aluno": "GALBERT ENDREW LIMA VASQUES HENRIQUE",
        "professor": "MARCOS VITOR LIMA DA COSTA",
        "coordenador": "JOAQUIM DE ARAUJO MORAIS",
        "data_inicio": "28/01/2025",
        "data_fim": "28/07/2025"
    },
    {
        "codigo_identificacao": "1295f4c6-dda7-4ead-a2fb-c89ef14a64a6",
        "escola": "Centro de Estudo Sena - CES",
        "nome_aluno": "ERIANE ALVES DE FREITAS",
        "professor": "MARCOS VITOR LIMA DA COSTA",
        "coordenador": "JOAQUIM DE ARAUJO MORAIS",
        "data_inicio": "18/02/2025",
        "data_fim": "18/08/2025"
    },
    {
        "codigo_identificacao": "fc71cafc-1430-4664-9751-cce0ef3bb18d",
        "escola": "Centro de Estudo Sena - CES",
        "nome_aluno": "RAYNER MIRANDA MACEDO",
        "professor": "MARCOS VITOR LIMA DA COSTA",
        "coordenador": "JOAQUIM DE ARAUJO MORAIS",
        "data_inicio": "24/02/2025",
        "data_fim": "24/08/2025"
    },
    {
        "codigo_identificacao": "de5b7372-4983-473c-8fe9-cf61f2cef8ad",
        "escola": "Centro de Estudo Sena - CES",
        "nome_aluno": "WESLLEY RODRIGUES MOURA",
        "professor": "MARCOS VITOR LIMA DA COSTA",
        "coordenador": "JOAQUIM DE ARAUJO MORAIS",
        "data_inicio": "10/03/2025",
        "data_fim": "10/09/2025"
    },
    {
        "codigo_identificacao": "9b98ab1d-aa4b-4b86-afef-1048cffda2ad",
        "escola": "Centro de Estudo Sena - CES",
        "nome_aluno": "FRANCISCO RUFINO DA SILVA",
        "professor": "MARCOS VITOR LIMA DA COSTA",
        "coordenador": "JOAQUIM DE ARAUJO MORAIS",
        "data_inicio": "24/03/2025",
        "data_fim": "24/08/2025"
    },
    {
        "codigo_identificacao": "0444fd7c-3b5a-4d83-9b25-06973271a9fb",
        "escola": "Centro de Estudo Sena - CES",
        "nome_aluno": "SAMUEL RIBEIRO DE MAGALHÃES",
        "professor": "MARCOS VITOR LIMA DA COSTA",
        "coordenador": "JOAQUIM DE ARAUJO MORAIS",
        "data_inicio": "17/02/2025",
        "data_fim": "17/08/2025"
    },
    {
        "codigo_identificacao": "a55109ac-f0bd-499f-b49b-0594444cd74c",
        "escola": "Centro de Estudo Sena - CES",
        "nome_aluno": "JOCINEI CIDRÃO DE FARIAS",
        "professor": "MARCOS VITOR LIMA DA COSTA",
        "coordenador": "JOAQUIM DE ARAUJO MORAIS",
        "data_inicio": "04/02/2025",
        "data_fim": "04/08/2025"
    },
    {
        "codigo_identificacao": "28342dde-f79a-42b2-856b-685bc2d9c65d",
        "escola": "Centro de Estudo Sena - CES",
        "nome_aluno": "LUCAS GABRIEL DA SILVA GIMES",
        "professor": "MARCOS VITOR LIMA DA COSTA",
        "coordenador": "JOAQUIM DE ARAUJO MORAIS",
        "data_inicio": "10/03/2025",
        "data_fim": "10/09/2025"
    }
];

// =======================
// Função para converter data BR → SQL
// =======================
function converterDataBR(data) {
  const [dia, mes, ano] = data.split("/");
  return `${ano}-${mes}-${dia}`;
}

// =======================
// Função principal
// =======================
(async () => {
  try {
    const conn = await mysql.createConnection(DB_CONFIG);

    console.log("🔧 Banco conectado!");
    await fs.ensureDir("qrcodes");

    for (const aluno of ALUNOS_JSON) {
      const data_inicio_sql = converterDataBR(aluno.data_inicio);
      const data_fim_sql = converterDataBR(aluno.data_fim);

      const qrFile = `qr_${aluno.nome_aluno.replace(/ /g, "_")}_${aluno.codigo_identificacao}.png`;
      const qrPath = path.join("qrcodes", qrFile);

      // gerar QR
      await QRCode.toFile(qrPath, JSON.stringify(aluno));
      console.log(`📌 QR gerado: ${qrPath}`);

      // salvar no MySQL
      await conn.query(
        `INSERT INTO alunos
        (codigo_identificacao, nome_aluno, escola, professor, coordenador, data_inicio, data_fim, qr_path)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          aluno.codigo_identificacao,
          aluno.nome_aluno.trim(),
          aluno.escola,
          aluno.professor,
          aluno.coordenador,
          data_inicio_sql,
          data_fim_sql,
          qrPath
        ]
      );

      console.log(`✅ Inserido: ${aluno.nome_aluno}`);
    }

    console.log("\n🎉 FINALIZADO COM SUCESSO!");
    process.exit();

  } catch (err) {
    console.error("❌ Erro:", err);
    process.exit(1);
  }
})();
