<div align="center">

<img src="docs/altair logo.png" width="72" alt="Altair logo">

# Altair Lang

**Lenguaje compilado a C nativo, con storage tiers, HTTP, jobs y sesiones en la propia sintaxis.**

[![License: MIT](https://img.shields.io/badge/license-MIT-e8b34d.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-blue.svg)](#instalación)
[![Version](https://img.shields.io/badge/version-1.7vB-ff6a3d.svg)](ALTAIR_GUIDE.md)

[**Descargar**](https://github.com/victios7/altair/releases/latest) ·
[Sitio web](https://victios7.github.io/Altair/) ·
[Guía del lenguaje](ALTAIR_GUIDE.md) ·
[Ejemplos](examples)

</div>

---

## ¿Qué es Altair?

Altair es un lenguaje **estáticamente compilado y orientado a expresiones**. Su compilador, `altairc`, transpila cada programa `.at` a C y luego a un **binario nativo** sin runtime externo que instalar.

```
.at → lexer → parser → sema → codegen → .c → gcc → binario
```

No es un lenguaje de scripting interpretado ni un framework encima de otro runtime: el resultado es un ejecutable normal de Windows, Linux o macOS.

A partir de la serie 1.6.5, Altair incorpora de forma nativa:

- servidor HTTP (`listen` / `route`)
- jobs programados
- sesiones con TTL
- configuración por entorno
- **storage tiers** (`ram`, `cache`, `disk`, `temp`) con `orbit`, `prefer`, `weight` y migración

Todo eso se declara en la sintaxis del lenguaje, sin frameworks externos.

```altair
listen 8080;
    route "GET" "/health";
        respond.json("ok")
    break
break
```

## Por qué existe

Altair ocupa un punto **medio-bajo**:

| Más control que Python/JS | Más cómodo que C puro |
|---|---|
| `p#` y memoria explícita | tipos, strings, listas y ficheros fáciles |
| storage tiers y `orbit` | HTTP, jobs y sesiones en la sintaxis |
| un solo binario nativo | sin gestionar `malloc` a mano para lo cotidiano |

Sirve tanto para herramientas de sistemas (compiladores, ensambladores, CLIs) como para servicios pequeños autocontenidos.

## Características

| | |
|---|---|
| **Storage tiers** | Cada valor puede vivir en `ram`, `cache`, `disk` o `temp`. Con `orbit`, `prefer`, `weight` y migración entre niveles. |
| **Memoria explícita** | Bloques contiguos con `p#` (`alloc`, `p#read`, `p#write`) cuando hace falta control fino. |
| **Servidor HTTP nativo** | `listen` y `route` con middleware y rate limiting integrados. |
| **Sesiones y config** | Sesiones con TTL y variables de entorno tipadas (`session`, `config`). |
| **Jobs programados** | Tareas recurrentes con `job … every`. |
| **Salud y métricas** | `/health` y `/metrics` (estilo Prometheus) en pocas líneas. |
| **Binario nativo** | Un único ejecutable por programa. Windows, Linux y macOS. |

Referencia completa de tipos, control de flujo, clases, snapshots y el resto de la sintaxis: [ALTAIR_GUIDE.md](ALTAIR_GUIDE.md).

## Instalación

Paquetes oficiales en [**Releases**](https://github.com/victios7/altair/releases/latest).

### Windows (10/11, 64-bit)

1. Descarga `Altair-Setup-<version>.exe`
2. Ejecútalo (permisos de administrador para añadir `altairc` al `PATH`)
3. Abre **Altair Terminal** o cualquier terminal y comprueba:

```bash
altairc --version
```

El instalador trae compilador, terminal, toolchain `mingw64` e iconos. No hace falta instalar nada más.

### Linux (`.deb`)

```bash
sudo dpkg -i altair_<version>_amd64.deb
altairc --version
```

También puedes usar `altair-linux-<version>.tar.gz` si prefieres el binario suelto.

### macOS (Apple Silicon)

1. Descarga `Altair-Setup-<version>.pkg`
2. Ábrelo (clic derecho → **Abrir** si macOS avisa de desarrollador no verificado)
3. Sigue el asistente (`altairc` queda en `/usr/local/bin`)
4. Comprueba:

```bash
altairc --version
```

Alternativa: `altair-macos-<version>.tar.gz`.

## Uso rápido

```bash
# Compilar
altairc hola.at -o hola

# Ejecutar
./hola          # Linux / macOS
hola.exe        # Windows

# Generar la guía del lenguaje en el directorio actual
altairc guide
```

Ejemplo de servidor incluido:

```bash
altairc examples/servidor.at -o servidor
API_SECRET=mysecret PORT=3000 ./servidor
curl http://localhost:3000/health
```

## Ecosistema alrededor de Altair

El propio lenguaje se usa para construir herramientas no triviales, por ejemplo:

- **R0** — ensamblador / compilador a C escrito en Altair (lexer, dos pasadas, emisión de C)
- proyectos de experimentación (motores pequeños, CLIs, demos de storage y red)

Eso refleja el objetivo del diseño: suficiente control de bajo nivel para sistemas, con sintaxis usable para programas reales.



## Contribuir

Issues y propuestas: [Issues](https://github.com/victios7/altair/issues).  
Cambios al compilador o a la guía: Pull Request bienvenido.

## Licencia

[MIT](LICENSE).

## Nota del autor

Para ser transparente: usé IA como ayuda puntual (logo y, a veces, revisión de texto) mientras desarrollaba Altair. **El lenguaje, el compilador, el runtime, la arquitectura y la implementación son trabajo mío.** La IA fue una herramienta, no la autora del proyecto.

Si quieres criticar el diseño o el código, adelante: mira lo que hace el proyecto y juzga eso. Preferible a descartar el trabajo de una persona real sin revisarlo.
