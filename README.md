<div align="center">
<img src="docs/altair logo.png" width="72" alt="Altair logo">

# Altair Lang

**Lenguaje estáticamente tipado y compilado a código nativo mediante C.**

Sintaxis clara, almacenamiento configurable y control explícito de memoria.

[![License: MIT](https://img.shields.io/badge/license-MIT-e8b34d.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-blue.svg)](#instalación)
[![Version](https://img.shields.io/badge/version-1.8.5-ff6a3d.svg)](ALTAIR_GUIDE.md)

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

**AltairC 1.8.5** es la versión estable actual.

**ABCM** es un compilador en  desarrollo que incorpora compilación nativa

La versión 1.8.5 ha logrado un gran rendimiento de media y un gran rendimiento numérico
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

Cuando se necesita un control más directo sobre memoria, se pueden utilizar bloques contiguos mediante `p#` o resgistros del harware mediante `reg&`

```altair
p#node buf = alloc(1024)
p#write(buf, 0, 42)
numeric x = p#read(buf, 0)
log p#bytes(buf)
p#free(buf)
reg&64 rax = 1
reg&read(rax)
reg&free(rax)
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

Altair 1.8.5 incluye una serie de optimizaciones del compilador y runtime que hacen que el rendimiento nativo sea muy bueno, por ejemplo:
```Altair
altair.doc;
    name = "lim280b"
    version = "1.0"
create altair.doc

numeric n = 280000000000 ram
numeric i = 0 ram
numeric sum = 0 ram
numeric x = 1 ram

while i < n;
    sum = sum + i
    x = x + sum
    i = i + 1
break

log sum
log x
```
comprobado en un sandbox con 2 hilos tardó 109,6 segundos, las proximás versiones(`1.8.5vB` `1.9` tienen mejor rendimiento y capa optimizadora)



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

### Problema conocido en 1.8.5

Durante la instalación puede ocurrid que la carpeta mingw 64 no se genera por favor si pasa eso descarga el zip mingw64 de releases descomprímela
y copia la carpeta dentro de la carpeta principal de altair

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


---

# Ejemplos

Puedes encontrar ejemplos del lenguaje en:

[**examples/**](examples)

También puedes consultar la referencia(próximamente será actualizada) completa en:

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
