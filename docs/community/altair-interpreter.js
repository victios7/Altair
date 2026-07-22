

class AltairError extends Error {
  constructor(code, message, line) {
    super(message);
    this.code = code;
    this.line = line;
  }
}

// ---------- LEXER ----------
const KEYWORDS = new Set([
  "define","numeric","text","bool","list","object","token","const",
  "ram","disk","cache","temp","auto","release",
  "log","if","elif","else","while","repeat","times","forever","foreach","in",
  "break","exit","fun","return","try","catch","as","wait",
  "true","false","and","or"
]);

function lex(src) {
  const tokens = [];
  let i = 0, line = 1;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === "\n") { tokens.push({t:"NL", line}); line++; i++; continue; }
    if (c === " " || c === "\t" || c === "\r") { i++; continue; }
    // comment: "/" at start of a token followed by space or letter (not "/=" style, altair has no // )
    if (c === "/" && (src[i+1] === " " || /[a-zA-Z]/.test(src[i+1] || ""))) {
      while (i < n && src[i] !== "\n") i++;
      continue;
    }
    if (c === '"') {
      let s = ""; i++;
      while (i < n && src[i] !== '"') {
        if (src[i] === "\\" && src[i+1] === "n") { s += "\n"; i += 2; continue; }
        if (src[i] === "\\" && src[i+1] === '"') { s += '"'; i += 2; continue; }
        s += src[i]; i++;
      }
      i++; // closing quote
      tokens.push({t:"STR", v:s, line});
      continue;
    }
    if (/[0-9]/.test(c)) {
      let s = ""; 
      while (i < n && /[0-9.]/.test(src[i])) { s += src[i]; i++; }
      tokens.push({t:"NUM", v:parseFloat(s), line});
      continue;
    }
    if (/[a-zA-Z_]/.test(c)) {
      let s = "";
      while (i < n && /[a-zA-Z0-9_]/.test(src[i])) { s += src[i]; i++; }
      if (KEYWORDS.has(s)) tokens.push({t:s.toUpperCase(), v:s, line});
      else tokens.push({t:"IDENT", v:s, line});
      continue;
    }
    // multi-char operators
    const two = src.substr(i, 2);
    if (["==","!=","<=",">=","+=","-=","*=","/=","%="].includes(two)) {
      tokens.push({t:two, line}); i += 2; continue;
    }
    if ("+-*/%<>=!.,;:()[]{}".includes(c)) {
      tokens.push({t:c, line}); i++; continue;
    }
    // unknown char, skip
    i++;
  }
  tokens.push({t:"EOF", line});
  return tokens;
}

// ---------- PARSER ----------
class Parser {
  constructor(tokens) { this.toks = tokens; this.pos = 0; }
  peek(o=0){ return this.toks[this.pos+o]; }
  cur(){ return this.toks[this.pos]; }
  next(){ return this.toks[this.pos++]; }
  skipNL(){ while (this.cur().t === "NL") this.pos++; }
  expect(t){
    this.skipNL();
    if (this.cur().t !== t) throw new AltairError("ALT_PARSE", `Se esperaba '${t}' pero se encontró '${this.cur().t}' en la línea ${this.cur().line}`, this.cur().line);
    return this.next();
  }
  atEOF(){ this.skipNL(); return this.cur().t === "EOF"; }

  parseProgram(){
    const stmts = [];
    this.skipNL();
    while (this.cur().t !== "EOF") {
      stmts.push(this.parseStatement());
      this.skipNL();
    }
    return stmts;
  }

  // Parses statements until a BREAK token is found; consumes the BREAK.
  parseBlock(){
    const stmts = [];
    this.skipNL();
    while (this.cur().t !== "BREAK" && this.cur().t !== "EOF") {
      stmts.push(this.parseStatement());
      this.skipNL();
    }
    this.expect("BREAK");
    return stmts;
  }

  parseStatement(){
    this.skipNL();
    const tok = this.cur();
    switch (tok.t) {
      case "DEFINE": return this.parseDefine();
      case "LOG": { this.next(); const e = this.parseExpr(); return {k:"log", e, line:tok.line}; }
      case "IF": return this.parseIf();
      case "WHILE": return this.parseWhile();
      case "REPEAT": return this.parseRepeat();
      case "FOREVER": return this.parseForever();
      case "FOREACH": return this.parseForeach();
      case "EXIT": { this.next(); return {k:"exit", line:tok.line}; }
      case "RELEASE": { this.next(); const name = this.expect("IDENT").v; return {k:"release", name, line:tok.line}; }
      case "FUN": return this.parseFun();
      case "RETURN": { this.next(); 
        this.skipNLNoConsumeBlock=true;
        let e = null;
        if (this.cur().t !== "NL" && this.cur().t !== "BREAK" && this.cur().t !== "EOF") e = this.parseExpr();
        return {k:"return", e, line:tok.line}; }
      case "TRY": return this.parseTry();
      case "WAIT": { this.next(); this.parseExpr(); return {k:"nop", line:tok.line}; } // no-op, no sleeping in browser
      default:
        return this.parseExprOrAssign();
    }
  }

  parseDefine(){
    const line = this.cur().line;
    this.expect("DEFINE");
    const type = this.next().v; // numeric/text/bool/list/object/token
    const name = this.expect("IDENT").v;
    let storage = "ram", isConst = false;
    while (["RAM","DISK","CACHE","TEMP","AUTO","CONST"].includes(this.cur().t)) {
      const q = this.next();
      if (q.t === "CONST") isConst = true; else storage = q.v;
      // skip qualifiers like expire=30m / weight=5 (IDENT = ...)
      if (this.cur().t === "IDENT" && this.peek(1).t === "=") {
        // could be a qualifier like expire=30m; treat as ident= value, skip
        // but this collides with our expr assign; only skip if it's expire/weight
      }
    }
    let init = null;
    if (this.cur().t === "=") { this.next(); init = this.parseExpr(); }
    return {k:"define", type, name, storage, isConst, init, line};
  }

  parseExprOrAssign(){
    const line = this.cur().line;
    const expr = this.parseExpr();
    // assignment forms: IDENT = expr, IDENT += expr, list[idx] = expr, obj.field = expr
    const compound = ["=","+=","-=","*=","/=","%="];
    if (compound.includes(this.cur().t)) {
      const op = this.next().t;
      const rhs = this.parseExpr();
      return {k:"assign", target: expr, op, rhs, line};
    }
    return {k:"exprstmt", e: expr, line};
  }

  parseIf(){
    const line = this.cur().line;
    this.expect("IF");
    const cond = this.parseExpr();
    this.expect(";");
    const body = this.parseBlock();
    const clause = {cond, body};
    const clauses = [clause];
    this.skipNL();
    while (this.cur().t === "ELIF") {
      this.next();
      const c2 = this.parseExpr();
      this.expect(";");
      const b2 = this.parseBlock();
      clauses.push({cond:c2, body:b2});
      this.skipNL();
    }
    let elseBody = null;
    if (this.cur().t === "ELSE") {
      this.next();
      this.expect(";");
      elseBody = this.parseBlock();
    }
    return {k:"if", clauses, elseBody, line};
  }

  parseWhile(){
    const line = this.cur().line;
    this.expect("WHILE");
    const cond = this.parseExpr();
    this.expect(";");
    const body = this.parseBlock();
    return {k:"while", cond, body, line};
  }

  parseRepeat(){
    const line = this.cur().line;
    this.expect("REPEAT");
    const count = this.parseExpr();
    if (this.cur().t === "TIMES") this.next();
    this.expect(";");
    const body = this.parseBlock();
    return {k:"repeat", count, body, line};
  }

  parseForever(){
    const line = this.cur().line;
    this.expect("FOREVER");
    this.expect(";");
    const body = this.parseBlock();
    return {k:"forever", body, line};
  }

  parseForeach(){
    const line = this.cur().line;
    this.expect("FOREACH");
    const varName = this.expect("IDENT").v;
    this.expect("IN");
    const listExpr = this.parseExpr();
    this.expect(";");
    const body = this.parseBlock();
    return {k:"foreach", varName, listExpr, body, line};
  }

  parseFun(){
    const line = this.cur().line;
    this.expect("FUN");
    const name = this.expect("IDENT").v;
    let retType = "auto";
    // optional return type: a TYPE keyword followed by an IDENT (the first param name)
    const TYPES = ["NUMERIC","TEXT","BOOL","LIST","OBJECT"];
    if (TYPES.includes(this.cur().t) && this.peek(1).t === "IDENT") {
      retType = this.next().v;
    }
    const params = [];
    // params: name type, name type, ... until ";"
    while (this.cur().t !== ";") {
      const pname = this.expect("IDENT").v;
      let ptype = "numeric";
      if (["NUMERIC","TEXT","BOOL","LIST","OBJECT"].includes(this.cur().t)) ptype = this.next().v;
      params.push({name:pname, type:ptype});
      if (this.cur().t === ",") this.next(); else break;
    }
    this.expect(";");
    const body = this.parseBlock();
    return {k:"fun", name, params, retType, body, line};
  }

  parseTry(){
    const line = this.cur().line;
    this.expect("TRY");
    this.expect(";");
    const body = this.parseBlock();
    this.skipNL();
    let errName = "err", catchBody = [];
    if (this.cur().t === "CATCH") {
      this.next();
      if (this.cur().t === "AS") { this.next(); errName = this.expect("IDENT").v; }
      this.expect(";");
      catchBody = this.parseBlock();
    }
    return {k:"try", body, errName, catchBody, line};
  }

  // ---- Expressions (precedence climbing) ----
  parseExpr(){ return this.parseOr(); }
  parseOr(){
    let l = this.parseAnd();
    while (this.cur().t === "OR") { this.next(); const r = this.parseAnd(); l = {k:"logic", op:"or", l, r}; }
    return l;
  }
  parseAnd(){
    let l = this.parseEquality();
    while (this.cur().t === "AND") { this.next(); const r = this.parseEquality(); l = {k:"logic", op:"and", l, r}; }
    return l;
  }
  parseEquality(){
    let l = this.parseCompare();
    while (["==","!="].includes(this.cur().t)) { const op = this.next().t; const r = this.parseCompare(); l = {k:"bin", op, l, r}; }
    return l;
  }
  parseCompare(){
    let l = this.parseAdd();
    while (["<",">","<=",">="].includes(this.cur().t)) { const op = this.next().t; const r = this.parseAdd(); l = {k:"bin", op, l, r}; }
    return l;
  }
  parseAdd(){
    let l = this.parseMul();
    while (["+","-"].includes(this.cur().t)) { const op = this.next().t; const r = this.parseMul(); l = {k:"bin", op, l, r}; }
    return l;
  }
  parseMul(){
    let l = this.parseUnary();
    while (["*","/","%"].includes(this.cur().t)) { const op = this.next().t; const r = this.parseUnary(); l = {k:"bin", op, l, r}; }
    return l;
  }
  parseUnary(){
    if (this.cur().t === "!" ) { this.next(); const e = this.parseUnary(); return {k:"not", e}; }
    if (this.cur().t === "-") { this.next(); const e = this.parseUnary(); return {k:"neg", e}; }
    return this.parsePostfix();
  }
  parsePostfix(){
    let e = this.parsePrimary();
    for(;;){
      if (this.cur().t === "[") {
        this.next(); const idx = this.parseExpr(); this.expect("]");
        e = {k:"index", obj:e, idx};
      } else if (this.cur().t === ".") {
        this.next(); const name = this.expect("IDENT").v;
        if (this.cur().t === "(") {
          this.next(); const args = this.parseArgs(); this.expect(")");
          e = {k:"methodcall", obj:e, name, args};
        } else {
          e = {k:"field", obj:e, name};
        }
      } else if (this.cur().t === "(" && e.k === "ident") {
        this.next(); const args = this.parseArgs(); this.expect(")");
        e = {k:"call", name:e.name, args};
      } else break;
    }
    return e;
  }
  parseArgs(){
    const args = [];
    if (this.cur().t === ")") return args;
    args.push(this.parseExpr());
    while (this.cur().t === ",") { this.next(); args.push(this.parseExpr()); }
    return args;
  }
  parsePrimary(){
    const tok = this.cur();
    if (tok.t === "NUM") { this.next(); return {k:"num", v:tok.v}; }
    if (tok.t === "STR") { this.next(); return {k:"str", v:tok.v}; }
    if (tok.t === "TRUE") { this.next(); return {k:"bool", v:true}; }
    if (tok.t === "FALSE") { this.next(); return {k:"bool", v:false}; }
    if (tok.t === "IDENT") { this.next(); return {k:"ident", name:tok.v}; }
    if (tok.t === "(") { this.next(); const e = this.parseExpr(); this.expect(")"); return e; }
    if (tok.t === "[") {
      this.next();
      const items = [];
      if (this.cur().t !== "]") {
        items.push(this.parseExpr());
        while (this.cur().t === ",") { this.next(); items.push(this.parseExpr()); }
      }
      this.expect("]");
      return {k:"list", items};
    }
    throw new AltairError("ALT_PARSE", `Expresión inesperada '${tok.t}' en la línea ${tok.line}`, tok.line);
  }
}

// ---------- INTERPRETER ----------
class ExitLoop {}
class ExitProgram {}
class ReturnSignal { constructor(v){ this.value = v; } }

class Scope {
  constructor(parent){ this.vars = new Map(); this.parent = parent; }
  get(name){
    if (this.vars.has(name)) return this.vars.get(name);
    if (this.parent) return this.parent.get(name);
    throw new AltairError("ALT0001", `Variable no definida: ${name}`);
  }
  set(name, val){
    let s = this;
    while (s) { if (s.vars.has(name)) { s.vars.set(name, val); return; } s = s.parent; }
    // fallback: set in current (used for globals fallback in functions)
    this.vars.set(name, val);
  }
  define(name, val){ this.vars.set(name, val); }
  has(name){
    let s = this;
    while (s) { if (s.vars.has(name)) return true; s = s.parent; }
    return false;
  }
}

class Interpreter {
  constructor(onLog){
    this.onLog = onLog || (()=>{});
    this.functions = new Map();
    this.global = new Scope(null);
    this.storagePrefix = "altair_playground:";
    this.stepCount = 0;
    this.maxSteps = 2_000_000; // safety net against infinite loops
  }

  run(src){
    const tokens = lex(src);
    const parser = new Parser(tokens);
    const program = parser.parseProgram();
    // hoist function declarations
    for (const stmt of program) if (stmt.k === "fun") this.functions.set(stmt.name, stmt);
    try {
      for (const stmt of program) this.exec(stmt, this.global);
    } catch (e) {
      if (e instanceof ExitProgram || e instanceof ExitLoop) return;
      throw e;
    }
  }

  tick(){
    this.stepCount++;
    if (this.stepCount > this.maxSteps) throw new AltairError("ALT_LIMIT", "Se alcanzó el límite de pasos de ejecución (¿bucle infinito?)");
  }

  storageGet(tier, name){
    if (tier === "ram" || tier === "temp" || tier === "auto") return undefined; // handled by scope
    try {
      const raw = localStorage.getItem(this.storagePrefix + tier + ":" + name);
      return raw != null ? JSON.parse(raw) : undefined;
    } catch { return undefined; }
  }
  storageSet(tier, name, val){
    if (tier === "ram" || tier === "temp" || tier === "auto") return;
    try { localStorage.setItem(this.storagePrefix + tier + ":" + name, JSON.stringify(val)); } catch {}
  }

  exec(stmt, scope){
    this.tick();
    switch (stmt.k) {
      case "define": {
        let val = stmt.init ? this.eval(stmt.init, scope) : this.defaultFor(stmt.type);
        if (stmt.storage === "disk" || stmt.storage === "cache") {
          const existing = this.storageGet(stmt.storage, stmt.name);
          if (existing !== undefined && !stmt.init) val = existing;
          this.storageSet(stmt.storage, stmt.name, val);
        }
        scope.define(stmt.name, {value: val, type: stmt.type, storage: stmt.storage, isConst: stmt.isConst});
        return;
      }
      case "assign": {
        const box = this.resolveLValueBox(stmt.target, scope);
        let rhs = this.eval(stmt.rhs, scope);
        if (stmt.op !== "=") {
          const cur = this.readLValue(stmt.target, scope);
          rhs = this.applyOp(stmt.op.slice(0,1), cur, rhs);
        }
        this.writeLValue(stmt.target, scope, rhs);
        return;
      }
      case "log": {
        const v = this.eval(stmt.e, scope);
        this.onLog(this.stringify(v));
        return;
      }
      case "exprstmt": {
        this.eval(stmt.e, scope);
        return;
      }
      case "if": {
        for (const c of stmt.clauses) {
          if (this.truthy(this.eval(c.cond, scope))) {
            this.execBlock(c.body, new Scope(scope));
            return;
          }
        }
        if (stmt.elseBody) this.execBlock(stmt.elseBody, new Scope(scope));
        return;
      }
      case "while": {
        try {
          while (this.truthy(this.eval(stmt.cond, scope))) {
            this.tick();
            this.execBlock(stmt.body, new Scope(scope));
          }
        } catch (e) { if (!(e instanceof ExitLoop)) throw e; }
        return;
      }
      case "repeat": {
        const count = this.eval(stmt.count, scope);
        try {
          for (let i=0; i<count; i++) { this.tick(); this.execBlock(stmt.body, new Scope(scope)); }
        } catch (e) { if (!(e instanceof ExitLoop)) throw e; }
        return;
      }
      case "forever": {
        try {
          while (true) { this.tick(); this.execBlock(stmt.body, new Scope(scope)); }
        } catch (e) { if (!(e instanceof ExitLoop)) throw e; }
        return;
      }
      case "foreach": {
        const list = this.eval(stmt.listExpr, scope);
        if (!Array.isArray(list)) throw new AltairError("ALT0002", "foreach requiere una lista");
        try {
          for (const item of list) {
            this.tick();
            const s2 = new Scope(scope);
            s2.define(stmt.varName, {value:item, type:"auto"});
            this.execBlock(stmt.body, s2);
          }
        } catch (e) { if (!(e instanceof ExitLoop)) throw e; }
        return;
      }
      case "exit": {
        // exits nearest loop if inside one; interpreter distinguishes via try/catch chain
        throw new ExitLoop();
      }
      case "release": {
        return; // no-op in playground
      }
      case "fun": {
        this.functions.set(stmt.name, stmt);
        return;
      }
      case "return": {
        const v = stmt.e ? this.eval(stmt.e, scope) : null;
        throw new ReturnSignal(v);
      }
      case "try": {
        try {
          this.execBlock(stmt.body, new Scope(scope));
        } catch (e) {
          if (e instanceof ExitLoop || e instanceof ReturnSignal || e instanceof ExitProgram) throw e;
          const s2 = new Scope(scope);
          const errObj = {code: e.code || "ALT_ERROR", message: e.message || String(e), line: e.line || 0};
          s2.define(stmt.errName, {value: errObj, type:"object"});
          this.execBlock(stmt.catchBody, s2);
        }
        return;
      }
      case "nop": return;
      default:
        throw new AltairError("ALT_PARSE", "Sentencia no soportada: " + stmt.k);
    }
  }

  execBlock(stmts, scope){
    for (const s of stmts) this.exec(s, scope);
  }

  defaultFor(type){
    if (type === "numeric") return 0;
    if (type === "text") return "";
    if (type === "bool") return false;
    if (type === "list") return [];
    return null;
  }

  truthy(v){ return v === true || (typeof v === "number" && v !== 0) || (typeof v === "string" && v.length>0) ? !!v || v === true : !!v; }

  applyOp(op, a, b){
    switch(op){
      case "+": if (typeof a === "string" || typeof b === "string") return this.stringify(a) + this.stringify(b);
                if (Array.isArray(a) && Array.isArray(b)) return a.concat(b);
                return a + b;
      case "-": return a - b;
      case "*": return a * b;
      case "/": if (b === 0) throw new AltairError("ALT0003", "División por cero"); return a / b;
      case "%": if (b === 0) throw new AltairError("ALT0003", "División por cero"); return a % b;
    }
  }

  eval(node, scope){
    this.tick();
    switch (node.k) {
      case "num": return node.v;
      case "str": return node.v;
      case "bool": return node.v;
      case "list": return node.items.map(it => this.eval(it, scope));
      case "ident": {
        const box = scope.get(node.name);
        return box.value;
      }
      case "neg": return -this.eval(node.e, scope);
      case "not": return !this.truthy(this.eval(node.e, scope));
      case "logic": {
        const l = this.truthy(this.eval(node.l, scope));
        if (node.op === "and") return l && this.truthy(this.eval(node.r, scope));
        return l || this.truthy(this.eval(node.r, scope));
      }
      case "bin": {
        const l = this.eval(node.l, scope), r = this.eval(node.r, scope);
        switch(node.op){
          case "+": case "-": case "*": case "/": case "%": return this.applyOp(node.op, l, r);
          case "==": return l === r;
          case "!=": return l !== r;
          case "<": return l < r;
          case ">": return l > r;
          case "<=": return l <= r;
          case ">=": return l >= r;
        }
      }
      case "index": {
        const obj = this.eval(node.obj, scope);
        const idx = this.eval(node.idx, scope);
        if (!Array.isArray(obj)) throw new AltairError("ALT0002", "Índice sobre valor que no es lista");
        if (idx < 0 || idx >= obj.length) throw new AltairError("ALT0002", "Índice fuera de rango");
        return obj[idx];
      }
      case "field": {
        const obj = this.eval(node.obj, scope);
        if (node.name === "length" && Array.isArray(obj)) return obj.length;
        if (obj && typeof obj === "object") return obj[node.name];
        throw new AltairError("ALT0002", `Campo no soportado: ${node.name}`);
      }
      case "methodcall": {
        const objNode = node.obj;
        const obj = this.eval(objNode, scope);
        const args = node.args.map(a => this.eval(a, scope));
        if (Array.isArray(obj)) {
          switch(node.name){
            case "append": obj.push(args[0]); this.syncLValueStorage(objNode, scope, obj); return null;
            case "remove": obj.splice(args[0], 1); this.syncLValueStorage(objNode, scope, obj); return null;
            case "clear": obj.length = 0; this.syncLValueStorage(objNode, scope, obj); return null;
            case "length": return obj.length;
          }
        }
        throw new AltairError("ALT0002", `Método no soportado: ${node.name}`);
      }
      case "call": {
        const fn = this.functions.get(node.name);
        if (!fn) throw new AltairError("ALT0001", `Función no definida: ${node.name}`);
        const args = node.args.map(a => this.eval(a, scope));
        const fscope = new Scope(this.global); // globals accessible, per language spec bugfix #4
        fn.params.forEach((p, i) => fscope.define(p.name, {value: args[i], type: p.type}));
        try {
          this.execBlock(fn.body, fscope);
        } catch (e) {
          if (e instanceof ReturnSignal) return e.value;
          throw e;
        }
        return null;
      }
      default:
        throw new AltairError("ALT_PARSE", "Expresión no soportada: " + node.k);
    }
  }

  // Resolve assignment targets: ident, index, field
  readLValue(node, scope){ return this.eval(node, scope); }

  writeLValue(node, scope, val){
    if (node.k === "ident") {
      let s = scope;
      while (s) { if (s.vars.has(node.name)) { 
        const box = s.vars.get(node.name);
        if (box.isConst) throw new AltairError("ALT0005", `No se puede reasignar constante: ${node.name}`);
        box.value = val;
        if (box.storage === "disk" || box.storage === "cache") this.storageSet(box.storage, node.name, val);
        return;
      } s = s.parent; }
      scope.define(node.name, {value: val, type:"auto"});
      return;
    }
    if (node.k === "index") {
      const obj = this.eval(node.obj, scope);
      const idx = this.eval(node.idx, scope);
      obj[idx] = val;
      this.syncLValueStorage(node.obj, scope, obj);
      return;
    }
    throw new AltairError("ALT_PARSE", "Destino de asignación no soportado");
  }

  syncLValueStorage(node, scope, val){
    if (node.k === "ident") {
      let s = scope;
      while (s) { if (s.vars.has(node.name)) {
        const box = s.vars.get(node.name);
        box.value = val;
        if (box.storage === "disk" || box.storage === "cache") this.storageSet(box.storage, node.name, val);
        return;
      } s = s.parent; }
    }
  }

  resolveLValueBox(node, scope){ return null; }

  stringify(v){
    if (v === null || v === undefined) return "null";
    if (typeof v === "boolean") return v ? "true" : "false";
    if (Array.isArray(v)) return "[" + v.map(x=>this.stringify(x)).join(", ") + "]";
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  }
}

// Export for use in playground.html
window.AltairInterpreter = Interpreter;
window.AltairError = AltairError;
