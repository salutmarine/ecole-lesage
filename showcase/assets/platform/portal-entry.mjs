import {projectPublicCourseCatalog,canonicalCourseKey} from './course-public-catalog.mjs';

export const PORTAL_STATE_KEY = 'lesage.portal.demo.v1';
export const PORTAL_PENDING_CART_KEY = 'lesage.portal.pending-cart.v1';
const languages = new Set(['fr', 'en', 'ja']);
const record = value => !!value && typeof value === 'object' && !Array.isArray(value);
const courseKey = value => typeof value === 'string' && /^[a-z0-9-]{1,80}$/i.test(value);
const quantity = value => Math.max(1, Math.min(3, Math.round(Number(value) || 1)));
const canonicalKey = canonicalCourseKey;
function read(key) { try { return JSON.parse(globalThis.localStorage?.getItem(key) || 'null'); } catch { return null; } }
export function portalLanguage(pathname = globalThis.location?.pathname || '/') { return pathname.match(/^\/(fr|en|ja)(?:\/|$)/)?.[1] || 'fr'; }
export function portalUrl(view = '', params = {}, language = portalLanguage()) {
  const lang = languages.has(language) ? language : 'fr';
  const query = new URLSearchParams();
  if (view && !['account', 'home'].includes(view)) query.set('view', view === 'shop' ? 'catalog' : view);
  for (const key of ['productKey', 'studentId', 'enrollmentId', 'bookingId', 'date', 'tab', 'intent', 'returnView']) if (typeof params[key] === 'string' && params[key].length <= 200) query.set(key, params[key]);
  if (params.gift) query.set('gift', '1');
  return `/${lang}/${lang === 'fr' ? 'espace' : 'account'}/${query.size ? '?' + query : ''}`;
}
/** A bounded handoff, never a migration of legacy orders, profiles or rights. */
export function readPendingPortalCart() {
  const saved = read(PORTAL_PENDING_CART_KEY);
  if (!record(saved) || saved.version !== 1 || !Array.isArray(saved.items)) return [];
  const items = new Map();
  for (const item of saved.items.slice(0, 100)) {
    if (!record(item) || !courseKey(item.productKey) || !Number.isInteger(item.qty) || item.qty < 1 || item.qty > 3) continue;
    items.set(item.productKey, Math.min(3, (items.get(item.productKey) || 0) + item.qty));
  }
  return [...items].map(([productKey, qty]) => ({productKey, qty}));
}
export function stagePortalCart(productKey, qty = 1) {
  productKey = String(productKey || '');
  if (!courseKey(productKey)) throw new Error('Ce cours n’est plus disponible.');
  const items = readPendingPortalCart();
  const existing = items.find(item => item.productKey === productKey);
  if (existing) existing.qty = Math.min(3, existing.qty + quantity(qty));
  else items.push({productKey, qty:quantity(qty)});
  if (items.length > 25) throw new Error('Votre panier contient déjà 25 cours différents.');
  try { localStorage.setItem(PORTAL_PENDING_CART_KEY, JSON.stringify({version:1, items, updatedAt:new Date().toISOString()})); }
  catch { throw new Error('Le panier ne peut pas être enregistré. Autorisez le stockage local puis réessayez.'); }
  globalThis.window?.dispatchEvent(new CustomEvent('lesage:portal-change'));
  return items;
}
export function portalCartQuantity() {
  const portal = read(PORTAL_STATE_KEY)?.portal;
  const cart = record(portal?.c) && typeof portal.i === 'string' && record(portal.c[portal.i]) ? portal.c[portal.i] : {};
  const counts = new Map();
  for (const [key, qty] of Object.entries(cart)) if (courseKey(key) && Number.isInteger(qty) && qty > 0 && qty <= 3) counts.set(canonicalKey(key), qty);
  for (const item of readPendingPortalCart()) {
    const key = canonicalKey(item.productKey);
    counts.set(key, Math.min(3, (counts.get(key) || 0) + item.qty));
  }
  return [...counts.values()].reduce((sum, qty) => sum + qty, 0);
}
export function watchPortal(callback) {
  const storage = event => { if (!event.key || [PORTAL_STATE_KEY, PORTAL_PENDING_CART_KEY].includes(event.key)) callback(); };
  window.addEventListener('storage', storage);
  window.addEventListener('pageshow', callback);
  window.addEventListener('lesage:portal-change', callback);
  return () => { window.removeEventListener('storage', storage); window.removeEventListener('pageshow', callback); window.removeEventListener('lesage:portal-change', callback); };
}
export function portalDestination(href) {
  let url; try { url = new URL(href, location.href); } catch { return null; }
  if (url.origin !== location.origin) return null;
  let path; try { path = decodeURIComponent(url.pathname); } catch { return null; }
  const match = path.match(/^\/(fr|en|ja)\/(espace|account|my-account|mon-compte|私のアカウント|administration|professeur|teacher|panier|cart|カート|commande|checkout|チェックアウト)\/?$/);
  if (!match) return null;
  const [, lang, entry] = match, query = url.searchParams;
  const view = /^(panier|cart|カート)$/.test(entry) ? 'cart' : /^(commande|checkout|チェックアウト)$/.test(entry) ? 'checkout' : query.get('view') || '';
  const params = Object.fromEntries(query);
  params.gift = query.get('gift') === '1';
  return portalUrl(view, params, lang);
}
export function rewritePortalLinks(doc = document) {
  doc.querySelectorAll('a[href]').forEach(anchor => {
    const destination = portalDestination(anchor.getAttribute('href'));
    if (destination) anchor.href = destination;
  });
}
export function goToPortal(view = '', params = {}, language = portalLanguage(), replace = false) {
  const target = portalUrl(view, params, language);
  if (replace) location.replace(target); else location.assign(target);
}
/** Public catalogue projection: does not initialise or write the old demo store. */
export async function getPublicCatalogStore() {
  const response = await fetch('/assets/platform/catalog.json');
  if (!response.ok) throw new Error('Le catalogue ne peut pas être chargé. Actualisez la page.');
  const data = await response.json(),rawCatalog=Array.isArray(data)?data:Array.isArray(data?.products)?data.products:[],saved=read(PORTAL_STATE_KEY),settings=record(saved?.settings)?saved.settings:{};
  const catalog=projectPublicCourseCatalog(rawCatalog,settings.courses,{legacy:settings});
  return {
    catalog, state:null, profile:null, actor:{role:'guest'}, shoppingOwner:'guest-portal', shoppingCart:[],
    get now() { return new Date().toISOString(); },
    get cartQuantity() { return portalCartQuantity(); },
    product(key) { return catalog.find(product => String(product.key) === String(key) || product.ids?.map(String).includes(String(key))); },
    rules(key) { const product=catalog.find(p=>String(p.key)===String(key)||p.ids?.map(String).includes(String(key)));return {cancelHours:Number.isInteger(settings.booking?.cancelHours)&&settings.booking.cancelHours>=0&&settings.booking.cancelHours<=168?settings.booking.cancelHours:48,leadHours:(product?.leadDays??3)*24,purchaseLeadHours:product?.purchaseLeadHours??72,...(product?.spacing||{})}; },
    subscribe:watchPortal,
    navigate(view, params = {}) { window.dispatchEvent(new CustomEvent('lesage:navigate', {detail:{view, params}})); },
    dispatch(type, payload = {}) {
      if (type !== 'cart.add') throw new Error('Poursuivez cette action dans votre espace personnel.');
      const product=catalog.find(item=>String(item.key)===String(payload.productKey)||item.ids.includes(String(payload.productKey)));
      if(!product)throw new Error('Ce cours n’est plus disponible.');
      stagePortalCart(product.key, payload.qty);
      goToPortal('cart');
      return true;
    }
  };
}
