<div align="center">

<img src="docs/altair logo.png" width="72" alt="Altair logo">

# Altair Lang

**Un lenguaje de programación compilado a C nativo, con servidor HTTP,
jobs, sesiones y storage tiers integrados directamente en la sintaxis.**

[![License: MIT](https://img.shields.io/badge/license-MIT-e8b34d.svg)](LICENSE)
[![Platform: Windows](https://img.shields.io/badge/platform-Windows%2010%2F11-blue.svg)](#instalación)
[![Version](https://img.shields.io/badge/version-1.6.5vC-ff6a3d.svg)](ALTAIR_GUIDE.md)

[**Descargar Altair**](https://github.com/victios7/altair/releases/latest) ·
[Sitio web](https://victios7.github.io/Altair/) ·
[Guía del lenguaje](ALTAIR_GUIDE.md) ·
[Ejemplos](examples)

</div>

---

## ¿Qué es Altair?

Altair es un lenguaje de programación **estáticamente compilado y orientado a
expresiones** que transpila a C mediante su propio compilador, `altairc`.
Cada programa `.at` se convierte en un binario nativo sin dependencias en
tiempo de ejecución.

```
.at source → lexer → parser → sema → codegen → .c → gcc → binario
```

A partir de la versión 1.6.5vC, Altair incluye una capa completa de servidor
HTTP, scheduler de tareas, gestión de sesiones y configuración por variables
de entorno, todo declarado con la sintaxis propia del lenguaje — sin
frameworks externos.

```altair
listen 8080;
    route "GET" "/health";
        respond.json("ok")
    break
break
```

## Características

| | |
|---|---|
| 🗄️ **Storage tiers** | Cada variable declara dónde vive: `ram`, `disk`, `cache` o `temp`, con expiración y prioridad. |
| 🌐 **Servidor HTTP nativo** | `listen` y `route` declaran endpoints con middleware y rate limiting integrados. |
| 🔐 **Sesiones y config** | Sesiones con TTL y variables de entorno tipadas vía `session` y `config`. |
| ⏱️ **Jobs programados** | Tareas recurrentes con `job … every`. |
| 📊 **Salud y métricas** | Endpoints `/health` y `/metrics` compatibles con Prometheus en una línea. |
| ⚙️ **Binario nativo** | Todo compila a un único `.exe` sin runtime que instalar. |

Consulta la [guía completa del lenguaje](ALTAIR_GUIDE.md) para la referencia
de tipos, control de flujo, clases, snapshots y el resto de la sintaxis.

## Instalación

Altair se distribuye como instalador para Windows (10/11, 64-bit).

1. Descarga `Altair-Setup.exe` desde la página de
   [**Releases**](https://github.com/victios7/altair/releases/latest).
2. Ejecútalo y acepta permisos de administrador (necesarios para añadir
   `altairc` al `PATH` del sistema).
3. Abre **Altair Terminal** desde el acceso directo del escritorio, o una
   terminal normal, y comprueba la instalación:

   ```bash
   altairc --version
   ```

El instalador incluye el compilador, la terminal de Altair, el toolchain
`mingw64` necesario para generar el binario final, e íconos y accesos
directos — no hace falta instalar nada más.

## Uso rápido

```bash
# Compilar un programa
altairc hola.at -o hola

# Ejecutarlo
./hola

# Generar esta misma guía del lenguaje en tu carpeta actual
altairc guide
```

Prueba el ejemplo de servidor incluido en [`examples/servidor.at`](examples/servidor.at):

```bash
altairc examples/servidor.at -o servidor
API_SECRET=mysecret PORT=3000 ./servidor
curl http://localhost:3000/health
```

## Estructura del repositorio

```
altair/
├── docs/                 # Sitio web (GitHub Pages) — altair.github.io/altair
│   ├── index.html
│   ├── ALTAIR_LOGO.ico
│   ├── robots.txt
│   └── sitemap.xml
├── examples/             # Programas .at de ejemplo
│   ├── hola.at
│   └── servidor.at
├── ALTAIR_GUIDE.md        # Referencia completa del lenguaje (generada por `altairc guide`)
├── LICENSE
└── README.md
```

Los binarios (`altairc.exe`, `altair-terminal.exe`, `Altair-Setup.exe`) **no
se versionan en el repositorio** — se publican en la sección de
[Releases](https://github.com/victios7/altair/releases) para no inflar el
historial de git con archivos binarios.

## Contribuir

Las incidencias y propuestas de mejora son bienvenidas a través de
[Issues](https://github.com/victios7/altair/issues). Si quieres proponer
cambios al compilador o a la guía del lenguaje, abre un Pull Request.

## Licencia

Altair se distribuye bajo licencia [MIT](LICENSE).
