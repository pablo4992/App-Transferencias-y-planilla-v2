// ==========================================
// CONFIGURACIÓN (Tu URL real de Apps Script)
// ==========================================
const API_URL = "https://script.google.com/macros/s/AKfycbz6BnmK3C5fA6LOvWiiBg2uDx5LWO70ILmVvvOuY3DSZM2b_TOcHLMIdfzCqkY2_jq1/exec";

// ==========================================================================
// BASE DE DATOS COMPLETA DE CHOFERES (Revisá y sumá los que falten acá abajo)
// ==========================================================================
const CHOFERES_DB = {
 "C1": "GUZMAN DIEGO NORBERTO", "C2": "CARO MAXIMILIANO ALBERTO", "C3": "RICAPA PAREDES JOSE ANTONIO",
  "C4": "AVALOS GOMEZ RODRIGO SEBASTIAN", "C5": "OYOLA GASTON AGUSTIN", "C6": "LUJAN LUCAS",
  "C7": "JUAREZ LUIS ENRIQUE", "C8": "MOLINA JORGE GABRIEL", "C9": "RAFAELLI DIEGO DANIEL",
  "C10": "SUAREZ TOBIAS EMIR", "C11": "MARTINEZ PEREZ JORGE LEANDRO", "C251": "GONZALEZ CECILIA GUADALUPE",
  "C252": "BELEN EMILIANO AGUSTIN", "C253": "GUIRAO LUIS ANTONIO", "C254": "JUNCOS LUIS EZEQUIEL",
  "C255": "ROMANO RODRIGO ERNESTO", "C256": "IRIARTE MAURO ALEJANDRO", "C257": "CANELO PABLO FERNANDO",
  "C258": "NIETO GUSTAVO ATILIO", "C259": "GUEVARA ENRIQUE LEONARDO", "C260": "PALLOTI DUILIO",
  "C261": "ROMANO MARTIN", "C262": "TALAVERA ADRIAN ISMAEL"
};

// ==========================================
// ESTADO LOCAL DE LA APLICACIÓN
// ==========================================
let lastImageData = null;
let lastOriginalFile = null;
let isSubmitting = false;

window.addEventListener("load", () => {
  const id = localStorage.getItem("chofer_id");
  const nombre = localStorage.getItem("chofer_nombre");
  if (id && nombre) {
    mostrarFormulario(nombre);
  } else {
    mostrarLogin();
  }
});

// ==========================================
// INTERFAZ DE USUARIO (UI)
// ==========================================
function mostrarLogin() {
  document.getElementById("mainCard").innerHTML = `
    <h1>Identificación</h1>
    <label>ID Chofer</label>
    <input id="idInput" type="text" style="text-transform:uppercase" placeholder="Ej: C1">
    <button class="btn" id="loginBtn" type="button">Ingresar</button>
    <div id="msg"></div>
  `;

  document.getElementById("loginBtn").addEventListener("click", entrar);
  document.getElementById("idInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") entrar();
  });
}

function mostrarFormulario(nombre) {
  document.getElementById("mainCard").innerHTML = `
    <h1>Hola, ${escapeHtml(nombre)}</h1>

    <div class="row">
      <div>
        <label>Cód. Cliente</label>
        <input id="codigoCliente" type="text" inputmode="numeric" placeholder="Ej: 12345">
      </div>
      <div>
        <label>Nro Camión</label>
        <input id="field" type="text" inputmode="numeric" placeholder="Ej: 25">
      </div>
    </div>

    <div class="row">
      <div>
        <label>Fecha</label>
        <input id="fechaTransferencia" type="date">
      </div>
      <div>
        <label>Foto</label>
        <input type="file" id="fileGaleria" class="hidden" accept="image/*">
        <input type="file" id="fileCamara" class="hidden" accept="image/*" capture="environment">

        <div style="display:flex; justify-content:space-between;">
          <button class="btn-split" type="button" id="btnGaleria">📂 Galería</button>
          <button class="btn-split" type="button" id="btnCamara">📸 Cámara</button>
        </div>

        <div class="preview-box">
          <img id="previewImg" class="hidden" alt="Vista previa">
          <div class="preview-note" id="fotoStatus">Sin imagen seleccionada</div>
        </div>
      </div>
    </div>

    <div>
      <label>Observaciones</label>
      <textarea id="observaciones" placeholder="Escribe aquí cualquier comentario"></textarea>
    </div>

    <button id="sendBtn" class="btn" type="button">Enviar Registro</button>
    <div id="msg"></div>

    <center>
      <button class="btn-out" id="logoutBtn" type="button">Cerrar sesión</button>
    </center>
  `;

  const hoy = new Date();
  document.getElementById("fechaTransferencia").value = hoy.toISOString().split("T")[0];

  document.getElementById("btnGaleria").addEventListener("click", () => document.getElementById("fileGaleria").click());
  document.getElementById("btnCamara").addEventListener("click", () => document.getElementById("fileCamara").click());

  document.getElementById("fileGaleria").addEventListener("change", previewFile);
  document.getElementById("fileCamara").addEventListener("change", previewFile);
  document.getElementById("sendBtn").addEventListener("click", submit);
  document.getElementById("logoutBtn").addEventListener("click", logout);
}

function setMessage(type, text, extraHtml = "") {
  const msg = document.getElementById("msg");
  if (msg) msg.innerHTML = `<div class="${type}">${text}${extraHtml}</div>`;
}

function escapeHtml(text) {
  return String(text).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function entrar() {
  const input = document.getElementById("idInput");
  const btn = document.getElementById("loginBtn");
  const id = input.value.trim().toUpperCase();

  if (!id) {
    setMessage("err", "⚠️ Ingresa tu ID");
    return;
  }

  btn.disabled = true;
  setMessage("ok", "⏳ Validando chofer...");

  // Validación local instantánea usando el listado completo de choferes
  if (CHOFERES_DB[id]) {
    localStorage.setItem("chofer_id", id);
    localStorage.setItem("chofer_nombre", CHOFERES_DB[id]);
    mostrarFormulario(CHOFERES_DB[id]);
  } else {
    setMessage("err", "❌ ID de chofer no registrado en el sistema");
    btn.disabled = false;
  }
}

function logout() {
  localStorage.clear();
  lastImageData = null;
  lastOriginalFile = null;
  isSubmitting = false;
  mostrarLogin();
}

// ==========================================
// TRATAMIENTO DE IMAGEN LOCAL
// ==========================================
function previewFile(e) {
  const input = e.target;
  if (!input.files || input.files.length === 0) return;

  const file = input.files[0];
  const fotoStatus = document.getElementById("fotoStatus");
  const previewImg = document.getElementById("previewImg");

  lastOriginalFile = file;
  const reader = new FileReader();

  reader.onload = (ev) => {
    lastImageData = ev.target.result;
    previewImg.src = ev.target.result;
    previewImg.classList.remove("hidden");
    fotoStatus.textContent = file.name;
    setMessage("ok", "📸 Imagen lista para subir");
  };
  reader.readAsDataURL(file);
}

async function comprimirImagenABase64(file) {
  return new Promise((resolve) => {
    if (!file) return resolve("");
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX_WIDTH = 1280;
        const scale = Math.min(1, MAX_WIDTH / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ==========================================
// ENVÍO DE DATOS DIRECTO A APPS SCRIPT
// ==========================================
async function submit() {
  if (isSubmitting) return;

  const btn = document.getElementById("sendBtn");
  const codigoCliente = document.getElementById("codigoCliente").value.trim();
  const nroCamion = document.getElementById("field").value.trim();
  const fechaTransferencia = document.getElementById("fechaTransferencia").value;
  const observaciones = document.getElementById("observaciones").value.trim();

  const galeria = document.getElementById("fileGaleria");
  const camara = document.getElementById("fileCamara");
  const file = (galeria.files && galeria.files[0]) || (camara.files && camara.files[0]) || null;

  if (!codigoCliente || !nroCamion || !fechaTransferencia) {
    setMessage("err", "⚠️ Completa los campos obligatorios");
    return;
  }

  isSubmitting = true;
  btn.disabled = true;
  setMessage("ok", "⏳ Preparando envío...");

  try {
    let imagenBase64 = "";
    if (file) {
      setMessage("ok", "⏳ Optimizando peso de la imagen...");
      imagenBase64 = await comprimirImagenABase64(file);
    }

    setMessage("ok", "⏳ Transmitiendo datos a Google Sheets...");

    const payload = {
      choferId: localStorage.getItem("chofer_id"),
      choferNombre: localStorage.getItem("chofer_nombre"), // Usado por .gs para crear e identificar la pestaña
      codigoCliente,
      field: nroCamion,
      fechaTransferencia,
      observaciones,
      imagenBase64: imagenBase64
    };

    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!data.success) throw new Error(data.error || "Fallo el procesamiento interno");

    setMessage("ok", "✅ ¡Registro subido y organizado de forma exitosa!");

    // Reseteo del formulario tras procesar
    document.getElementById("codigoCliente").value = "";
    document.getElementById("field").value = "";
    document.getElementById("observaciones").value = "";
    document.getElementById("previewImg").classList.add("hidden");
    document.getElementById("fotoStatus").textContent = "Sin imagen seleccionada";

  } catch (err) {
    setMessage("err", `❌ Error al guardar: ${escapeHtml(String(err.message || err))}`);
  } finally {
    isSubmitting = false;
    btn.disabled = false;
  }
}
