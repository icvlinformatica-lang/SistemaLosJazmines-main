// Verificación temporal: login como cocina y fetch de la página de producción.
// Nunca imprime el PIN.
const base = "http://localhost:3000"

const loginRes = await fetch(`${base}/api/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ perfilId: "cocina", pin: process.env.PIN_COCINA }),
})
const loginJson = await loginRes.json().catch(() => ({}))
console.log("[verify] login status:", loginRes.status, "ok:", loginJson.ok)

// Emitir SOLO el token de sesión efímero (no el PIN ni el quickToken) para
// poder inyectarlo en el navegador de verificación.
console.log("SESSION_TOKEN=" + (loginJson.sessionToken || ""))
