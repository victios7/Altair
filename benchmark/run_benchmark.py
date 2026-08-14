#!/usr/bin/env python3
"""Reproducible benchmark suite for Altair 1.7.5vB.
The runner intentionally uses only Python's standard library. It can benchmark
the uploaded zip directly or an already extracted Altair source tree.
"""
from __future__ import annotations
import argparse
import json
import os
import platform
import shutil
import statistics
import subprocess
import sys
import tempfile
import textwrap
import time
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable
ROOT = Path(__file__).resolve().parents[2]
DEFAULT_ARCHIVE = ROOT / "attached_assets" / "altair-1.7.5vB-deploy_1_1786613977112.zip"
@dataclass(frozen=True)
class Workload:
    name: str
    source: str
    expected: str
    timeout_s: float = 30.0
@dataclass
class ProcessResult:
    returncode: int
    duration_ms: float
    stdout: str
    stderr: str
    peak_rss_kb: int | None
def altair_header(name: str) -> str:
    return textwrap.dedent(
        f"""\
        altair.doc;
            name = "{name}";
            version = "1.0";
            author = "Altair Benchmark";
        create altair.doc
        """
    )
def numeric_expected(n: int) -> int:
    return sum((i * 3) % 1_000_000 for i in range(n))
def function_expected(n: int) -> int:
    acc = 0
    for i in range(n):
        acc += (i * 31 + acc * 17) % 1_000_000
    return acc
def fib(n: int) -> int:
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a
def workload_suite() -> list[Workload]:
    numeric_n = 500_000
    function_n = 100_000
    list_n = 100_000
    bitwise_n = 500_000
    string_n = 1_500
    numeric = altair_header("NumericLoop") + textwrap.dedent(
        f"""\
        numeric i = 0
        numeric acc = 0
        while i < {numeric_n};
            acc += (i * 3) % 1000000
            i += 1
        break
        log acc
        """
    )
    function = altair_header("FunctionCalls") + textwrap.dedent(
        f"""\
        fun mix -> numeric numeric x, numeric y;
            return (x * 31 + y * 17) % 1000000
        break
        numeric i = 0
        numeric acc = 0
        while i < {function_n};
            acc += mix(i, acc)
            i += 1
        break
        log acc
        """
    )
    recursion_n = 29
    recursion = altair_header("Recursion") + textwrap.dedent(
        f"""\
        fun fib -> numeric numeric n;
            if n < 2;
                return n
            break
            return fib(n - 1) + fib(n - 2)
        break
        log fib({recursion_n})
        """
    )
    list_workload = altair_header("ListWorkload") + textwrap.dedent(
        f"""\
        list values = [1, 2, 3]
        numeric i = 0
        while i < {list_n};
            values.append(i)
            i += 1
        break
        numeric j = 0
        numeric acc = 0
        while j < {list_n};
            acc += values[j]
            j += 1
        break
        log acc
        """
    )
    bitwise = altair_header("Bitwise") + textwrap.dedent(
        f"""\
        numeric i = 0
        numeric acc = 0
        while i < {bitwise_n};
            acc += ((i & 255) ^ ((i << 2) & 1023))
            i += 1
        break
        log acc
        """
    )
    string_workload = altair_header("StringWorkload") + textwrap.dedent(
        f"""\
        text value = ""
        numeric i = 0
        while i < {string_n};
            value = value + "x"
            i += 1
        break
        log value.length
        """
    )
    file_workload = altair_header("FileIO") + textwrap.dedent(
        """\
        create_file("altair-benchmark.tmp")
        file wf = open_write("altair-benchmark.tmp")
        numeric i = 0
        while i < 2000;
            write(wf, "altair benchmark line")
            i += 1
        break
        close(wf)
        file rf = open("altair-benchmark.tmp")
        text contents = read(rf)
        close(rf)
        log file_exists("altair-benchmark.tmp")
        delete_file("altair-benchmark.tmp")
        """
    )
    precision = altair_header("NumericLiteralPrecision") + textwrap.dedent(
        """\
        numeric value = 1000003
        log value
        """
    )
    return [
        Workload("numeric_loop", numeric, str(numeric_expected(numeric_n))),
        Workload("function_calls", function, str(function_expected(function_n))),
        Workload("recursion_fib", recursion, str(fib(recursion_n))),
        Workload("list_append_index", list_workload, str(sum(range(list_n - 3)) + 6)),
        Workload("bitwise_loop", bitwise, "255735664"),
        Workload("string_concat", string_workload, str(string_n)),
        Workload("file_io", file_workload, "true"),
        Workload("numeric_literal_precision", precision, "1000003"),
    ]
def safe_extract(archive: Path, destination: Path) -> None:
    with zipfile.ZipFile(archive) as zf:
        root = destination.resolve()
        for member in zf.infolist():
            target = (destination / member.filename).resolve()
            if os.path.commonpath((str(root), str(target))) != str(root):
                raise ValueError(f"unsafe zip member: {member.filename}")
        zf.extractall(destination)
def find_altair_dir(root: Path) -> Path:
    candidates = [
        root / "altair-1.7.5vB-builder-main",
        root / "altair-deploy-package" / "altair-1.7.5vB-builder-main",
    ]
    candidates.extend(root.rglob("altair-1.7.5vB-builder-main"))
    for candidate in candidates:
        if (candidate / "Makefile").is_file() and (candidate / "src" / "main.c").is_file():
            return candidate
    raise FileNotFoundError("could not locate altair-1.7.5vB-builder-main in source or archive")
def read_rss_kb(pid: int) -> int | None:
    try:
        status = Path(f"/proc/{pid}/status").read_text()
    except (FileNotFoundError, PermissionError, OSError):
        return None
    for line in status.splitlines():
        if line.startswith("VmRSS:"):
            fields = line.split()
            if len(fields) >= 2:
                return int(fields[1])
    return None
def descendant_pids(pid: int) -> set[int]:
    found: set[int] = set()
    pending = [pid]
    while pending:
        current = pending.pop()
        if current in found:
            continue
        found.add(current)
        try:
            children = Path(f"/proc/{current}/task/{current}/children").read_text().split()
        except (FileNotFoundError, PermissionError, OSError):
            continue
        pending.extend(int(child) for child in children)
    return found
def run_process(
    command: list[str],
    cwd: Path,
    timeout_s: float,
    stdin: str | None = None,
) -> ProcessResult:
    started = time.perf_counter()
    process = subprocess.Popen(
        command,
        cwd=cwd,
        stdin=subprocess.PIPE if stdin is not None else subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        env={**os.environ, "LC_ALL": "C"},
    )
    if stdin is not None and process.stdin is not None:
        process.stdin.write(stdin)
        process.stdin.close()
    peak_rss: int | None = None
    deadline = started + timeout_s
    while process.poll() is None:
        total_rss = 0
        seen_rss = False
        for pid in descendant_pids(process.pid):
            rss = read_rss_kb(pid)
            if rss is not None:
                total_rss += rss
                seen_rss = True
        if seen_rss:
            peak_rss = max(peak_rss or 0, total_rss)
        if time.perf_counter() > deadline:
            process.kill()
            stdout, stderr = process.communicate()
            return ProcessResult(
                124,
                (time.perf_counter() - started) * 1000,
                stdout,
                stderr + "\nTIMEOUT",
                peak_rss,
            )
        time.sleep(0.002)
    stdout, stderr = process.communicate()
    return ProcessResult(
        process.returncode,
        (time.perf_counter() - started) * 1000,
        stdout,
        stderr,
        peak_rss,
    )
def stats(samples: Iterable[float]) -> dict[str, float]:
    values = list(samples)
    values_sorted = sorted(values)
    return {
        "min_ms": round(min(values), 3),
        "median_ms": round(statistics.median(values), 3),
        "p95_ms": round(values_sorted[min(len(values_sorted) - 1, int(len(values_sorted) * 0.95))], 3),
        "max_ms": round(max(values), 3),
    }
def rss_stats(samples: Iterable[int | None]) -> dict[str, int] | None:
    values = [value for value in samples if value is not None]
    if not values:
        return None
    return {"min_kb": min(values), "median_kb": int(statistics.median(values)), "max_kb": max(values)}
def compile_command(compiler: Path, source: Path, output: Path, *options: str) -> list[str]:
    return [str(compiler), str(source), *options, "-o", str(output)]
def write_workloads(workdir: Path) -> list[tuple[Workload, Path]]:
    source_dir = workdir / "sources"
    source_dir.mkdir()
    result = []
    for workload in workload_suite():
        path = source_dir / f"{workload.name}.at"
        path.write_text(workload.source)
        result.append((workload, path))
    return result
def benchmark_workloads(
    compiler: Path,
    workdir: Path,
    runs: int,
    warmups: int,
) -> list[dict]:
    results = []
    for workload, source in write_workloads(workdir):
        output = workdir / f"{workload.name}.bin"
        compile_samples: list[float] = []
        compile_rss: list[int | None] = []
        compile_failures: list[str] = []
        for index in range(max(runs, 3)):
            measured = run_process(
                compile_command(compiler, source, output),
                workdir,
                workload.timeout_s,
            )
            if index >= max(runs, 3) - runs:
                compile_samples.append(measured.duration_ms)
                compile_rss.append(measured.peak_rss_kb)
            if measured.returncode != 0:
                compile_failures.append(measured.stderr[-1000:])
                break
        if compile_failures:
            results.append(
                {
                    "name": workload.name,
                    "status": "compile_error",
                    "compile_errors": compile_failures,
                    "source_lines": len(workload.source.splitlines()),
                }
            )
            continue
        for _ in range(warmups):
            run_process([str(output)], workdir, workload.timeout_s)
        run_samples: list[float] = []
        run_rss: list[int | None] = []
        outputs: list[str] = []
        run_errors: list[str] = []
        for _ in range(runs):
            measured = run_process([str(output)], workdir, workload.timeout_s)
            run_samples.append(measured.duration_ms)
            run_rss.append(measured.peak_rss_kb)
            outputs.append(measured.stdout.strip())
            if measured.returncode != 0:
                run_errors.append(measured.stderr[-1000:])
        status = "pass"
        if run_errors:
            status = "runtime_error"
        elif any(value != workload.expected for value in outputs):
            status = "wrong_output"
        results.append(
            {
                "name": workload.name,
                "status": status,
                "source_lines": len(workload.source.splitlines()),
                "expected_output": workload.expected,
                "observed_outputs": outputs,
                "compile": {"time": stats(compile_samples), "rss": rss_stats(compile_rss)},
                "runtime": {"time": stats(run_samples), "rss": rss_stats(run_rss)},
                "errors": run_errors,
            }
        )
    return results
def compile_scaling(compiler: Path, workdir: Path, runs: int) -> list[dict]:
    results = []
    for size in (10, 50, 100):
        body = "\n".join(f" acc = acc + {i + 1}" for i in range(size))
        source = altair_header(f"Compile{size}") + textwrap.dedent(
            f"""\
            fun generated -> numeric;
                numeric acc = 0
            {body}
                return acc
            break
            log generated()
            """
        )
        path = workdir / f"compile_scale_{size}.at"
        path.write_text(source)
        samples: list[float] = []
        rss: list[int | None] = []
        failures: list[str] = []
        for _ in range(runs):
            result = run_process(
                compile_command(compiler, path, workdir / f"compile_scale_{size}.bin", "--emit-ast"),
                workdir,
                30,
            )
            samples.append(result.duration_ms)
            rss.append(result.peak_rss_kb)
            if result.returncode != 0:
                failures.append(result.stderr[-1000:])
        results.append(
            {
                "statements_in_function": size,
                "source_lines": len(source.splitlines()),
                "status": "pass" if not failures else "compile_error",
                "front_end": {"time": stats(samples), "rss": rss_stats(rss)},
                "errors": failures,
            }
        )
    return results
def compatibility_matrix(compiler: Path, source_root: Path, workdir: Path) -> list[dict]:
    test_files = [
        ("hello", source_root / "examples" / "hello.at", None),
        ("game_compile_and_run", source_root / "examples" / "game.at", "Victor\n"),
        ("databock", source_root / "test" / "databock.at", None),
        ("persist", source_root / "test" / "persist.at", None),
        ("pointer2", source_root / "test" / "pointer2.at", None),
        ("paint_raylib", source_root / "test" / "paint.at", None),
        ("selfhost", source_root / "test" / "selfhost.at", None),
    ]
    results = []
    for name, source, stdin in test_files:
        output = workdir / f"compat_{name}.bin"
        compile_result = run_process(compile_command(compiler, source, output), workdir, 30)
        item = {
            "name": name,
            "compile_status": "pass" if compile_result.returncode == 0 else "fail",
            "compile_time_ms": round(compile_result.duration_ms, 3),
            "compile_error": compile_result.stderr[-1500:] if compile_result.returncode else "",
        }
        if compile_result.returncode == 0:
            run_result = run_process([str(output)], workdir, 30, stdin)
            item.update(
                {
                    "run_status": "pass" if run_result.returncode == 0 else "fail",
                    "run_time_ms": round(run_result.duration_ms, 3),
                    "run_output": run_result.stdout.strip()[-1500:],
                    "run_error": run_result.stderr[-1500:] if run_result.returncode else "",
                }
            )
        if name == "paint_raylib":
            item.update(
                {
                    "classification": "esperado",
                    "compile_status": "esperado",
                    "run_status": "no evaluado",
                    "note": "Raylib se incorpora durante el flujo de empaquetado de GitHub; no forma parte del ZIP local.",
                }
            )
        elif name == "selfhost":
            item.update(
                {
                    "classification": "esperado",
                    "compile_status": "esperado",
                    "run_status": "no evaluado",
                    "note": "La prueba incluida usa la sintaxis anterior de punteros; la sintaxis vigente es diferente.",
                }
            )
        results.append(item)
    return results
def reference_programs(workdir: Path) -> dict[str, dict[str, Path]]:
    numeric_n = 500_000
    recursion_n = 29
    c_numeric = workdir / "reference_numeric.c"
    c_numeric.write_text(
        textwrap.dedent(
            f"""\
            #include <stdio.h>
            #include <stdlib.h>
            int main(int argc, char **argv) {{
                int n = argc > 1 ? atoi(argv[1]) : {numeric_n};
                long long acc = 0;
                for (int i = 0; i < n; ++i) acc += (i * 3) % 1000000;
                printf("%lld\\n", acc);
                return 0;
            }}
            """
        )
    )
    c_fib = workdir / "reference_fib.c"
    c_fib.write_text(
        textwrap.dedent(
            f"""\
            #include <stdio.h>
            #include <stdlib.h>
            static long long fib(int n) {{ return n < 2 ? n : fib(n-1) + fib(n-2); }}
            int main(int argc, char **argv) {{
                int n = argc > 1 ? atoi(argv[1]) : {recursion_n};
                printf("%lld\\n", fib(n));
                return 0;
            }}
            """
        )
    )
    py_numeric = workdir / "reference_numeric.py"
    py_numeric.write_text(
        f"n={numeric_n}; print(sum((i * 3) % 1000000 for i in range(n)))\n"
    )
    py_fib = workdir / "reference_fib.py"
    py_fib.write_text(
        f"def fib(n): return n if n < 2 else fib(n-1) + fib(n-2)\nprint(fib({recursion_n}))\n"
    )
    return {
        "numeric_loop": {"c": c_numeric, "python": py_numeric, "args": [str(numeric_n)]},
        "recursion_fib": {"c": c_fib, "python": py_fib, "args": [str(recursion_n)]},
    }
def benchmark_references(workdir: Path, runs: int) -> list[dict]:
    if shutil.which("gcc") is None or shutil.which("python3") is None:
        return []
    results = []
    for name, paths in reference_programs(workdir).items():
        c_binary = workdir / f"{name}_c"
        compile_result = run_process(
            ["gcc", "-O3", "-std=c11", str(paths["c"]), "-o", str(c_binary)],
            workdir,
            30,
        )
        item = {"name": name, "c_compile_ms": round(compile_result.duration_ms, 3), "implementations": {}}
        args = [str(value) for value in paths.get("args", [])]
        for implementation, command in (
            ("c", [str(c_binary), *args]),
            ("python", ["python3", str(paths["python"]), *args]),
        ):
            samples = []
            rss = []
            outputs = []
            for _ in range(runs):
                result = run_process(command, workdir, 30)
                samples.append(result.duration_ms)
                rss.append(result.peak_rss_kb)
                outputs.append(result.stdout.strip())
            item["implementations"][implementation] = {
                "status": "pass" if all(outputs) else "fail",
                "output": outputs,
                "runtime": {"time": stats(samples), "rss": rss_stats(rss)},
            }
        results.append(item)
    return results
def make_report(report: dict) -> str:
    lines = [
        "# Altair 1.7.5vB — informe del benchmark",
        "",
        f"- Generado: `{report['environment']['timestamp_utc']}`",
        f"- Plataforma: `{report['environment']['platform']}`",
        f"- Compilador: `{report['environment']['altair_version']}`",
        f"- Corridas: `{report['configuration']['runs']}` medidas + `{report['configuration']['warmups']}` de calentamiento",
        "",
        "## Resumen ejecutivo",
        "",
    ]
    workloads = report["workloads"]
    passed = sum(item["status"] == "pass" for item in workloads)
    lines.append(f"- Correctitud de ejecución: **{passed}/{len(workloads)} cargas pasan**.")
    lines.append("- Los tiempos son medianas de wall-clock del proceso; menos es mejor.")
    lines.append("- RSS es el pico de memoria residente muestreado en el árbol de procesos cuando está disponible.")
    lines.append("")
    lines.extend(["## Cargas de ejecución", "", "| Carga | Estado | Compilación mediana | Ejecución mediana | Ejecución p95 | RSS pico |", "|---|---:|---:|---:|---:|---:|"])
    for item in workloads:
        if item["status"] != "pass":
            observed = item.get("observed_outputs", ["n/a"])
            observed_text = observed[0] if observed else "n/a"
            lines.append(
                f"| `{item['name']}` | **salida incorrecta** "
                f"(esperada `{item.get('expected_output', 'n/a')}`, observada `{observed_text}`) | — | — | — | — |"
            )
            continue
        compile_ms = item["compile"]["time"]["median_ms"]
        runtime = item["runtime"]
        rss = item["runtime"]["rss"]
        rss_text = f"{rss['max_kb']} KB" if rss else "n/a"
        lines.append(
            f"| `{item['name']}` | pasa | {compile_ms} ms | "
            f"{runtime['time']['median_ms']} ms | {runtime['time']['p95_ms']} ms | {rss_text} |"
        )
    lines.append("")
    lines.append("## Escalabilidad del frontend (`--emit-ast`)")
    lines.append("")
    lines.extend(["| Sentencias en la función | Líneas de fuente | Mediana | RSS pico | Estado |", "|---:|---:|---:|---:|---:|"])
    for item in report["compile_scaling"]:
        rss = item["front_end"]["rss"]
        lines.append(
            f"| {item['statements_in_function']} | {item['source_lines']} | "
            f"{item['front_end']['time']['median_ms']} ms | "
            f"{rss['max_kb'] if rss else 'n/a'} KB | {'pasa' if item['status'] == 'pass' else 'fallo'} |"
        )
    lines.append("")
    lines.append("## Comparativa con otros lenguajes")
    lines.append("")
    lines.extend(["| Carga | C mediana | Python mediana | Altair mediana |", "|---|---:|---:|---:|"])
    by_name = {item["name"]: item for item in workloads}
    for item in report["references"]:
        implementations = item["implementations"]
        altair = by_name.get(item["name"], {}).get("runtime", {}).get("time", {}).get("median_ms", "n/a")
        lines.append(
            f"| `{item['name']}` | {implementations['c']['runtime']['time']['median_ms']} ms | "
            f"{implementations['python']['runtime']['time']['median_ms']} ms | {altair} ms |"
        )
    lines.append("")
    lines.append("## Matriz de compatibilidad")
    lines.append("")
    lines.extend(["| Ejemplo existente | Compilación | Ejecución | Notas |", "|---|---:|---:|---|"])
    for item in report["compatibility"]:
        compile_status = item["compile_status"]
        run_status = item.get("run_status", "not run")
        note = item.get("note", "") or item.get("compile_error", "") or item.get("run_error", "")
        note = " ".join(note.strip().split())[:180] or "—"
        lines.append(f"| `{item['name']}` | {compile_status} | {run_status} | {note} |")
    lines.append("")
    lines.append("## Interpretación")
    lines.append("")
    lines.append("Usa las medianas de ejecución para evaluar el rendimiento del lenguaje y del runtime; usa las medianas de compilación para evaluar el ciclo de desarrollo.")
    lines.append("Raylib aparece como esperado porque el flujo de GitHub lo incorpora durante el empaquetado. selfhost aparece como esperado porque el fixture incluido conserva la sintaxis antigua de punteros.")
    precision = next(
        (item for item in report["workloads"] if item["name"] == "numeric_literal_precision"),
        None,
    )
    if precision and precision.get("status") == "pass":
        lines.append("La carga numeric_literal_precision confirma que los literales numéricos conservan su precisión.")
    else:
        lines.append("La carga numeric_literal_precision sigue siendo un fallo de correctitud y requiere atención.")
    lines.append("")
    return "\n".join(lines)
def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path, default=DEFAULT_ARCHIVE)
    parser.add_argument(
        "--source-dir",
        type=Path,
        default=(ROOT / "altair") if (ROOT / "altair").is_dir() else None,
        help="copia persistente del compilador; por defecto se usa ./altair cuando existe",
    )
    parser.add_argument(
        "--archive-only",
        action="store_true",
        help="ignora --source-dir y ejecuta contra el ZIP original",
    )
    parser.add_argument("--runs", type=int, default=5)
    parser.add_argument("--warmups", type=int, default=1)
    parser.add_argument("--report-dir", type=Path, default=ROOT / "benchmarks" / "altair" / "results")
    args = parser.parse_args()
    if args.runs < 3:
        parser.error("--runs must be at least 3")
    if args.warmups < 0:
        parser.error("--warmups cannot be negative")
    with tempfile.TemporaryDirectory(prefix="altair-benchmark-") as temp_name:
        temp_root = Path(temp_name)
        if args.source_dir and not args.archive_only:
            source_root = args.source_dir.resolve()
            keep_source = True
        else:
            if not args.archive.is_file():
                parser.error(f"archive not found: {args.archive}")
            extracted = temp_root / "source"
            extracted.mkdir()
            safe_extract(args.archive.resolve(), extracted)
            source_root = find_altair_dir(extracted)
            keep_source = False
        compiler = source_root / "altairc"
        build = run_process(["make", "clean"], source_root, 30)
        if build.returncode == 0:
            build = run_process(["make"], source_root, 120)
        if build.returncode != 0 or not compiler.is_file():
            print("Altair compiler build failed", file=sys.stderr)
            print(build.stderr, file=sys.stderr)
            return 2
        workdir = temp_root / "runs"
        workdir.mkdir()
        workloads = benchmark_workloads(compiler, workdir, args.runs, args.warmups)
        report = {
            "environment": {
                "timestamp_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "platform": platform.platform(),
                "python": platform.python_version(),
                "gcc": subprocess.run(["gcc", "--version"], capture_output=True, text=True).stdout.splitlines()[0],
                "altair_version": subprocess.run([str(compiler), "--version"], capture_output=True, text=True).stdout.strip(),
                "archive": str(args.archive) if args.archive_only or not args.source_dir else None,
                "source_dir_mode": keep_source,
            },
            "configuration": {"runs": args.runs, "warmups": args.warmups},
            "workloads": workloads,
            "compile_scaling": compile_scaling(compiler, workdir, max(3, args.runs)),
            "references": benchmark_references(workdir, args.runs),
            "compatibility": compatibility_matrix(compiler, source_root, workdir),
        }
        args.report_dir.mkdir(parents=True, exist_ok=True)
        (args.report_dir / "latest.json").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
        (args.report_dir / "latest.md").write_text(make_report(report))
        print(make_report(report))
        print(f"\nJSON report: {args.report_dir / 'latest.json'}")
        return 0
if __name__ == "__main__":
    raise SystemExit(main()) a este proyecto y dame resultados.
