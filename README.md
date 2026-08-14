<div align="center">
<img src="docs/altair logo.png" width="72" alt="Altair logo">

# Altair Lang

**Lenguaje estáticamente tipado y compilado a código nativo mediante C.**

Sintaxis clara, almacenamiento configurable y control explícito de memoria.

[![License: MIT](https://img.shields.io/badge/license-MIT-e8b34d.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-blue.svg)](#instalación)
[![Version](https://img.shields.io/badge/version-1.7vC-ff6a3d.svg)](ALTAIR_GUIDE.md)

[**Descargar**](https://github.com/victios7/altair/releases/latest) ·
[Sitio web](https://victios7.github.io/Altair/) ·
[Guía del lenguaje](ALTAIR_GUIDE.md) ·
[Ejemplos](examples) ·
[Benchmarks](https://github.com/victios7/Altair/tree/main/benchmark)

</div>

---

## ¿Qué es Altair?

Altair es un lenguaje **estáticamente compilado, imperativo, estructurado y fuertemente tipado**.

El compilador `altairc` transforma los programas `.at` en C y posteriormente en un **binario nativo**. El programa generado no necesita una máquina virtual como JVM o CLR para ejecutarse.

```text
.at → lexer → parser → sema → codegen → .c → compilador C → binario nativo
```

Altair busca combinar una sintaxis de alto nivel con mecanismos de bajo nivel para almacenamiento y gestión explícita de memoria.

No utiliza recolección de basura. La memoria puede gestionarse mediante políticas de almacenamiento por variable y mediante `release` cuando se necesita liberar memoria explícitamente.

## Estado del proyecto

**Altair 1.7vC** es la versión estable actual.

**Altair 1.7.5vB** es una versión de desarrollo/pre-release que incorpora importantes optimizaciones del compilador y runtime.

La versión 1.7.5vB se encuentra actualmente en proceso de estabilización y portabilidad. Algunas plataformas todavía presentan problemas de empaquetado o compatibilidad.

Para consultar los benchmarks, el runner y los datos de resultados:

[**Benchmark suite**](https://github.com/victios7/Altair/tree/main/benchmark)

---

# Características principales

## Storage tiers

Cada variable declara un modo de almacenamiento.

| Modo | Uso |
|------|-----|
| `ram` | Memoria rápida y volátil del proceso |
| `disk` | Almacenamiento persistente en fichero |
| `cache` | Almacenamiento persistente con TTL opcional |
| `temp` | Almacenamiento temporal |
| `orbit` | Varios estados de almacenamiento seleccionables |
| `prefer` | Lista ordenada de preferencias de almacenamiento |

Ejemplo:

```altair
numeric contador = 0 ram
text log_path = "app.log" disk
list cola = [] cache
text secreto = "token" temp
```

Los modos pueden utilizar cualificadores adicionales:

```altair
numeric score = 0 ram weight 10
text token = "" cache expire 30m
```

---

## `orbit` y `migrate`

`orbit` permite declarar diferentes estados de almacenamiento. El cambio entre estados se realiza explícitamente mediante `migrate`.

```altair
numeric datos = 0 orbit
1 "activo" ram
2 "archivo" disk
3 "frio" cache
break

migrate datos as "archivo"
migrate datos as 1
```

---

## `prefer`

`prefer` permite especificar una lista ordenada de preferencias de almacenamiento.

```altair
text sesion = "" prefer;
 1 = ram
 2 = cache,
 3 = disk
break
```

El runtime selecciona un nivel de la lista al crear la variable.

---

## Sintaxis

Altair está diseñado para mantener una sintaxis directa para variables, funciones, control de flujo y texto.

```altair
altair.doc;
    name = "Hola"
    version = "1.0"
create altair.doc

fun saludo text text nombre;
    return "Hola, " + nombre
break

numeric i = 0 ram
while i < 3;
    log saludo("mundo") + " #" + i
    i = i + 1
break

release i
```

---

## Tipos y datos

Altair incluye tipos básicos como:

- `numeric`
- `text`
- `bool`
- `list`
- `file`

Cuando se necesita un control más directo sobre memoria, se pueden utilizar bloques contiguos mediante `p#`.

```altair
p#node buf = alloc(1024)
p#write(buf, 0, 42)
numeric x = p#read(buf, 0)
log p#bytes(buf)
p#free(buf)
```

---

# Compilación nativa

Un programa `.at` se transforma en C y posteriormente en un ejecutable nativo.

```text
Altair source
     │
     ▼
   Lexer
     │
     ▼
   Parser
     │
     ▼
Semantic analysis
     │
     ▼
  Code generation
     │
     ▼
 Generated C
     │
     ▼
   C compiler
     │
     ▼
Native executable
```

Esto permite utilizar Altair para CLIs, herramientas de sistemas y programas que se distribuyen como ejecutables nativos.

---

# R0: ensamblador escrito en Altair

R0 es un compilador de ensamblador → C implementado **enteramente en Altair**.

Incluye componentes como:

- lexer y tokenización
- directivas
- registros y operandos
- tablas de símbolos
- procesamiento en dos pasadas
- generación de código C
- lectura y escritura de archivos

R0 sirve como demostración de que Altair puede utilizarse para construir herramientas de sistemas relativamente complejas utilizando el propio lenguaje.

### Lexer y tokens

```altair
fun next_token;
    skip_ws()
    if POS >= LEN;
        set_tok("eof", "")
        return
    break

    text c = peekc()

    if is_digit(c);
        text n = ""
        while is_digit(peekc());
            n = n + advc()
        break
        set_tok("num", n)
        return
    break

    if is_alpha(c);
        text id = ""
        while is_alnum(peekc());
            id = id + advc()
        break
        set_tok("id", id)
        return
    break

    / ... strings, registros, comas, corchetes
break
```

### Emisión de operaciones al C generado

```altair
fun emit_binop text mnem, text dst, text src;
    text d = operand_cexpr(dst, 2)
    text s = operand_cexpr(src, 2)

    if mnem == "add";
        emit(d + "=(" + d + "+" + s + ")&0xffff;\n")
    elif mnem == "sub";
        emit(d + "=(" + d + "-" + s + ")&0xffff;\n")
    elif mnem == "xor";
        emit(d + "=(" + d + "^" + s + ")&0xffff;\n")
    break

    emit("FLAG_Z=((" + d + ")==0);FLAG_N=(((int16_t)(" + d + "))<0);\n")
break
```

### Uso

```bash
altairc r0.at -o r0
./r0 programa.r0 salida.c
gcc -o programa salida.c
./programa
```

---

# Otras capacidades

Altair incluye funcionalidades adicionales para determinados tipos de aplicaciones.

| Característica | Descripción |
|---|---|
| **HTTP** | `listen` / `route` para servidores y APIs pequeñas |
| **Jobs** | Tareas mediante `job … every` |
| **Sesiones y configuración** | TTL y variables de entorno tipadas |
| **Métricas** | Endpoints de salud al estilo Prometheus |
| **Gráficos** | Integración opcional mediante `link graphics raylib` |

### Servidor HTTP mínimo

```altair
listen 8080;
    route "GET" "/health";
        respond.json("ok")
    break
break
```

La referencia completa está disponible en [ALTAIR_GUIDE.md](ALTAIR_GUIDE.md).

---

# Rendimiento

Altair 1.7.5vB incluye una serie de optimizaciones del compilador y runtime.

El benchmark utiliza múltiples ejecuciones y reporta medianas de wall-clock. Los valores de RSS representan el pico de memoria residente cuando está disponible.

## Resultados principales

| Carga | Compilación mediana | Ejecución mediana | Ejecución p95 | RSS pico |
|---|---:|---:|---:|---:|
| `numeric_loop` | 1540.633 ms | **2.757 ms** | 2.974 ms | 148 KB |
| `function_calls` | 1642.815 ms | **2.731 ms** | 3.551 ms | 144 KB |
| `recursion_fib` | 1574.723 ms | 4.029 ms | 12.1 ms | 1636 KB |
| `list_append_index` | 1544.376 ms | 23.008 ms | 24.753 ms | 15120 KB |
| `bitwise_loop` | 1501.680 ms | **2.628 ms** | 2.677 ms | 156 KB |
| `string_concat` | 1494.690 ms | **2.479 ms** | 2.482 ms | 156 KB |
| `file_io` | 1368.273 ms | **2.478 ms** | 2.483 ms | 144 KB |
| `numeric_literal_precision` | 1339.361 ms | **2.501 ms** | 2.595 ms | 156 KB |

**Correctitud: 8/8 cargas pasan.**

## Comparación con C y Python

| Carga | C | Python | Altair 1.7.5vB |
|---|---:|---:|---:|
| `numeric_loop` | 2.484 ms | 48.619 ms | **2.757 ms** |
| `recursion_fib` | 2.638 ms | 70.075 ms | **4.029 ms** |

En `numeric_loop`, Altair queda aproximadamente un **11 % por encima de C** en esta medición y es aproximadamente **17,6× más rápido que Python**.

Estos resultados son benchmarks concretos y no constituyen un ranking universal entre lenguajes.

### Benchmarks completos

Los benchmarks completos, el runner Python y los resultados estructurados están disponibles en:

[**github.com/victios7/Altair/tree/main/benchmark**](https://github.com/victios7/Altair/tree/main/benchmark)

La carpeta contiene el runner `.py` y los archivos `latest.md` / `latest.json` para consultar y comparar los resultados de las distintas ejecuciones, incluyendo las variantes con procesos/agentes y sin ellos.

---

# Instalación

Los paquetes disponibles se encuentran en [**Releases**](https://github.com/victios7/altair/releases/latest).

## Windows

Windows 10/11, 64-bit.

1. Descarga `Altair-Setup-<version>.exe`.
2. Ejecuta el instalador.
3. Si se solicita, utiliza permisos de administrador para configurar el `PATH`.
4. Comprueba la instalación:

```powershell
altairc --version
```

El paquete incluye el compilador, terminal y MinGW64.

### Problema conocido en 1.7.5vB

Durante la instalación puede parecer que el proceso se detiene al llegar al paso relacionado con la eliminación de MinGW64.

Si ocurre:

1. Abre el **Administrador de tareas** con `Ctrl + Shift + Esc`.
2. Busca el proceso **Altair Set Up**.
3. Finaliza el proceso.
4. Altair quedará instalado y podrá utilizarse normalmente.

---

## Linux

Paquetes disponibles:

```bash
sudo dpkg -i altair_<version>_amd64.deb
altairc --version
```

También puede utilizarse:

```text
altair-linux-<version>.tar.gz
```

> **Nota:** el soporte Linux de Altair 1.7.5vB está temporalmente en proceso de corrección debido a problemas de empaquetado y compatibilidad. Se publicará una actualización cuando estén solucionados.

---

## macOS

Para Apple Silicon:

1. Descarga `Altair-Setup-<version>.pkg`.
2. Abre el paquete. Si macOS lo bloquea, utiliza **clic derecho → Abrir**.
3. Comprueba:

```bash
altairc --version
```

También puede utilizarse:

```text
altair-macos-<version>.tar.gz
```

---

# Uso rápido

Compilar un programa:

```bash
altairc hola.at -o hola
```

Ejecutarlo en Linux/macOS:

```bash
./hola
```

En Windows:

```powershell
.\hola.exe
```

Generar la guía:

```bash
altairc guide
```

---

# Ejemplos

Puedes encontrar ejemplos del lenguaje en:

[**examples/**](examples)

También puedes consultar la referencia completa en:

[**ALTAIR_GUIDE.md**](ALTAIR_GUIDE.md)

---

# Contribuir

Issues y Pull Requests son bienvenidos.

[**Issues**](https://github.com/victios7/altair/issues)

---

# Licencia

Altair se distribuye bajo la licencia **MIT**.

Consulta [LICENSE](LICENSE).

---

# Nota del autor

Usé IA como ayuda puntual para determinadas tareas, como el logo y ocasionalmente la revisión de texto.

**El lenguaje, el compilador, el runtime, la arquitectura y la implementación son trabajo mío.**

La IA fue una herramienta de apoyo, no la autora del proyecto.

Si quieres criticar el diseño o el código, mira lo que hace el proyecto y juzga eso.
