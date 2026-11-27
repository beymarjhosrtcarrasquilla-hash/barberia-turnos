# ✂️ Fran Barbe (Cali, Colombia) — Sistema Web de Turnos & Agenda

Aplicación web moderna, profesional y ultraligera para reserva y gestión de turnos de una barbería. Diseñada bajo estándares web nativos para garantizar un rendimiento óptimo en equipos con hardware modesto (4 GB de RAM y procesadores Core 2 Duo), sin dependencias pesadas de compilación.

---

## 📌 Rutas del Proyecto

| Ruta | URL Local | Descripción |
| :--- | :--- | :--- |
| **Vista Clientes** | `http://localhost:3000/index.html` | Página pública para compartir por enlace o redes sociales. Catálogo de servicios, selección interactiva de fechas y horarios, formulario de contacto, prevención de doble reserva y comprobante con botón directo a WhatsApp y archivo de calendario (`.ics`). |
| **Portal Barbero** | `http://localhost:3000/barbero.html` | Panel privado protegido por PIN (`1234`). Agenda del día, métricas de ingresos y clientes, cambio de estados (Completado / Cancelado / Reactivado) y registro rápido de turnos manuales. |
| **Comparador Simultáneo** | `http://localhost:3000/comparador.html` | Visualizador multidispositivo que muestra en paralelo la vista de cliente en celular, la vista del barbero en celular y la vista de escritorio. |
| **Acceso Móvil (Tailscale)** | `http://100.70.78.107:3000` | Acceso directo desde tu celular a través de la red privada Tailscale. |

---

## 🚀 Cómo Ejecutar la Aplicación

### Método 1: Servidor Ultraligero Integrado (Recomendado)
Abre una terminal en la carpeta del proyecto y ejecuta:
```bash
node dev-server.mjs
# o mediante npm:
npm start
```
* **Características:** Consume menos de 20 MB de memoria RAM, incluye **Live Reload automático** (la página se actualiza en el navegador apenas guardas cambios en cualquier archivo) y escucha en `0.0.0.0` para acceso inmediato desde tu celular mediante Tailscale.

### Método 2: Extensión Live Preview de VS Code
Como ya tienes instalada la extensión oficial `ms-vscode.live-server` en tu VS Code:
1. Abre la carpeta del proyecto en VS Code:
   ```bash
   code "C:\Users\beyma\Projects\barberia-turnos"
   ```
2. Haz clic derecho sobre `index.html`, `barbero.html` o `comparador.html`.
3. Selecciona **"Live Preview: Show Preview"** para visualizarlo dentro del mismo VS Code o en tu navegador predeterminado.

---

## 📱 Instalación como PWA (Acceso Directo en Celular)

La aplicación cuenta con manifiesto web (`manifest.json`) y Service Worker (`sw.js`). Tanto los clientes como el barbero pueden instalarla sin pasar por tiendas de aplicaciones:
- **En Android (Chrome/Edge):** Toca los tres puntos `⋮` y selecciona **"Agregar a la pantalla principal"** o **"Instalar aplicación"**.
- **En iOS (Safari):** Toca el botón Compartir y elige **"Agregar al inicio"**.

---

## 📂 Estructura de Archivos

```
barberia-turnos/
├── index.html          # Vista pública de reserva para clientes
├── barbero.html        # Panel de administración y agenda privada
├── comparador.html     # Entorno de visualización paralela multidispositivo
├── manifest.json       # Manifiesto para instalación como PWA
├── sw.js               # Service Worker para funcionamiento offline
├── dev-server.mjs      # Servidor de desarrollo con SSE Live Reload (0 dependencias)
├── package.json        # Configuración y comandos de arranque
├── README.md           # Documentación técnica y de despliegue
├── js/
│   ├── app.js          # Lógica interactiva de clientes (slots, validación, ics)
│   ├── barbero.js      # Lógica de gestión de turnos, métricas y filtros
│   └── storage.js      # Capa de datos desacoplada y validación anti-colisiones
└── styles/
    └── main.css        # Hoja de estilos premium (paleta carbón y oro, responsive)
```

---

## ☁️ Publicación y Persistencia en Producción

### Estado Actual:
El proyecto almacena las reservas localmente mediante la capa abstracta `storage.js` (`localStorage`), con la agenda inicial vacía (sin turnos de demostración).

### Pasos para Poner en Producción (100% Gratuito):
1. **Frontend Público:** Se puede publicar con 1 clic en **GitHub Pages**, **Cloudflare Pages** o **Vercel Hobby** (costo $0 permanente).
2. **Base de Datos Compartida en la Nube:** Para que los turnos que un cliente reserve desde su casa se sincronicen en tiempo real con el celular del barbero en el local:
   - **Google Cloud Firestore (Plan Spark / Gratuito):** Permite hasta 50.000 lecturas y 20.000 escrituras por día sin costo, más que suficiente para una barbería mediana.
   - Solo se debe reemplazar la implementación interna de los métodos en `js/storage.js` por las llamadas a la SDK de Firestore sin modificar ninguna interfaz de usuario.
