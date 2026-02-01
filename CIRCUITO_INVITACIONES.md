# Circuito cerrado: descarga de roles por código

Estructura para que **desde tu pantalla** controles el trabajo de cada integrante: la descarga/acceso de la app por rol depende de un **código que se genera en tu app**; invitas por **enlace por WhatsApp** y el integrante entra **directo en el navegador**.

---

## Flujo

1. **Tú (dueño/admin)** entras a **Control de Acceso** en la app (en el navegador).
2. En la sección **"Invitar equipo por enlace"**:
   - Eliges el **rol** (Cajero, Inventario, Producción, Gerencia).
   - Pulsas **"Generar enlace"** → se crea un código único en el backend.
   - Se muestra el **enlace** (ej. `https://tu-app.vercel.app/login?invite=ABC12XYZ`).
   - **Copiar** o **Enviar por WhatsApp** → se abre WhatsApp con el mensaje y el enlace ya escrito.
3. **El integrante** recibe el mensaje por WhatsApp, abre el enlace **en el navegador** (no hace falta descargar otra app).
4. En la pantalla de **Login** aparece el código rellenado; pone nombre, usuario y contraseña y se registra.
5. Queda **con ese rol** en la app (Cajero, Inventario, etc.) y tú ves en la lista de invitaciones que ese código está **Usado** (y por quién, si indicó nombre).

Así se cierra el circuito: tú generas el código, lo repartes por WhatsApp, y desde la misma pantalla ves qué enlaces están pendientes y cuáles ya se usaron.

---

## Dónde está implementado

| Parte | Ubicación |
|-------|-----------|
| **Backend (códigos)** | `backend/routes/invites.js` – tabla `role_invites`, endpoints: crear, listar, validar, usar, revocar |
| **API** | `frontend/src/services/api.js` – objeto `invites` (create, list, validate, use, revoke) |
| **Pantalla dueño** | `frontend/src/pages/AccessControl.jsx` – sección "Invitar equipo por enlace" (`InviteTeamSection.jsx`) |
| **Entrada del integrante** | `frontend/src/pages/Login.jsx` – `?invite=CODE` en la URL; registro con rol según código |
| **Registro y marcar usado** | `frontend/src/context/AuthContext.jsx` – `registerWithInvite`: valida código por API (o local), crea usuario con ese rol, marca código como usado en API |

---

## Backend

- **POST /api/invites** – Body: `{ role }`. Crea invitación, devuelve `{ invite: { code, role, status, created_at } }`.
- **GET /api/invites** – Lista todas las invitaciones (para que el dueño vea pendientes/usados).
- **GET /api/invites/validate?code=XXX** – Público. Devuelve `{ valid, role }` o `{ valid: false, message }`.
- **POST /api/invites/use** – Body: `{ code, used_by }`. Marca el código como usado (para que en tu pantalla aparezca "Usado por …").
- **PATCH /api/invites/:code/revoke** – Revoca un código pendiente (ya no se puede usar).

La app se usa **directo en el navegador**; el "enlace de descarga" es simplemente la URL de la app con `?invite=CODE`.

---

## Sin backend

Si el backend no está conectado, en Control de Acceso se muestra un aviso: "Descarga de roles por enlace requiere que el backend esté conectado". El registro por código **local** (invitaciones guardadas solo en el dispositivo) sigue funcionando si ya existía ese flujo; el circuito cerrado con lista de invitaciones y "Usado por" necesita backend.
