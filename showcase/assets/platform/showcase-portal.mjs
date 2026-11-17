import { projectPublicCourseCatalog } from "./course-public-catalog.mjs";
import { createCommerceStore, readCommerce } from "../commerce-store.mjs";

let store;
export function portalLanguage() {
  return "fr";
}
export function portalUrl(view = "", params = {}) {
  const base = window.Showcase.base;
  if (view === "cart") return `${base}/panier/`;
  if (view === "checkout")
    return `${base}/commande/${params.gift ? "?gift=1" : ""}`;
  if (view === "confirmation")
    return `${base}/commande/?confirmation=${encodeURIComponent(params.orderId || "")}`;
  const data = readCommerce();
  const order = data.orders.at(-1);
  return order
    ? `${window.Showcase.planning}?showcaseOrder=${encodeURIComponent(order.id)}#/student`
    : window.Showcase.planning;
}
export function portalDestination(href) {
  let url;
  try {
    url = new URL(href, location.href);
  } catch {
    return null;
  }
  if (url.origin !== location.origin) return null;
  const planning = new URL(window.Showcase.planning, location.href);
  if (url.pathname.replace(/\/$/, "") === planning.pathname.replace(/\/$/, ""))
    return url.href;
  const path = url.pathname.replace(window.Showcase.base, "");
  if (/^\/(?:fr\/)?(espace|account)\/?$/.test(path)) return portalUrl();
  return null;
}
export function portalCartQuantity() {
  return readCommerce().cart.reduce(
    (sum, item) => sum + Number(item.qty || 0),
    0,
  );
}
export function rewritePortalLinks(doc = document) {
  doc.querySelectorAll("a[href]").forEach((anchor) => {
    const target = portalDestination(anchor.href);
    if (target) anchor.href = target;
  });
}
export function watchPortal(callback) {
  const changed = () => callback();
  for (const event of ["storage", "pageshow", "lesage:portal-change"])
    window.addEventListener(event, changed);
  return () => {
    for (const event of ["storage", "pageshow", "lesage:portal-change"])
      window.removeEventListener(event, changed);
  };
}
export function stagePortalCart(productKey, qty = 1) {
  if (!store)
    throw Error("Le catalogue est en cours de chargement. Réessayez.");
  store.dispatch("cart.add", { productKey, qty: Number(qty) });
}
export function goToPortal(
  view = "",
  params = {},
  language = "fr",
  replace = false,
) {
  const url = portalUrl(view, params);
  if (replace) location.replace(url);
  else location.assign(url);
}
export async function getPublicCatalogStore() {
  if (store) return store;
  const response = await fetch("/assets/platform/catalog.json");
  if (!response.ok) throw Error("Le catalogue ne peut pas être chargé.");
  store = createCommerceStore(
    projectPublicCourseCatalog(await response.json()),
    localStorage,
    () => window.dispatchEvent(new Event("lesage:portal-change")),
  );
  store.subscribe = watchPortal;
  store.navigate = (view, params = {}) =>
    window.dispatchEvent(
      new CustomEvent("lesage:navigate", { detail: { view, params } }),
    );
  return store;
}
