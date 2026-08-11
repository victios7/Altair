<div align="center">
<img src="docs/altair logo.png" width="72" alt="Altair logo">

# Altair Lang

**Lenguaje compilado a C nativo: storage tiers, sintaxis clara y control de memoria cuando hace falta.**

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

Altair es un lenguaje **estáticamente compilado, imperativo, estructurado y fuertemente tipado**. Su compilador, `altairc`, transpila cada programa `.at` a C y luego a un **binario nativo** — sin runtime externo que instalar.

```
.at → lexer → parser → sema → codegen → .c → gcc → binario
```

Está pensado en un punto **medio-bajo**: sintaxis legible y tipos cómodos, con la opción de bajar a memoria explícita y decidir **dónde vive cada dato**.

No hay recolector de basura. La memoria se gestiona con una **política de almacenamiento** por variable y con `release` cuando quieres liberar a mano.

## Lo esencial del lenguaje

### Storage tiers

Cada variable declara **un solo** modo de almacenamiento. Los modos no se combinan entre sí.

| Modo | Uso típico |
|------|------------|
| `ram` | Rápido, volátil (memoria del proceso) |
| `disk` | Persistente en fichero |
| `cache` | Persistente con TTL opcional |
| `temp` | Temporal; se limpia al hacer `release` |
| `orbit` | Varios estados posibles; el cambio es explícito con `migrate` |
| `prefer` | Lista ordenada; el runtime elige un nivel al crear la variable |

```altair
numeric contador = 0 ram
text log_path = "app.log" disk
list cola = [] cache
text secreto = "token" temp
```

Cualificadores opcionales (no son otro modo de storage):

```altair
numeric score = 0 ram weight 10
text token = "" cache expire 30m
```

### `orbit` y `migrate`

`orbit` declara los estados posibles. El cambio de nivel se hace a mano con `migrate`.

```altair
numeric datos = 0 orbit
1 "activo" ram
2 "archivo" disk
3 "frio" cache
break

migrate datos as "archivo"
migrate datos as 1
```

### `prefer`

```altair
text sesion = "" prefer;
 ram
 cache,
 disk
break
```

El runtime elige un nivel de la lista al crear la variable.

### Sintaxis sencilla

Variables, funciones, control de flujo y texto sin ceremonia:

```altair
altair.doc;
    name = "Hola"
    version = "1.0"
create altair.doc

fun saludo -> text text nombre;
    return "Hola, " + nombre
break

numeric i = 0 ram
while i < 3;
    log saludo("mundo") + " #" + i
    i = i + 1
break

release i
```

### Tipos y datos

Tipos básicos claros (`numeric`, `text`, `bool`, `list`, `file`) y composición con listas y texto. Cuando hace falta control fino, bloques contiguos con **`p#`**:

```altair
p#node buf = alloc(1024)
p#write(buf, 0, 42)
numeric x = p#read(buf, 0)
log p#bytes(buf)
p#free(buf)
```

### Compilado a nativo

Un `.at` produce un ejecutable normal en Windows, Linux o macOS. Ideal para CLIs, herramientas y programas que quieres distribuir como un solo binario.

---

## En la práctica: R0 (ensamblador escrito en Altair)

R0 es un compilador de ensamblador → C implementado **enteramente en Altair**: lexer, directivas, dos pasadas y emisión de C. Sirve como demostración de que el lenguaje aguanta programas largos y de sistemas.

**Lexer y tokens**

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

**Emisión de operaciones al C generado**

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

**Uso**

```bash
altairc r0.at -o r0
./r0 programa.r0 salida.c
gcc -o programa salida.c
./programa
```

R0 muestra el lado “herramienta de sistemas”: parsers, tablas de símbolos, generación de código y ficheros, con la misma sintaxis que un script corto.

---

## Otras capacidades

Más allá del núcleo del lenguaje, Altair incluye piezas opcionales en la sintaxis:

| | |
|---|---|
| **HTTP** | `listen` / `route`, útil para APIs pequeñas autocontenidas |
| **Jobs** | tareas con `job … every` |
| **Sesiones y config** | TTL y variables de entorno tipadas |
| **Métricas** | endpoints de salud al estilo Prometheus |
| **Gráficos** | `link graphics raylib` |

Ejemplo mínimo de servidor (opcional):

```altair
listen 8080;
    route "GET" "/health";
        respond.json("ok")
    break
break
```

La referencia completa está en [ALTAIR_GUIDE.md](ALTAIR_GUIDE.md).

## Instalación

Paquetes en [**Releases**](https://github.com/victios7/altair/releases/latest).

### Windows (10/11, 64-bit)

1. Descarga `Altair-Setup-<version>.exe`
2. Ejecútalo (admin para el `PATH`)
3. Comprueba:

```bash
altairc --version
```

Incluye compilador, terminal y `mingw64`.

### Linux

```bash
sudo dpkg -i altair_<version>_amd64.deb
altairc --version
```

También: `altair-linux-<version>.tar.gz`.

### macOS (Apple Silicon)

1. `Altair-Setup-<version>.pkg` (clic derecho → Abrir si hace falta)
2. `altairc` en `/usr/local/bin`
3. `altairc --version`

También: `altair-macos-<version>.tar.gz`.

## Uso rápido

```bash
altairc hola.at -o hola
./hola          # Linux / macOS
hola.exe        # Windows

altairc guide   # genera la guía en el directorio actual
```

## Contribuir

[Issues](https://github.com/victios7/altair/issues) y Pull Requests bienvenidos.

## Licencia

[MIT](LICENSE).

## Nota del autor

Usé IA como ayuda puntual (logo y, a veces, revisión de texto). **El lenguaje, el compilador, el runtime, la arquitectura y la implementación son trabajo mío.** La IA fue una herramienta, no la autora del proyecto.

Si quieres criticar el diseño o el código, mira lo que hace el proyecto y juzga eso.
