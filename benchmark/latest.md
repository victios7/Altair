# Altair 1.7.5vB — Informe del benchmark

- Generado: `2026-08-14T16:06:33Z`
- Plataforma: `Linux-6.12.8+-x86_64-with-glibc2.39`
- Compilador: `altairc 1.7.5vB`
- Corridas: `3` medidas + `1` de calentamiento

## Resumen ejecutivo

- Correctitud de ejecución: **8/8 cargas pasan**.
- Los tiempos son medianas de wall-clock del proceso; menos es mejor.
- RSS es el pico de memoria residente muestreado en el árbol de procesos cuando está disponible.

## Cargas de ejecución

| Carga | Estado | Compilación mediana | Ejecución mediana | Ejecución p95 | RSS pico |
|---|---|---:|---:|---:|---:|
| `numeric_loop` | pasa | 1540.633 ms | 2.757 ms | 2.974 ms | 148 KB |
| `function_calls` | pasa | 1642.815 ms | 2.731 ms | 3.551 ms | 144 KB |
| `recursion_fib` | pasa | 1574.723 ms | 4.029 ms | 12.1 ms | 1636 KB |
| `list_append_index` | pasa | 1544.376 ms | 23.008 ms | 24.753 ms | 15120 KB |
| `bitwise_loop` | pasa | 1501.68 ms | 2.628 ms | 2.677 ms | 156 KB |
| `string_concat` | pasa | 1494.69 ms | 2.479 ms | 2.482 ms | 156 KB |
| `file_io` | pasa | 1368.273 ms | 2.478 ms | 2.483 ms | 144 KB |
| `numeric_literal_precision` | pasa | 1339.361 ms | 2.501 ms | 2.595 ms | 156 KB |

## Escalabilidad del frontend (`--emit-ast`)

| Sentencias en la función | Líneas de fuente | Mediana | RSS pico | Estado |
|---:|---:|---:|---:|---|
| 10 | 20 | 2.51 ms | 144 KB | pasa |
| 50 | 60 | 4.637 ms | 4876 KB | pasa |
| 100 | 110 | 8.982 ms | 10100 KB | pasa |

## Comparativa con otros lenguajes

| Carga | C mediana | Python mediana | Altair mediana |
|---|---:|---:|---:|
| `numeric_loop` | 2.484 ms | 48.619 ms | 2.757 ms |
| `recursion_fib` | 2.638 ms | 70.075 ms | 4.029 ms |

## Matriz de compatibilidad

| Ejemplo existente | Compilación | Ejecución | Notas |
|---|---:|---:|---|
| `hello` | pass | pass | — |
| `game_compile_and_run` | pass | pass | — |
| `databock` | pass | pass | — |
| `persist` | pass | pass | — |
| `pointer2` | pass | pass | — |
| `paint_raylib` | esperado | no evaluado | Raylib se incorpora durante el flujo de empaquetado de GitHub; no forma parte del ZIP local. |
| `selfhost` | esperado | no evaluado | La prueba incluida usa la sintaxis anterior de punteros; la sintaxis vigente es diferente. |

## Interpretación

Usa las medianas de ejecución para evaluar el rendimiento del lenguaje y del runtime; usa las medianas de compilación para evaluar el ciclo de desarrollo.

Raylib aparece como esperado porque el flujo de GitHub lo incorpora durante el empaquetado. `selfhost` aparece como esperado porque el fixture incluido conserva la sintaxis antigua de punteros.

La carga `numeric_literal_precision` confirma que los literales numéricos conservan su precisión.
