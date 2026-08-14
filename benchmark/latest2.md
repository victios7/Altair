# Altair 1.7.5vB — informe del benchmark

* Generado: `2026-08-14T16:10:33Z`
* Plataforma: `Linux-6.18.35-x86_64-with-glibc2.41`
* Compilador: `altairc 1.7.5vB`
* Corridas: `3` medidas + `1` de calentamiento

## Resumen ejecutivo

* Correctitud de ejecución: **8/8 cargas pasan**.
* Los tiempos son medianas de wall-clock del proceso; menos es mejor.
* RSS es el pico de memoria residente muestreado en el árbol de procesos cuando está disponible.

## Cargas de ejecución

| Carga                       | Estado | Compilación mediana | Ejecución mediana | Ejecución p95 | RSS pico |
| --------------------------- | -----: | ------------------: | ----------------: | ------------: | -------: |
| `numeric_loop`              |   pasa |         1051.649 ms |          2.514 ms |       2.56 ms |   212 KB |
| `function_calls`            |   pasa |         1026.316 ms |          2.529 ms |      2.529 ms |   208 KB |
| `recursion_fib`             |   pasa |         1047.727 ms |          2.574 ms |      2.603 ms |   212 KB |
| `list_append_index`         |   pasa |         1068.453 ms |         17.988 ms |     20.105 ms | 15384 KB |
| `bitwise_loop`              |   pasa |         1069.082 ms |          2.557 ms |       2.57 ms |   208 KB |
| `string_concat`             |   pasa |         1015.506 ms |          2.505 ms |      2.546 ms |   212 KB |
| `file_io`                   |   pasa |         1038.488 ms |          2.722 ms |      2.953 ms |   848 KB |
| `numeric_literal_precision` |   pasa |         1010.157 ms |          2.563 ms |      2.674 ms |   212 KB |

## Escalabilidad del frontend (`--emit-ast`)

| Sentencias en la función | Líneas de fuente |  Mediana | RSS pico | Estado |
| -----------------------: | ---------------: | -------: | -------: | -----: |
|                       10 |               21 | 2.608 ms |   212 KB |   pasa |
|                       50 |               61 | 4.634 ms |  7284 KB |   pasa |
|                      100 |              111 | 4.679 ms |  9164 KB |   pasa |

## Comparativa con otros lenguajes

| Carga           | C mediana | Python mediana | Altair mediana |
| --------------- | --------: | -------------: | -------------: |
| `numeric_loop`  |   2.56 ms |      615.03 ms |       2.514 ms |
| `recursion_fib` |  2.564 ms |      683.33 ms |       2.574 ms |

## Matriz de compatibilidad

| Ejemplo existente      | Compilación |   Ejecución | Notas                                                                                        |
| ---------------------- | ----------: | ----------: | -------------------------------------------------------------------------------------------- |
| `hello`                |        pass |        pass | —                                                                                            |
| `game_compile_and_run` |        pass |        pass | —                                                                                            |
| `databock`             |        pass |        pass | —                                                                                            |
| `persist`              |        pass |        pass | —                                                                                            |
| `pointer2`             |        pass |        pass | —                                                                                            |
| `paint_raylib`         |    esperado | no evaluado | Raylib se incorpora durante el flujo de empaquetado de GitHub; no forma parte del ZIP local. |
| `selfhost`             |    esperado | no evaluado | La prueba incluida usa la sintaxis anterior de punteros; la sintaxis vigente es diferente.   |

## Interpretación

Usa las medianas de ejecución para evaluar el rendimiento del lenguaje y del runtime; usa las medianas de compilación para evaluar el ciclo de desarrollo.
Raylib aparece como esperado porque el flujo de GitHub lo incorpora durante el empaquetado. selfhost aparece como esperado porque el fixture incluido conserva la sintaxis antigua de punteros.
La carga numeric_literal_precision confirma que los literales numéricos conservan su precisión.
