export const COMMERCE_KEY = "lesage.showcase.commerce.v1";
const empty = () => ({
  version: 1,
  cart: [],
  orders: [],
  customer: null,
  activeStudentId: null,
  intent: null,
});
export function readCommerce(storage = globalThis.localStorage) {
  try {
    const value = JSON.parse(storage.getItem(COMMERCE_KEY) || "null");
    if (
      value?.version === 1 &&
      Array.isArray(value.cart) &&
      Array.isArray(value.orders)
    )
      return value;
  } catch {}
  return empty();
}
export function createCommerceStore(
  catalog,
  storage = globalThis.localStorage,
  notify = () => {},
) {
  let data = readCommerce(storage);
  const product = (key) =>
    catalog.find(
      (item) =>
        String(item.key) === String(key) ||
        item.ids?.map(String).includes(String(key)),
    );
  const persist = (next) => {
    try {
      storage.setItem(COMMERCE_KEY, JSON.stringify(next));
    } catch {
      throw Error(
        "Autorisez le stockage local de ce navigateur pour conserver votre panier et votre achat fictif.",
      );
    }
    data = next;
    notify();
  };
  const students = () => [
    ...new Map(
      data.orders
        .flatMap((order) => [order.buyer, order.beneficiary].filter(Boolean))
        .concat(data.customer ? [data.customer] : [])
        .map((student) => [student.id, student]),
    ).values(),
  ];
  const store = {
    catalog,
    product,
    shoppingOwner: "showcase-shopper",
    get shoppingCart() {
      return data.cart;
    },
    get cartQuantity() {
      return data.cart.reduce((sum, item) => sum + item.qty, 0);
    },
    get state() {
      return { orders: data.orders, students: students() };
    },
    get actor() {
      return data.activeStudentId
        ? { role: "student", studentId: data.activeStudentId }
        : { role: "guest" };
    },
    get profile() {
      return data.activeStudentId
        ? { studentId: data.activeStudentId, source: "guest-purchase" }
        : null;
    },
    get now() {
      return new Date().toISOString();
    },
    rules(key) {
      return {
        cancelHours: 48,
        purchaseLeadHours: Math.max(72, product(key)?.purchaseLeadHours || 72),
      };
    },
    setIntent(productKey, slotId) {
      persist({ ...data, intent: { productKey: String(productKey), slotId } });
    },
    openGiftProfile(studentId) {
      if (!students().some((student) => student.id === studentId))
        throw Error("Élève introuvable.");
      persist({ ...data, activeStudentId: studentId });
    },
    dispatch(type, payload = {}) {
      const next = structuredClone(data);
      if (type.startsWith("cart.")) {
        const course = product(payload.productKey);
        if (!course) throw Error("Ce cours n’est plus disponible.");
        const index = next.cart.findIndex(
          (item) => item.productKey === String(course.key),
        );
        if (type === "cart.remove")
          next.cart = next.cart.filter(
            (item) => item.productKey !== String(course.key),
          );
        else {
          const qty = Number(payload.qty ?? 1);
          if (!Number.isInteger(qty) || qty < 1 || qty > 99)
            throw Error("Choisissez une quantité entre 1 et 99.");
          const total =
            type === "cart.add" ? (next.cart[index]?.qty || 0) + qty : qty;
          if (total > 99) throw Error("La quantité maximale est de 99 cours.");
          const item = { productKey: String(course.key), qty: total };
          if (index < 0) next.cart.push(item);
          else next.cart[index] = item;
        }
      } else if (type === "checkout") {
        if (!next.cart.length) throw Error("Votre panier est vide.");
        if (!payload.terms) throw Error("Acceptez les conditions de vente.");
        const person = (value, id) => {
          const firstName = String(value?.firstName || "").trim(),
            lastName = String(value?.lastName || "").trim(),
            email = String(value?.email || "")
              .trim()
              .toLowerCase();
          if (
            !firstName ||
            !lastName ||
            firstName.length > 100 ||
            lastName.length > 100 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
            email.length > 254
          )
            throw Error("Vérifiez votre nom et votre adresse e-mail.");
          return {
            id,
            firstName,
            lastName,
            email,
            phone: String(value?.phone || "").slice(0, 40),
          };
        };
        const buyer = person(
          payload.billing,
          next.customer?.id || `showcase-student-${crypto.randomUUID()}`,
        );
        const beneficiary = payload.beneficiary
          ? person(
              payload.beneficiary,
              `showcase-student-${crypto.randomUUID()}`,
            )
          : null;
        const items = next.cart.map((item) => {
          const course = product(item.productKey);
          if (!course) throw Error("Un cours du panier n’est plus disponible.");
          return {
            productKey: String(course.key),
            productId: String(course.variants.fr.id),
            qty: item.qty,
            unitPrice: Number(course.price),
            name: course.variants.fr.name,
          };
        });
        const id = crypto.randomUUID();
        const order = {
          id,
          number: `DEMO-${id.slice(0, 8).toUpperCase()}`,
          status: "PAID_DEMO",
          createdAt: new Date().toISOString(),
          studentId: buyer.id,
          buyerStudentId: buyer.id,
          beneficiaryStudentId: beneficiary?.id,
          buyer,
          beneficiary,
          items,
          total:
            Math.round(
              items.reduce((sum, item) => sum + item.unitPrice * item.qty, 0) *
                100,
            ) / 100,
          preferredSlotId: items.some(
            (item) => item.productKey === next.intent?.productKey,
          )
            ? next.intent.slotId
            : null,
          preferredProductKey: next.intent?.productKey || null,
        };
        next.customer = buyer;
        next.activeStudentId = buyer.id;
        next.orders.push(order);
        next.cart = [];
        next.intent = null;
        persist(next);
        return order;
      } else throw Error("Action indisponible.");
      persist(next);
      return true;
    },
  };
  return store;
}
