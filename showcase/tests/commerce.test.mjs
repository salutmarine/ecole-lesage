import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  createCommerceStore,
  readCommerce,
} from "../assets/commerce-store.mjs";
import { reservableSessions } from "../assets/course-calendar.mjs";
const catalog = JSON.parse(
  await readFile(new URL("../assets/platform/catalog.json", import.meta.url)),
);
const storage = () => {
  const items = new Map();
  return {
    getItem: (key) => items.get(key) || null,
    setItem: (key, value) => items.set(key, value),
  };
};
const billing = {
  firstName: "Marie",
  lastName: "Démo",
  email: "marie@example.test",
};

test("le panier persiste, les quantités et les totaux utilisent le catalogue", () => {
  const memory = storage(),
    store = createCommerceStore(catalog, memory);
  store.dispatch("cart.add", { productKey: "2579", qty: 2 });
  store.dispatch("cart.add", { productKey: "1752" });
  store.dispatch("cart.quantity", { productKey: "2579", qty: 3 });
  store.dispatch("cart.remove", { productKey: "1752" });
  assert.equal(createCommerceStore(catalog, memory).cartQuantity, 3);
  const order = store.dispatch("checkout", { billing, terms: true, total: 0 });
  assert.equal(order.status, "PAID_DEMO");
  assert.equal(order.total, catalog.find((p) => p.key === "2579").price * 3);
  assert.equal(store.cartQuantity, 0);
  assert.throws(
    () => store.dispatch("checkout", { billing, terms: true }),
    /vide/,
  );
  assert.equal(readCommerce(memory).orders.length, 1);
});
test("le paiement fictif valide les coordonnées et conserve la séance sans la réserver", () => {
  const memory = storage(),
    store = createCommerceStore(catalog, memory);
  store.setIntent("2579", "session-selectionnee");
  store.dispatch("cart.add", { productKey: "2579" });
  assert.throws(
    () => store.dispatch("checkout", { billing, terms: false }),
    /conditions/,
  );
  assert.throws(
    () =>
      store.dispatch("checkout", {
        billing: { ...billing, email: "invalide" },
        terms: true,
      }),
    /e-mail/,
  );
  assert.equal(store.cartQuantity, 1);
  const order = store.dispatch("checkout", { billing, terms: true });
  assert.equal(order.preferredSlotId, "session-selectionnee");
  assert.equal(order.items[0].productId, "2579");
  assert.equal(store.actor.studentId, order.studentId);
  assert.equal(readCommerce(memory).bookings, undefined);
});
test("un échec de stockage ne confirme aucun paiement", () => {
  let fail = false;
  const memory = storage();
  const store = createCommerceStore(catalog, {
    getItem: memory.getItem,
    setItem(...args) {
      if (fail) throw Error("quota");
      memory.setItem(...args);
    },
  });
  store.dispatch("cart.add", { productKey: "2579" });
  fail = true;
  assert.throws(
    () => store.dispatch("checkout", { billing, terms: true }),
    /stockage local/,
  );
  assert.equal(store.cartQuantity, 1);
  assert.equal(store.state.orders.length, 0);
});
test("le calendrier public exclut les séances passées, complètes, bloquées et trop proches de l’achat", () => {
  const slot = {
    id: "libre",
    startsAt: "2026-11-20T08:00:00Z",
    endsAt: "2026-11-20T11:00:00Z",
    capacity: 12,
    reserved: 4,
    blocked: false,
  };
  const planning = {
    slots: [
      slot,
      { ...slot, id: "plein", reserved: 12 },
      { ...slot, id: "bloque", blocked: true },
      { ...slot, id: "proche", startsAt: "2026-11-17T08:00:00Z" },
    ],
    blockouts: [],
  };
  assert.deepEqual(
    reservableSessions(
      planning,
      { validityMonths: 6 },
      new Date("2026-11-16T08:00:00Z"),
    ).map((s) => s.id),
    ["libre"],
  );
  planning.blockouts.push({ startsAt: slot.startsAt, endsAt: slot.endsAt });
  assert.equal(
    reservableSessions(planning, {}, new Date("2026-11-16T08:00:00Z")).length,
    0,
  );
});
