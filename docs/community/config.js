
const SUPABASE_URL = "https://yxbdvaijcawzibijcxdv.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_cDwLZD6i0Cc2m0QdaDk_vg_Sxg6o8Wd";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Utilidad: formatea fechas relativas ("hace 3 min", "hace 2 días"...)
function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return "hace un momento";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  if (diff < 2592000) return `hace ${Math.floor(diff / 86400)} d`;
  return new Date(dateStr).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

// Utilidad: escapa HTML para evitar inyección al mostrar contenido de usuarios
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

// Utilidad: guarda/recupera el nombre de autor en localStorage para no pedirlo cada vez
function getAuthorName() {
  return localStorage.getItem("altair_author") || "";
}
function setAuthorName(name) {
  localStorage.setItem("altair_author", name);
}
