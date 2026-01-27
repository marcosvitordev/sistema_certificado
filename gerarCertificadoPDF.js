const fs = require("fs");
const path = require("path");
const { PDFDocument, rgb } = require("pdf-lib");
const fontkit = require("@pdf-lib/fontkit");

function formatarData(data) {
    return new Date(data).toLocaleDateString("pt-BR");
}

async function gerarCertificadoPDF(aluno) {
    const modeloPath = path.join(__dirname, "models", "certificado_modelo.pdf");

    if (!fs.existsSync(modeloPath)) {
        throw new Error("Modelo de certificado não encontrado");
    }

    const pdfBytes = fs.readFileSync(modeloPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // 👉 necessário para fontes externas
    pdfDoc.registerFontkit(fontkit);

    // =========================
    // CARREGAR FONTES
    // =========================
    const openSansBytes = fs.readFileSync(
        path.join(__dirname, "fonts", "OpenSans-Regular.ttf")
    );

    const libraSerifBytes = fs.readFileSync(
        path.join(__dirname, "fonts", "LibraSerifModern-Regular.otf")
    );

    const openSans = await pdfDoc.embedFont(openSansBytes);
    const libraSerif = await pdfDoc.embedFont(libraSerifBytes);

    const page = pdfDoc.getPages()[0];

    // =========================
    // NOME DO ALUNO (Open Sans)
    // =========================
    const xInicio = 200;
    const xFim = 800;
    const tamanhoFonteNome = 31;

    // largura do texto com base na fonte
    const larguraTexto = openSans.widthOfTextAtSize(
        aluno.nome_aluno,
        tamanhoFonteNome
    );

    // calcula o centro do intervalo
    const centroIntervalo = (xInicio + xFim) / 2;

    // calcula o X final centralizado
    const xCentralizado = centroIntervalo - (larguraTexto / 2);

    page.drawText(aluno.nome_aluno, {
        x: xCentralizado,
        y: 340, // mantém o Y que você já ajustou
        size: tamanhoFonteNome,
        font: openSans,
        color: rgb(0, 0, 0),
    });

    // =========================
    // DATA DE CONCLUSÃO (Libra Serif Modern)
    // =========================
    page.drawText(
        `${formatarData(aluno.data_fim)}`,
        {
            x: 520,
            y: 292,
            size: 19,
            font: libraSerif,
            color: rgb(0, 0, 0),
        }
    );

    // =========================
    // CÓDIGO DE AUTENTICIDADE (Open Sans)
    // =========================
    page.drawText(
        `Código de Autenticidade: ${aluno.codigo_identificacao}`,
        {
            x: 605,
            y: 30,
            size: 6,
            font: openSans,
            color: rgb(0, 0, 0),
            align: "right",
        }
    );

    page.drawText(
        "utilize o QR Code no site qrcodeces.netlify.app",
        {
            x: 665,
            y: 24,
            size: 6,
            font: openSans,
            color: rgb(0, 0, 0),
        }
    );

    // =========================
    // QR CODE
    // =========================
    const qrPath = path.join(__dirname, aluno.qr_path);

    if (!fs.existsSync(qrPath)) {
        throw new Error("QR Code não encontrado");
    }

    const qrBytes = fs.readFileSync(qrPath);
    const qrImage = await pdfDoc.embedPng(qrBytes);

    page.drawImage(qrImage, {
        x: 616,
        y: 37,
        width: 80,
        height: 80,
    });

    // =========================
    // SALVAR PDF
    // =========================
    const outputDir = path.join(__dirname, "certificados");
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

    const pdfPath = path.join(outputDir, `certificado_${aluno.nome_aluno}.pdf`);
    fs.writeFileSync(pdfPath, await pdfDoc.save());

    return pdfPath;
}

module.exports = gerarCertificadoPDF;
