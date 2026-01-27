let pagina = 1;

async function carregarAlunos() {
    const busca = document.getElementById("input-busca").value;
    const inicio = document.getElementById("filtro-inicio").value;
    const fim = document.getElementById("filtro-fim").value;

    let periodo = "";
    if (inicio && fim) periodo = `${inicio},${fim}`;

    const req = await fetch(`/api/alunos?page=${pagina}&limit=10&busca=${busca}&periodo=${periodo}`);
    const data = await req.json();

    const tbody = document.getElementById("lista-alunos");
    tbody.innerHTML = "";

    data.alunos.forEach(a => {
        const qr = "/" + a.qr_path;

        tbody.innerHTML += `
        <tr class="border-b hover:bg-gray-50">
            <td class="p-3">${a.id}</td>
            <td class="p-3 font-bold">${a.nome_aluno}</td>
            <td class="p-3">${a.data_inicio} → ${a.data_fim}</td>

            <td class="p-3">
                <a href="${qr}" target="_blank"
                   class="text-blue-600 underline">
                   Ver QR
                </a>
            </td>

            <td class="p-3 text-right space-x-2">

                <!-- BOTÃO CERTIFICADO -->
                <a href="/certificado/${a.id}"
                   class="inline-block px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                   📄 Certificado
                </a>

                <!-- BOTÃO IMPRIMIR -->
                <a href="/imprimir/${a.id}"
                   class="inline-block px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                   🖨️ Imprimir
                </a>

            </td>
        </tr>
        `;
    });

    gerarPaginacao(data.page, data.pages);
}

function gerarPaginacao(atual, total) {
    const pag = document.getElementById("paginacao");
    pag.innerHTML = "";

    for (let i = 1; i <= total; i++) {
        pag.innerHTML += `
            <button onclick="irPara(${i})"
                class="px-3 py-2 rounded
                ${i === atual
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-300 hover:bg-gray-400'}">
                ${i}
            </button>
        `;
    }
}

function irPara(num) {
    pagina = num;
    carregarAlunos();
}

document.getElementById("btn-filtrar").onclick = () => {
    pagina = 1;
    carregarAlunos();
};

document.getElementById("input-busca").onkeyup = () => {
    pagina = 1;
    carregarAlunos();
};

carregarAlunos();
