# Altair Language Reference — v1.6.5vC

> Referencia completa del lenguaje Altair. Generada a partir del compilador real `altairc v1.6.5vC`.

---

## Tabla de contenidos

1. [Visión general](#1-visión-general)
2. [Pipeline del compilador](#2-pipeline-del-compilador)
3. [Estructura del programa](#3-estructura-del-programa)
4. [Variables y almacenamiento](#4-variables-y-almacenamiento)
5. [Tipos](#5-tipos)
6. [Operadores y expresiones](#6-operadores-y-expresiones)
7. [Control de flujo](#7-control-de-flujo)
8. [Funciones](#8-funciones)
9. [Clases y objetos](#9-clases-y-objetos)
10. [Listas](#10-listas)
11. [Manejo de errores](#11-manejo-de-errores)
12. [Snapshots](#12-snapshots)
13. [Choose (aleatorio ponderado)](#13-choose-aleatorio-ponderado)
14. [Introspección](#14-introspección)
15. [Token (valor de un solo uso)](#15-token-valor-de-un-solo-uso)
16. [Orbit y Prefer](#16-orbit-y-prefer)
17. [Release](#17-release)
18. [Entrada del usuario](#18-entrada-del-usuario)
19. [Servidor HTTP (v1.6.5vB+)](#19-servidor-http-v165vb)
20. [Rutas y handlers](#20-rutas-y-handlers)
21. [Middleware](#21-middleware)
22. [Rate limiting](#22-rate-limiting)
23. [Health checks](#23-health-checks)
24. [Métricas](#24-métricas)
25. [Graceful shutdown](#25-graceful-shutdown)
26. [Sesiones](#26-sesiones)
27. [Config y variables de entorno](#27-config-y-variables-de-entorno)
28. [Pool de base de datos](#28-pool-de-base-de-datos)
29. [Jobs programados](#29-jobs-programados)
30. [Gráficos y UI con Raylib (v1.6.5vC)](#30-gráficos-y-ui-con-raylib-v165vc)
31. [Referencia CLI de altairc](#31-referencia-cli-de-altairc)
32. [Códigos de error](#32-códigos-de-error)
33. [Ejemplo completo de servidor](#33-ejemplo-completo-de-servidor)

---

## 1. Visión general

Altair es un lenguaje **compilado estáticamente y orientado a expresiones** que transpila a C mediante su compilador `altairc`. Cada programa `.at` se convierte en un binario nativo sin dependencias en tiempo de ejecución, salvo las librerías del sistema estándar (`libc`, `libm`, `libpthread`).

**Características principales:**
- Cada variable declara explícitamente dónde vive: `ram`, `disk`, `cache` o `temp`
- Las variables pueden migrar entre tiers de almacenamiento en tiempo de ejecución (`orbit`)
- Servidor HTTP declarado directamente en la sintaxis del lenguaje (`listen`, `route`)
- Gráficos y UI vía Raylib (`link * raylib`, `window`, `loop`, `draw`)
- Memoria gestionada por el runtime (sin `malloc`/`free` manual)
- Soporte Windows, Linux y macOS

---

## 2. Pipeline del compilador

```
archivo.at
  → lexer.c      (tokenización)
  → parser.c     (parser recursivo descendente → AST)
  → sema.c       (análisis semántico, verificación de scopes)
  → codegen.c    (generación de código C)
  → gcc -O2      (compilación a binario nativo)
```

El compilador escribe el C generado a un archivo temporal (`/tmp/altair_<pid>_gen.c`), invoca `gcc -O2` y elimina el temporal. En Windows usa el `mingw64` incluido en el instalador.

Para ver el C generado sin compilar:
```bash
altairc programa.at --emit-c
```

Para ver el número de nodos del AST:
```bash
altairc programa.at --emit-ast
```

---

## 3. Estructura del programa

Todo programa Altair tiene una cabecera opcional y un cuerpo de sentencias.

```altair
altair.doc;
    name = "MiApp"
    version = "1.0"
    author = "Tu Nombre"
create altair.doc

/ Esto es un comentario (línea que empieza con /)

log "Hola desde Altair!"
```

**Campos de la cabecera:** `name`, `version`, `author`

La cabecera va desde `altair.doc;` hasta `create altair.doc`. Todo lo que sigue es el cuerpo del programa.

**Comentarios:** Una `/` al inicio del token (o tras espacio), seguida de espacio o letra, inicia un comentario de línea. Si el token anterior era un valor (número, string, identificador, `)`, `]`), la `/` se interpreta como división.

```altair
/ Esto es un comentario
numeric x = 10 / 2   / Aqui el / del medio es division, el segundo es comentario
```

---

## 4. Variables y almacenamiento

### Declaración

```altair
define <tipo> <nombre> [storage] [calificadores] [= expresión]
```

La palabra clave `define` es **opcional** — puede omitirse:

```altair
/ Con define (estilo completo):
define numeric contador = 0 ram

/ Sin define (estilo abreviado):
numeric contador = 0 ram
text mensaje = "Hola" ram
bool activo = true ram
```

### Tiers de almacenamiento

| Keyword | Comportamiento en runtime |
|---------|--------------------------|
| `ram`   | Memoria del proceso, bloqueada con `mlock` (no swappable). Rápida; se pierde al salir. |
| `disk`  | Almacenamiento persistente en `~/.altair/<nombre-app>/disk/<var>.altv`. Sobrevive reinicios. |
| `cache` | Persiste en `~/.altair/<nombre-app>/cache/<var>.altv` con TTL opcional. Se auto-expira. |
| `temp`  | Memoria del proceso, se pone a cero en `release`. Para datos sensibles. |
| `auto`  | El runtime elige el tier. Equivalente a `ram` si no se especifica nada más. |

```altair
define text usuario disk           / persiste entre ejecuciones
define text token_sesion temp      / se borra al liberar
define text respuesta_api cache expire=30m  / expira en 30 minutos
```

### Calificadores

| Calificador | Ejemplo | Efecto |
|-------------|---------|--------|
| `const` | `define numeric PI const = 3.14159` | No se puede reasignar (lanza ALT0007) |
| `expire=<dur>` | `cache expire=5m` | Auto-expira tras la duración |
| `weight=<n>` | `weight=5` | Hint de prioridad (entero ≥ 0) |

**Duraciones:** `30s` (segundos), `5m` (minutos), `2h` (horas).

### Asignación y asignación compuesta

```altair
nombre = "Alicia"
contador = contador + 1
contador += 10
contador -= 3
contador *= 2
contador /= 4
contador %= 3
lista[0] = "nuevo"
```

---

## 5. Tipos

| Tipo | Descripción | Valor por defecto |
|------|-------------|-------------------|
| `numeric` | Número de punto flotante doble | `0` |
| `text` | Cadena de texto | `""` |
| `bool` | Booleano (`true` / `false`) | `false` |
| `list` | Lista dinámica de valores | `[]` |
| `object` | Instancia de clase | `null` |
| `token` | Valor de un solo uso (se consume al leer) | — |

**Literales:**
```altair
numeric n = 42
numeric pi = 3.14159
text s = "Hola, mundo!"
bool ok = true
list items = ["uno", "dos", "tres"]
list vacia = []
```

**Literales de duración** (se convierten a segundos automáticamente):
```altair
numeric ttl = 30m   / = 1800.0
numeric delay = 2h  / = 7200.0
```

---

## 6. Operadores y expresiones

### Aritméticos
| Operador | Operación |
|----------|-----------|
| `+` | Suma (numérico) o concatenación (texto / listas) |
| `-` | Resta |
| `*` | Multiplicación |
| `/` | División (lanza ALT0010 si divisor es 0) |
| `%` | Módulo (lanza ALT0010 si divisor es 0) |
| `-x` | Negación unaria |

### Comparación
| Operador | Significado |
|----------|-------------|
| `==` | Igualdad |
| `!=` | Desigualdad |
| `<` | Menor que |
| `>` | Mayor que |
| `<=` | Menor o igual |
| `>=` | Mayor o igual |

### Lógicos
| Operador | Significado |
|----------|-------------|
| `and` | Y lógico (también `&&`) |
| `or` | O lógico (también `\|\|`) |
| `!x` | Negación lógica |

### Precedencia (mayor a menor)
1. Unarios: `!`, `-`
2. `*`, `/`, `%`
3. `+`, `-`
4. `<`, `>`, `<=`, `>=`
5. `==`, `!=`
6. `and`
7. `or`

### Acceso a miembros e índices
```altair
objeto.campo
objeto.metodo(args)
lista[0]
lista[i] = valor
```

---

## 7. Control de flujo

### if / elif / else

Todos los bloques se cierran con `break`. La cadena `if/elif/else` comparte **un único `break` final**.

```altair
if puntuacion > 90;
    log "Excelente"
elif puntuacion > 70;
    log "Bien"
else;
    log "Necesita mejorar"
break
```

### while

```altair
define numeric n = 1
while n <= 10;
    log n
    n += 1
break
```

### repeat

```altair
repeat 5 times;
    log "tick"
break

/ O con una expresión:
repeat contador;
    log "iteracion"
break
```

La palabra `times` es opcional.

### forever

Bucle infinito. Usa `exit` para salir.

```altair
forever;
    / hacer algo indefinidamente
    if condicion_salida;
        exit
    break
break
```

### foreach

Itera sobre los elementos de una lista.

```altair
define list colores = ["rojo", "verde", "azul"]
foreach color in colores;
    log color
break
```

La variable iteradora (`color`) se crea automáticamente y se libera al salir del bucle.

### exit

Dentro de un bucle: rompe el bucle (equivale a `break` en C).
Fuera de un bucle: termina el programa limpiamente.

```altair
if error;
    exit
break
```

### wait

Pausa la ejecución durante una duración.

```altair
wait 2s    / espera 2 segundos
wait 500   / espera 500 segundos (número sin sufijo = segundos)
```

---

## 8. Funciones

### Declaración

```altair
fun nombre -> tipo_retorno param_tipo1 param1, param_tipo2 param2;
    / cuerpo
    return expresion
break
```

La flecha `-> tipo_retorno` y los parámetros van en la misma línea que `fun`. El tipo de retorno es **opcional** (si se omite, la función devuelve `void`).

```altair
/ Función sin retorno:
fun saludar text nombre;
    log "Hola, " + nombre
break

/ Función con retorno:
fun sumar -> numeric numeric a, numeric b;
    return a + b
break

/ Función recursiva:
fun factorial -> numeric numeric n;
    if n <= 1;
        return 1
    break
    return n * factorial(n - 1)
break
```

### Llamada

```altair
saludar("Alicia")
define numeric resultado = sumar(3, 4)

/ Llamada sin paréntesis (un argumento):
saludar "Alicia"
```

### Alcance de variables

Las variables declaradas fuera de una función son **globales**. El codegen las busca via `altair_var_lookup` al acceder desde dentro de una función. Esto significa que una función puede leer y modificar variables globales.

---

## 9. Clases y objetos

### Declaración

```altair
class NombreClase;
    / campos con tipo, storage y valor por defecto
    text nombre = "" disk
    numeric puntos = 0 ram
    bool activo = true ram

    / métodos
    fun metodo tipo_param param;
        / aquí 'nombre', 'puntos', 'activo' son campos de la instancia
        puntos += param
    break

    fun obtener -> numeric;
        return puntos
    break
create class
```

### Instanciación

```altair
object jugador = NombreClase() ram
create object NombreClase as jugador   / sintaxis alternativa
```

### Uso

```altair
jugador.nombre = "Alicia"
jugador.metodo(10)
define numeric pts = jugador.obtener()
log jugador.nombre + " tiene " + pts + " puntos"
```

---

## 10. Listas

```altair
define list items = ["a", "b", "c"]

/ Acceso por índice (base 0):
log items[0]      / "a"
items[1] = "X"

/ Métodos:
items.append("d")         / añade al final
items.remove(0)           / elimina por índice (devuelve bool)
items.clear()             / vacía la lista
log items.length          / número de elementos (sin paréntesis también funciona)
log items.length()        / igual

/ Concatenación de listas:
define list total = lista1 + lista2

/ Iterar:
foreach item in items;
    log item
break
```

Los índices fuera de rango lanzan **ALT0013**.

---

## 11. Manejo de errores

```altair
try;
    / código que puede fallar
    define numeric resultado = 10 / 0
break
catch as err;
    / err, err_code, err_message, err_line están disponibles aquí
    log "Error " + err_code + ": " + err_message
    log "Línea: " + err_line
break
```

El nombre del catch (`err`) puede ser cualquier identificador. El runtime crea automáticamente las variables `<nombre>_code`, `<nombre>_message` y `<nombre>_line`.

**Importante:** Los try/catch se pueden anidar hasta 128 niveles.

---

## 12. Snapshots

Un snapshot serializa todas las variables `disk` y `cache` activas a un archivo en `~/.altair/<app>/snap/<nombre>.altsnap`.

```altair
snapshot create "nombre_snapshot"
snapshot restore "nombre_snapshot"
snapshot delete "nombre_snapshot"
```

Útil para guardar/restaurar el estado completo de la aplicación.

---

## 13. Choose (aleatorio ponderado)

Selecciona un valor aleatoriamente según pesos porcentuales. Los pesos deben sumar 100.

```altair
choose resultado;
    50% = opcionA
    30% = opcionB
    20% = opcionC
define

log resultado
```

La variable resultante (`resultado`) es de tipo `text` y contiene el nombre de la opción elegida.

---

## 14. Introspección

Permite consultar información del sistema, del compilador y del programa en tiempo de ejecución.

```altair
/ Sistema:
log system@os         / "windows" | "linux" | "macos"
log system@arch       / "x64" | "x86" | ...
log system@memory     / memoria disponible en bytes
log system@cpu        / número de CPUs

/ Info de una variable específica:
log system@locate(miVariable)   / tier actual: "ram" | "disk" | "cache" | "temp"

/ Compilador:
log compiler@version  / "1.6.5vC"
log compiler@name     / "altairc"

/ Programa:
log program@name      / valor de name en altair.doc
log program@version   / valor de version en altair.doc
log program@author    / valor de author en altair.doc
```

---

## 15. Token (valor de un solo uso)

Un `token` envuelve un valor y sólo puede leerse una vez. Tras la primera lectura queda marcado como `consumed`.

```altair
define token secreto = "clave-efimera" temp

/ Primera lectura: devuelve el valor y lo marca como consumido
log secreto

/ Segunda lectura: devuelve [token:consumed]
log secreto
```

Útil para valores que sólo deben usarse una vez (OTP, nonces, claves temporales).

---

## 16. Orbit y Prefer

### Orbit

Define una variable que puede migrar entre varios tiers de almacenamiento según un estado numerado o nombrado.

```altair
numeric sessionScore = 0 orbit;
    1 = create temp      / estado 1: temporal (inicio de sesión)
    2 = active ram       / estado 2: en memoria (durante el juego)
    3 = inactive cache   / estado 3: en caché (pause)
    4 = finish disk      / estado 4: en disco (fin)
break

/ Migrar por número:
sessionScore migrate 2

/ Migrar por nombre:
sessionScore migrate active
```

**Reglas:** Los números de estado deben ser únicos. La variable comienza en el primer estado declarado.

### Prefer

Define un orden de preferencia de tiers. El runtime elige el primero disponible.

```altair
define text datos prefer ram, cache, disk;
    / Altair intentará primero ram, luego cache, luego disk
```

---

## 17. Release

Libera explícitamente la memoria de una variable y la desregistra del runtime.

```altair
define numeric temporal = 42 ram
/ ... uso ...
release temporal
```

Para variables `temp`, el runtime pone a cero la memoria antes de liberar. `release` es seguro si la variable ya fue liberada (no falla).

---

## 18. Entrada del usuario

Lee una línea de la entrada estándar con un prompt opcional.

```altair
/ Forma larga:
define text nombre = user input "¿Cómo te llamas?" as text
define numeric edad = user input "¿Cuántos años tienes?" as numeric

/ Forma corta (sin define, tipo inferido como text):
text nombre = user input "¿Cómo te llamas?"

/ Forma mínima (sin prompt):
text entrada = input as text
```

---

## 19. Servidor HTTP (v1.6.5vB+)

El servidor HTTP está implementado directamente en el runtime de Altair usando sockets POSIX (sin frameworks externos). Es de **un solo hilo**; cada conexión se atiende secuencialmente.

### Iniciar el servidor

```altair
listen 8080;
    / rutas y configuración aquí
break
```

El puerto puede ser un literal o una variable `numeric`.

```altair
define numeric PUERTO = 3000 ram
listen PUERTO;
    / ...
break
```

---

## 20. Rutas y handlers

```altair
listen 8080;
    route "GET" "/ruta";
        / handler de la ruta
        respond.json("ok")
    break

    route "POST" "/datos";
        define text cuerpo = body()
        define text usuario = header("X-User")
        define text id = param("id")
        respond.json(cuerpo)
    break
break
```

### Métodos disponibles en el handler

| Función | Descripción |
|---------|-------------|
| `body()` | Cuerpo crudo de la petición (text) |
| `header("nombre")` | Valor de una cabecera HTTP |
| `param("nombre")` | Parámetro de query string |
| `respond.json(expr)` | Responde con `Content-Type: application/json` |
| `respond.text(expr)` | Responde con `Content-Type: text/plain` |
| `respond.status(n)` | Establece el código de estado HTTP |
| `stop` | Detiene el procesamiento (útil en middleware) |

```altair
route "GET" "/usuario";
    define text uid = param("id")
    if uid == "";
        respond.status(400)
        respond.json("{\"error\":\"id requerido\"}")
        stop
    break
    respond.json("{\"id\":\"" + uid + "\"}")
break
```

---

## 21. Middleware

Un middleware es una función que se ejecuta **antes** de cada ruta. Si llama a `stop`, la petición no llega al handler de la ruta.

```altair
middleware autenticacion;
    define text clave = header("X-API-Key")
    if clave != "mi-secreto";
        respond.status(401)
        respond.json("{\"error\":\"no autorizado\"}")
        stop
    break
break
```

Los middleware se aplican en orden de declaración, antes de las rutas.

---

## 22. Rate limiting

Se declara directamente en la ruta.

```altair
route "POST" "/api/datos" rate_limit 60 per_minute;
    / máximo 60 peticiones por minuto por IP
    respond.json("ok")
break

route "GET" "/buscar" rate_limit 10 per_second;
    respond.json("resultados")
break
```

Si se supera el límite, el runtime devuelve automáticamente `429 Too Many Requests`.

---

## 23. Health checks

```altair
health "/health";
    check "base_datos" -> 1     / 1 = OK, 0 = fallo
    check "almacenamiento" -> 1
break
```

El endpoint devuelve JSON con el estado de cada check y un `status` global (`ok` o `degraded`).

---

## 24. Métricas

```altair
metrics "/metrics";
```

Expone un endpoint compatible con Prometheus con métricas internas del runtime (peticiones totales, errores, tiempos de respuesta).

---

## 25. Graceful shutdown

```altair
on_shutdown;
    log "Servidor deteniendo..."
    / limpiar recursos, cerrar conexiones, etc.
break
```

Se ejecuta cuando el proceso recibe `SIGTERM` (Linux/macOS) o un evento de cierre equivalente (Windows).

---

## 26. Sesiones

Las sesiones se almacenan en memoria del runtime, indexadas por un ID de sesión que el cliente debe proporcionar.

```altair
session usuario_sesion expires 30m;
/ Ahora 'usuario_sesion' es una variable de sesión
```

Las sesiones se leen y escriben mediante las funciones internas del runtime usando el ID de sesión de la petición.

---

## 27. Config y variables de entorno

```altair
config;
    env("PORT") default "8080"
    env("API_SECRET") required
    env("LOG_LEVEL") default "info"
break
```

- `default "valor"`: usa ese valor si la variable de entorno no está definida.
- `required`: el programa falla al arrancar si la variable no está definida.

Las variables de entorno se leen en el inicio del programa y están disponibles como variables Altair con el mismo nombre.

---

## 28. Pool de base de datos

```altair
db_pool conexion = connect("postgresql://usuario:pass@host:5432/db") max 10
```

Define un pool de conexiones. El soporte de queries es extensible a través del runtime.

---

## 29. Jobs programados

Un job es una función que se ejecuta periódicamente mientras el servidor está en marcha.

```altair
job limpieza every 5m;
    / código que se ejecuta cada 5 minutos
    log "Limpieza ejecutada"
break

job heartbeat every 30s;
    log "Servidor activo"
break
```

Los jobs se ejecutan en el hilo principal entre peticiones HTTP.

---

## 30. Gráficos y UI con Raylib (v1.6.5vC)

La versión 1.6.5vC añade soporte de gráficos 2D/UI mediante [Raylib](https://www.raylib.com/). El compilador detecta automáticamente si el programa usa `link * raylib` y enlaza la librería.

### Activar Raylib

```altair
link * raylib
```

### Ventana y bucle principal

```altair
link * raylib

window;
    title = "Mi Juego"
    width = 800
    height = 600
    fps = 60
create window

loop;
    clear black

    draw text;
        text = "Hola desde Altair!"
        x = 100
        y = 100
        size = 24
        color = white
    create draw

    / leer teclado
    if key "SPACE";
        log "Espacio pulsado"
    break
break
```

### Colores predefinidos

`white`, `black`, `red`, `green`, `blue`, `yellow`, `orange`, `purple`, `pink`, `gray`, `lightgray`, `darkgray`, `brown`, `skyblue`, `darkblue`, `maroon`, `darkgreen`, `lime`, `gold`, `beige`, `magenta`, `violet`, `darkpurple`, `darkbrown`, `raywhite`, `transparent`.

Color personalizado:
```altair
color miColor = rgb(255, 128, 0)
color miColorHex = "#FF8000"
```

### Draw (primitivas)

```altair
draw rectangle;
    x = 50
    y = 50
    width = 200
    height = 100
    color = red
create draw

draw circle;
    x = 400
    y = 300
    radius = 50
    color = blue
create draw

draw text;
    text = "Puntuación: " + score
    x = 10
    y = 10
    size = 20
    color = white
create draw

draw line;
    x1 = 0
    y1 = 0
    x2 = 800
    y2 = 600
    color = green
create draw

draw image;
    image = miImagen
    x = 100
    y = 100
create draw
```

### Imágenes

```altair
image fondo = "fondo.png" disk
image sprite = "personaje.png" ram
```

### Audio

```altair
sound disparo = "disparo.wav"
music musica_fondo = "musica.mp3"

play musica_fondo
pause musica_fondo
stop musica_fondo
play disparo
```

### Teclado y ratón

```altair
/ Teclas: SPACE, ENTER, ESCAPE, A-Z, 0-9, F1-F12, UP, DOWN, LEFT, RIGHT, etc.
if key "SPACE";
    log "Espacio pulsado"
break

if key "A";
    jugador_x -= velocidad
break
```

Constantes de ratón disponibles en el contexto Raylib: `MOUSE_LEFT`, `MOUSE_RIGHT`, `MOUSE_MIDDLE`.

### Temporizadores

```altair
timer cuenta_atras = 60   / en segundos
```

### Escenas

```altair
scene menu;
scene juego;
scene fin;

goto menu
goto juego
```

---

## 31. Referencia CLI de altairc

```
Altair Compiler v1.6.5vC

Uso:
  altairc <archivo.at> [opciones]
  altairc guide              Escribe ALTAIR_GUIDE.md en el directorio actual
  altairc guide --stdout     Imprime la guía en stdout

Opciones:
  -o <salida>       Nombre del binario de salida (por defecto: a.out / a.exe)
  -icon <file.ico>  Incrusta un icono .ico en el .exe (solo Windows)
  --emit-c          Imprime el C generado en stdout (no compila)
  --emit-ast        Imprime el número de nodos del AST
  --no-sema         Omite el análisis semántico
  -v, --version     Muestra la versión del compilador
  -h, --help        Muestra esta ayuda

Ejemplos:
  altairc hola.at -o hola
  altairc servidor.at -o servidor
  altairc app.at -o app -icon app.ico
  altairc programa.at --emit-c | head -100
  altairc guide
```

### Compilar y ejecutar (Linux/macOS)

```bash
altairc programa.at -o programa
./programa
```

### Compilar y ejecutar (Windows)

```cmd
altairc programa.at -o programa.exe
programa.exe
```

### Instalar (Linux/macOS, desde el fuente)

```bash
make
make install    # instala en ~/.local/bin/altairc
```

---

## 32. Códigos de error

| Código | Significado |
|--------|-------------|
| ALT0001 | Variable desconocida |
| ALT0002 | Operación con tipos incompatibles |
| ALT0003 | Error de sintaxis (token inesperado) |
| ALT0006 | Bloque `prefer` sin ningún tier |
| ALT0007 | Reasignación de variable `const` |
| ALT0008 | `weight` negativo |
| ALT0009 | Estados `orbit` duplicados |
| ALT0010 | División o módulo por cero |
| ALT0011 | Namespace de introspección desconocido |
| ALT0012 | Estado `orbit` no encontrado, o variable sin orbit |
| ALT0013 | Índice de lista fuera de rango |

---

## 33. Ejemplo completo de servidor

```altair
altair.doc;
    name = "TodoAPI"
    version = "1.0"
    author = "Altair Team"
create altair.doc

/ Configuración de entorno
config;
    env("PORT") default "8080"
    env("API_SECRET") required
break

/ Lista de tareas persistente en disco
define list todos disk = []

/ Middleware de autenticación
middleware auth;
    define text clave = header("X-API-Key")
    if clave != API_SECRET;
        respond.status(401)
        respond.json("{\"error\":\"no autorizado\"}")
        stop
    break
break

/ Health check
health "/health";
    check "almacenamiento" -> 1
break

/ Métricas Prometheus
metrics "/metrics";

/ Job de limpieza periódica
job limpieza every 1h;
    log "Limpieza ejecutada"
break

/ Rutas
listen PORT;
    route "GET" "/todos";
        respond.json(todos)
    break

    route "POST" "/todos" rate_limit 60 per_minute;
        define text titulo = body()
        if titulo == "";
            respond.status(400)
            respond.json("{\"error\":\"titulo requerido\"}")
            stop
        break
        todos.append(titulo)
        respond.status(201)
        respond.json("{\"creado\":true}")
    break

    route "DELETE" "/todos";
        todos.clear()
        respond.json("{\"ok\":true}")
    break
break
```

```bash
altairc TodoAPI.at -o todoapi
API_SECRET=mi-clave PORT=3000 ./todoapi
curl -H "X-API-Key: mi-clave" http://localhost:3000/todos
curl -H "X-API-Key: mi-clave" -X POST -d "Comprar pan" http://localhost:3000/todos
```

---

*Generado a partir del código fuente real de `altairc v1.6.5vC`.*
*Lexer: `lexer.c` · Parser: `parser.c` · Sema: `sema.c` · Codegen: `codegen.c` · Runtime: `altair_rt.c`*
