// ==========================
// CONFIGURACIÓN
// ==========================
const API_URL = "https://script.google.com/macros/s/AKfycby2F3b0oKcvDGGvfs-6pJGS5kbQwoFbtitifW99nCproWSsIuB99mKfRrHXjGU1GBXQHg/exec";

// ==========================
// ESTADO
// ==========================
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

// ==========================
// UI
// ==========================
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

    <button id="sendBtn" class="btn" type="button">Subir y Guardar</button>
    <div id="msg"></div>

    <center>
      <button class="btn-out" id="logoutBtn" type="button">Cerrar sesión</button>
    </center>
  `;

  const hoy = new Date();
  document.getElementById("fechaTransferencia").value = hoy.toISOString().split("T")[0];

  document.getElementById("btnGaleria").addEventListener("click", () => {
    document.getElementById("fileGaleria").click();
  });

  document.getElementById("btnCamara").addEventListener("click", () => {
    document.getElementById("fileCamara").click();
  });

  document.getElementById("fileGaleria").addEventListener("change", previewFile);
  document.getElementById("fileCamara").addEventListener("change", previewFile);
  document.getElementById("sendBtn").addEventListener("click", submit);
  document.getElementById("logoutBtn").addEventListener("click", logout);
}

function setMessage(type, text, extraHtml = "") {
  const msg = document.getElementById("msg");
  msg.innerHTML = `<div class="${type}">${text}${extraHtml}</div>`;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ==========================
// LOGIN / VALIDACIÓN (Tu lógica original por API)
// ==========================
async function entrar() {
  const input = document.getElementById("idInput");
  const btn = document.getElementById("loginBtn");
  const id = input.value.trim().toUpperCase();

  if (!id) {
    setMessage("err", "⚠️ Ingresa tu ID");
    return;
  }

  btn.disabled = true;
  setMessage("ok", "⏳ Validando...");

  try {
    const url = `${API_URL}?action=validateChofer&id=${encodeURIComponent(id)}`;
    const res = await fetch(url, { method: "GET" });
    const data = await res.json();

    if (data.success) {
      localStorage.setItem("chofer_id", data.id);
      localStorage.setItem("chofer_nombre", data.nombre); // Guarda el nombre real (Ej: "Diego Guzman")
      mostrarFormulario(data.nombre);
    } else {
      setMessage("err", `❌ ${escapeHtml(data.error || "ID no válido")}`);
      btn.disabled = false;
    }
  } catch (err) {
    setMessage("err", `❌ Error de conexión: ${escapeHtml(String(err))}`);
    btn.disabled = false;
  }
}

function logout() {
  localStorage.removeItem("chofer_id");
  localStorage.removeItem("chofer_nombre");
  lastImageData = null;
  lastOriginalFile = null;
  isSubmitting = false;
  mostrarLogin();
}

// ==========================
// IMAGEN Y COMPRESIÓN LOCAL
// ==========================
function previewFile(e) {
  const input = e.target;
  if (!input.files || input.files.length === 0) return; // Evita limpiar si cancelan la captura en el celu

  const file = input.files[0];
  const fotoStatus = document.getElementById("fotoStatus");
  const previewImg = document.getElementById("previewImg");

  lastOriginalFile = file;

  const reader = new FileReader();

  reader.onload = (ev) => {
    lastImageData = ev.target.result;
    previewImg.src = ev.target.result;
    previewImg.classList.remove("hidden");
    fotoStatus.textContent = `Imagen lista: ${file.name || "foto"}`;
    setMessage("ok", "✅ Imagen lista para subir");
  };

  reader.onerror = () => {
    lastImageData = null;
    lastOriginalFile = null;
    previewImg.src = "";
    previewImg.classList.add("hidden");
    fotoStatus.textContent = "No se pudo leer la imagen";
    setMessage("err", "❌ Error al leer la imagen");
  };

  reader.readAsDataURL(file);
}

function descargarCopia() {
  if (!lastOriginalFile) {
    setMessage("err", "❌ No hay una foto original disponible para descargar");
    return;
  }

  const url = URL.createObjectURL(lastOriginalFile);
  const link = document.createElement("a");
  link.href = url;

  let ext = "jpg";
  if (lastOriginalFile.type === "image/png") ext = "png";
  if (lastOriginalFile.type === "image/webp") ext = "webp";

  link.download = lastOriginalFile.name || `registro_foto_${Date.now()}.${ext}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Comprime la imagen usando Canvas y devuelve un DataURL en Base64
async function comprimirImagenABase64(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve("");
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("No se pudo cargar la imagen"));
      img.onload = () => {
        const MAX_WIDTH = 1280;
        const scale = Math.min(1, MAX_WIDTH / img.width);

        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Extrae directamente el string Base64 con calidad optimizada
        const base64Data = canvas.toDataURL("image/jpeg", 0.72);
        resolve(base64Data);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ==========================
// ENVÍO DEL FORMULARIO
// ==========================
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
  setMessage("ok", "⏳ Procesando...");

  try {
    let imagenBase64 = "";

    if (file) {
      setMessage("ok", "⏳ Procesando imagen...");
      imagenBase64 = await comprimirImagenABase64(file);
    }

    setMessage("ok", "⏳ Guardando registro en Google...");

    // Armamos el payload incluyendo el nombre del chofer para la separación de pestañas
    const payload = {
      choferId: localStorage.getItem("chofer_id"),
      choferNombre: localStorage.getItem("chofer_nombre"), // Envía "Diego Guzman", "Pablo Vergara", etc.
      codigoCliente,
      field: nroCamion,
      fechaTransferencia,
      observaciones,
      imagenBase64: imagenBase64 // Reemplaza por completo el flujo de Cloudinary
    };

    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!data.success) {
      throw new Error(data.error || "No se pudo guardar el registro");
    }

    const extraHtml = lastImageData
      ? `<br><button class="btn-download" type="button" id="downloadBtn">⬇️ Descargar foto original</button>`
      : "";

    setMessage("ok", "✅ ¡Guardado correctamente!", extraHtml);

    const downloadBtn = document.getElementById("downloadBtn");
    if (downloadBtn) {
      downloadBtn.addEventListener("click", descargarCopia);
    }

    // Limpieza de campos de entrada
    document.getElementById("codigoCliente").value = "";
    document.getElementById("field").value = "";
    document.getElementById("observaciones").value = "";
    document.getElementById("fileGaleria").value = "";
    document.getElementById("fileCamara").value = "";
    document.getElementById("previewImg").src = "";
    document.getElementById("previewImg").classList.add("hidden");
    document.getElementById("fotoStatus").textContent = "Sin imagen seleccionada";

    const hoy = new Date();
    document.getElementById("fechaTransferencia").value = hoy.toISOString().split("T")[0];

    lastOriginalFile = file;

  } catch (err) {
    setMessage("err", `❌ ${escapeHtml(String(err.message || err))}`);
  } finally {
    isSubmitting = false;
    btn.disabled = false;
  }
}
