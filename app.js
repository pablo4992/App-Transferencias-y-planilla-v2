// ==========================================
// CONFIGURACIÓN DIRECTA DE GOOGLE WORKSPACE
// ==========================================
// IDs extraídos de los enlaces provistos por el usuario
const SPREADSHEET_ID = "1ZkZia8ubyKpKZyElHld6Eq6yYKzkLsf2wUdduX37jwE";
const CARPETA_DRIVE_ID = "1E7Qs2_n2-EQReFIJnSB2cS3OFxIZA9_K";

// ==========================================
// ESTADO LOCAL DE LA APLICACIÓN
// ==========================================
let lastImageData = null;
let lastOriginalFile = null;
let isSubmitting = false;

window.addEventListener("load", () => {
  // Simulación de base de datos local de choferes para la validación inicial (ID -> Nombre)
  // Nota: Al no usar Apps Script, validamos localmente o mediante Sheets API leyendo una pestaña de usuarios.
  if (!localStorage.getItem("choferes_db")) {
    const choferesIniciales = {
      "C1": "Juan Pérez",
      "C2": "Carlos Rodríguez",
      "C3": "Marcos Gómez",
      "PABLO": "Pablo Vergara"
    };
    localStorage.setItem("choferes_db", JSON.stringify(choferesIniciales));
  }

  const id = localStorage.getItem("chofer_id");
  const nombre = localStorage.getItem("chofer_nombre");
  if (id && nombre) {
    mostrarFormulario(nombre);
  } else {
    mostrarLogin();
  }
});

// ==========================================
// GESTIÓN DE CREDENCIALES (OAUTH2 TOKEN)
// ==========================================
async function obtenerAccessTokenSeguro() {
  /**
   * IMPORTANTE SEGURO:
   * Para interactuar con las APIs de Google de forma directa, se requiere un Token de acceso Bearer.
   * Debes obtener este token mediante Google Identity Services (OAuth2) pidiendo permiso al chofer,
   * o recuperándolo desde un backend propio extremadamente ligero que no exponga tus claves maestras.
   * * Reemplaza el string de abajo con tu mecanismo de obtención de Token dinámico.
   */
  const tokenProvisorio = "TU_TOKEN_OAUTH2_ACTUAL_DE_GOOGLE"; 
  return tokenProvisorio;
}

// ==========================================
// INTERFAZ DE USUARIO (UI)
// ==========================================
function mostrarLogin() {
  document.getElementById("mainCard").innerHTML = `
    <h1>Identificación</h1>
    <label>ID Chofer</label>
    <input id="idInput" type="text" style="text-transform:uppercase" placeholder="Ej: C1 o PABLO">
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

    <button id="sendBtn" class="btn" type="button">Subir a Google Directo</button>
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
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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
  setMessage("ok", "⏳ Validando Chofer...");

  const db = JSON.parse(localStorage.getItem("choferes_db"));
  
  if (db && db[id]) {
    localStorage.setItem("chofer_id", id);
    localStorage.setItem("chofer_nombre", db[id]);
    mostrarFormulario(db[id]);
  } else {
    setMessage("err", "❌ ID de chofer no válido en el sistema local");
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

// ==========================================
// MANEJO Y COMPRESIÓN DE IMÁGENES LOCAL
// ==========================================
function previewFile(e) {
  const input = e.target;
  if (!input.files || input.files.length === 0) return; // Evita limpiar si se cancela la captura

  const file = input.files[0];
  const fotoStatus = document.getElementById("fotoStatus");
  const previewImg = document.getElementById("previewImg");

  lastOriginalFile = file;
  const reader = new FileReader();

  reader.onload = (ev) => {
    lastImageData = ev.target.result;
    previewImg.src = ev.target.result;
    previewImg.classList.remove("hidden");
    fotoStatus.textContent = `Imagen lista: ${file.name || "foto.jpg"}`;
    setMessage("ok", "✅ Imagen procesada y lista");
  };

  reader.onerror = () => {
    lastImageData = null;
    lastOriginalFile = null;
    previewImg.src = "";
    previewImg.classList.add("hidden");
    fotoStatus.textContent = "Error al leer la imagen";
    setMessage("err", "❌ No se pudo procesar el archivo");
  };

  reader.readAsDataURL(file);
}

function descargarCopia() {
  if (!lastOriginalFile) {
    setMessage("err", "❌ No hay foto original para descargar");
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

async function comprimirImagenABlob(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Error de lectura"));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Error al cargar objeto imagen"));
      img.onload = () => {
        const MAX_WIDTH = 1280;
        const scale = Math.min(1, MAX_WIDTH / img.width);

        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        canvas.toBlob((blob) => {
          if (!blob) return reject(new Error("Fallo en compresión Canvas"));
          resolve(blob);
        }, "image/jpeg", 0.72);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ==========================================
// INTEGRACIÓN NATIVA CON GOOGLE DRIVE API v3
// ==========================================
async function subirImagenAGoogleDrive(fileBlob, choferId, token) {
  if (!fileBlob) return "";

  const metadata = {
    name: `registro_${choferId}_${Date.now()}.jpg`,
    parents: [CARPETA_DRIVE_ID],
    mimeType: "image/jpeg"
  };

  const formData = new FormData();
  formData.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  formData.append("file", fileBlob);

  // Endpoint Multipart para subidas de archivos con metadatos asociados
  const url = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink";
  
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Drive API Error: ${errText}`);
  }

  const data = await res.json();
  
  // Opcional: Hacer que el archivo sea visible para cualquiera con el enlace de forma explícita
  try {
    await fetch(`https://www.googleapis.com/drive/v3/files/${data.id}/permissions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ role: "reader", type: "anyone" })
    });
  } catch (e) {
    console.warn("No se pudieron cambiar los permisos del archivo de forma pública, pero se subió correctamente.");
  }

  return data.webViewLink || `https://drive.google.com/open?id=${data.id}`;
}

// ==========================================
// INTEGRACIÓN CON GOOGLE SHEETS API v4 (Pestañas Dinámicas)
// ==========================================
async function asegurarPestañaYGuardarDatos(sheetTitle, filaDatos, token) {
  // 1. Obtener los metadatos de las hojas actuales en el documento para verificar si la pestaña ya existe
  const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?fields=sheets.properties`;
  const metaRes = await fetch(metaUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  if (!metaRes.ok) throw new Error("No se pudo leer la estructura del Google Sheet.");
  const spreadsheetData = await metaRes.json();
  
  const pestañaExiste = spreadsheetData.sheets.some(s => s.properties.title.toUpperCase() === sheetTitle.toUpperCase());

  // 2. Si la pestaña no existe, se crea dinámicamente agregando una nueva y seteando la fila de cabecera
  if (!pestañaExiste) {
    setMessage("ok", `⏳ Creando pestaña nueva para el chofer: "${sheetTitle}"...`);
    
    const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`;
    const addSheetRequest = {
      requests: [{
        addSheet: {
          properties: { title: sheetTitle }
        }
      }]
    };

    const addRes = await fetch(batchUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(addSheetRequest)
    });

    if (!addRes.ok) throw new Error(`Error al crear la pestaña del chofer: ${sheetTitle}`);

    // Insertar fila de cabecera estructural por primera vez en la hoja nueva
    const headerRange = `${sheetTitle}!A1:F1`;
    const headerValues = [["Fecha Registro", "ID Chofer", "Código Cliente", "Nro Camión", "Observaciones", "Enlace Foto Drive"]];
    
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${headerRange}?valueInputOption=USER_ENTERED`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ values: headerValues })
    });
  }

  // 3. Hacer el Append nativo de los datos en la pestaña específica del chofer
  setMessage("ok", `⏳ Escribiendo datos en la pestaña "${sheetTitle}"...`);
  const appendRange = `${sheetTitle}!A:F`;
  const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${appendRange}:append?valueInputOption=USER_ENTERED`;

  const appendRes = await fetch(appendUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ values: [filaDatos] })
  });

  if (!appendRes.ok) {
    const errText = await appendRes.text();
    throw new Error(`Sheets API Append Error: ${errText}`);
  }
}

// ==========================================
// PROCESAMIENTO Y ENVÍO DEL FORMULARIO
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
  setMessage("ok", "⏳ Autenticando con Google Services...");

  try {
    // Obtenemos el token OAuth2 necesario para las peticiones REST directas
    const token = await obtenerAccessTokenSeguro();
    if (!token || token.includes("TU_TOKEN")) {
      throw new Error("Configuración de autenticación inválida o falta configurar el Token OAuth2.");
    }

    let urlImagenDrive = "Sin foto asignada";

    if (file) {
      setMessage("ok", "⏳ Comprimiendo imagen en dispositivo...");
      const archivoComprimido = await comprimirImagenABlob(file);
      
      setMessage("ok", "⏳ Subiendo archivo directo a Carpeta de Google Drive...");
      const choferId = localStorage.getItem("chofer_id");
      urlImagenDrive = await subirImagenAGoogleDrive(archivoComprimido, choferId, token);
    }

    // Armamos la estructura exacta que se va a guardar en las columnas del Google Sheet
    const choferNombre = localStorage.getItem("chofer_nombre");
    const choferId = localStorage.getItem("chofer_id");
    
    const filaDatos = [
      fechaTransferencia,
      choferId,
      codigoCliente,
      nroCamion,
      observaciones,
      urlImagenDrive
    ];

    // Llamamos a la lógica encargada de buscar/crear la pestaña y guardar los datos
    // Usamos el nombre del chofer (ej: "Juan Pérez") como título para separar sus pestañas
    await asegurarPestañaYGuardarDatos(choferNombre, filaDatos, token);

    // Mensaje de éxito con opción de recuperar copia de seguridad local de la foto
    const extraHtml = lastImageData
      ? `<br><button class="btn-download" type="button" id="downloadBtn">⬇️ Descargar foto original</button>`
      : "";

    setMessage("ok", "✅ ¡Guardado directamente en Google Sheets y Drive con éxito!", extraHtml);

    const downloadBtn = document.getElementById("downloadBtn");
    if (downloadBtn) {
      downloadBtn.addEventListener("click", descargarCopia);
    }

    // Reset completo del formulario
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
    setMessage("err", `❌ Error en el proceso: ${escapeHtml(String(err.message || err))}`);
  } finally {
    isSubmitting = false;
    btn.disabled = false;
  }
}