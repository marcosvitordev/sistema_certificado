const fs = require("fs/promises");
const path = require("path");
const { PDFDocument, rgb } = require("pdf-lib");
const fontkit = require("@pdf-lib/fontkit");
const QRCode = require("qrcode");

function formatDateBR(value) {
  const [year, month, day] = String(value).split("-");
  return `${day}/${month}/${year}`;
}

function shrinkToFit(font, text, maxSize, minSize, maxWidth) {
  let size = maxSize;
  while (size > minSize && font.widthOfTextAtSize(text, size) > maxWidth) size -= 0.5;
  return size;
}

async function gerarCertificadoPDF(aluno, validationUrl) {
  const [templateBytes, openSansBytes, libraSerifBytes, qrBytes] = await Promise.all([
    fs.readFile(path.join(__dirname, "models", "certificado_modelo.pdf")),
    fs.readFile(path.join(__dirname, "fonts", "OpenSans-Regular.ttf")),
    fs.readFile(path.join(__dirname, "fonts", "LibraSerifModern-Regular.otf")),
    QRCode.toBuffer(validationUrl, { errorCorrectionLevel: "M", margin: 2, width: 320 }),
  ]);
  const pdfDoc = await PDFDocument.load(templateBytes);
  pdfDoc.registerFontkit(fontkit);
  const [openSans, libraSerif, qrImage] = await Promise.all([
    pdfDoc.embedFont(openSansBytes),
    pdfDoc.embedFont(libraSerifBytes),
    pdfDoc.embedPng(qrBytes),
  ]);
  const page = pdfDoc.getPages()[0];
  const name = String(aluno.nome_aluno);
  const nameSize = shrinkToFit(openSans, name, 31, 17, 600);
  const nameX = 500 - openSans.widthOfTextAtSize(name, nameSize) / 2;
  page.drawText(name, { x: nameX, y: 340, size: nameSize, font: openSans, color: rgb(0, 0, 0) });
  page.drawText(formatDateBR(aluno.data_fim), { x: 520, y: 292, size: 19, font: libraSerif, color: rgb(0, 0, 0) });
  page.drawText(`Código de autenticidade: ${aluno.codigo_identificacao}`, {
    x: 580, y: 30, size: 6, font: openSans, color: rgb(0, 0, 0),
  });
  page.drawText("Escaneie o QR Code para validar este certificado", {
    x: 605, y: 24, size: 6, font: openSans, color: rgb(0, 0, 0),
  });
  page.drawImage(qrImage, { x: 616, y: 37, width: 80, height: 80 });
  pdfDoc.setTitle(`Certificado - ${name}`);
  pdfDoc.setSubject("Certificado com validação de autenticidade");
  pdfDoc.setProducer("Sistema de Certificados CES");
  return Buffer.from(await pdfDoc.save());
}

module.exports = gerarCertificadoPDF;
