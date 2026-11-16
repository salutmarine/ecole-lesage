import {
  stagePortalCart,
  goToPortal,
  portalUrl,
} from "./platform/portal-entry.mjs";

const dateKey = (date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
export function reservableSessions(planning, product, now = new Date()) {
  const earliest =
    +now + Math.max(72, product.purchaseLeadHours || 72) * 3600000;
  const expires = new Date(now);
  expires.setMonth(expires.getMonth() + (product.validityMonths || 12));
  return planning.slots
    .filter(
      (slot) =>
        !slot.blocked &&
        +new Date(slot.startsAt) >= earliest &&
        new Date(slot.startsAt) < expires &&
        slot.reserved < slot.capacity &&
        !(planning.blockouts || []).some(
          (block) =>
            new Date(block.startsAt) < new Date(slot.endsAt) &&
            new Date(block.endsAt) > new Date(slot.startsAt),
        ),
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
export function mountCourseCalendar(root, store, productKey) {
  const product = store.product(productKey);
  if (!product) return () => {};
  const section = document.createElement("dialog");
  section.id = "showcase-calendar-panel";
  section.className = "showcase-course-calendar showcase-calendar-panel";
  section.setAttribute("aria-labelledby", "showcase-calendar-title");
  section.innerHTML =
    '<button type="button" class="showcase-calendar-close" data-calendar-close aria-label="Fermer le calendrier" autofocus>×</button><header class="showcase-calendar-heading"><span class="showcase-calendar-kicker">Réserver une séance</span><h2 id="showcase-calendar-title">Les séances réservables</h2><p class="showcase-calendar-subtitle">Consultez les disponibilités avant d’acheter votre cours. Les horaires sont indiqués à l’heure de Paris.</p></header><div data-calendar-content aria-live="polite"><p>Chargement du calendrier…</p></div>';
  document.body.append(section);
  const opener = document.createElement("button");
  opener.type = "button";
  opener.className = "shop-text-link showcase-calendar-open";
  opener.textContent = "Voir les séances réservables";
  opener.setAttribute("aria-haspopup", "dialog");
  opener.setAttribute("aria-controls", section.id);
  opener.setAttribute("aria-expanded", "false");
  let previousOverflow = null;
  function restore() {
    if (previousOverflow !== null) {
      document.body.style.overflow = previousOverflow;
      previousOverflow = null;
    }
    opener.setAttribute("aria-expanded", "false");
  }
  function close() {
    if (section.open) section.close();
    restore();
  }
  opener.addEventListener("click", () => {
    if (section.open) return;
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    opener.focus({ preventScroll: true });
    section.showModal();
    opener.setAttribute("aria-expanded", "true");
  });
  section.addEventListener("close", restore);
  window.addEventListener("pagehide", close);
  root.querySelector("[data-purchase-main]")?.after(opener);
  let disposed = false,
    planning,
    slots = [],
    month = "",
    day = "";
  const content = section.querySelector("[data-calendar-content]");
  const controller = new AbortController();
  const time = (value) =>
    new Date(value).toLocaleTimeString("fr-FR", {
      timeZone: "Europe/Paris",
      hour: "2-digit",
      minute: "2-digit",
    });
  function render() {
    if (!slots.length) {
      content.innerHTML =
        "<p>Aucune séance réservable pour le moment. Consultez de nouveau le calendrier prochainement.</p>";
      return;
    }
    const first = new Date(`${month}-01T12:00:00Z`),
      last = new Date(
        Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
      ).getUTCDate();
    const offset = (first.getUTCDay() + 6) % 7;
    const byDay = new Map();
    for (const slot of slots) {
      const key = dateKey(new Date(slot.startsAt));
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key).push(slot);
    }
    const cells = [...Array(offset)].map(() => "<span></span>");
    for (let number = 1; number <= last; number++) {
      const key = `${month}-${String(number).padStart(2, "0")}`;
      const count = byDay.get(key)?.length || 0;
      cells.push(
        `<button type="button" data-calendar-day="${key}" ${count ? "" : "disabled"} aria-pressed="${day === key}" aria-label="${number} ${first.toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" })}, ${count} séances disponibles"><strong>${number}</strong>${count ? `<small>${count} séances</small>` : ""}</button>`,
      );
    }
    const daySlots = byDay.get(day) || [];
    const owned = store.state.orders.some(
      (order) =>
        (order.beneficiaryStudentId || order.studentId) ===
          store.actor.studentId &&
        order.items.some((item) => item.productKey === String(product.key)),
    );
    content.innerHTML = `<nav class="showcase-calendar-nav" aria-label="Choisir un mois"><button type="button" data-calendar-shift="-1" ${month <= slots[0].startsAt.slice(0, 7) ? "disabled" : ""} aria-label="Mois précédent">←</button><h3>${escape(first.toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }))}</h3><button type="button" data-calendar-shift="1" ${month >= slots.at(-1).startsAt.slice(0, 7) ? "disabled" : ""} aria-label="Mois suivant">→</button></nav><div class="showcase-calendar-grid">${["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((label) => `<span>${label}</span>`).join("")}${cells.join("")}</div><h3>${escape(new Date(`${day}T12:00:00Z`).toLocaleDateString("fr-FR", { dateStyle: "full", timeZone: "UTC" }))}</h3><ul class="showcase-calendar-sessions">${daySlots.map((slot) => `<li><div><strong>${time(slot.startsAt)} à ${time(slot.endsAt)}</strong><span>${slot.capacity - slot.reserved} places disponibles</span></div><button type="button" class="shop-button shop-button-dark" data-calendar-buy="${escape(slot.id)}">${owned ? "Réserver cette séance dans mon planning" : "Acheter un cours pour faire cette séance"}</button></li>`).join("")}</ul><p class="shop-summary-note">Le choix d’une séance ne bloque pas de place. La réservation sera confirmée dans le planning après l’achat fictif. Première séance au moins ${Math.max(72, product.purchaseLeadHours || 72)} h après l’achat.</p>`;
  }
  async function refresh() {
    const response = await fetch("/assets/planning-availability.json", {
      signal: controller.signal,
    });
    if (!response.ok) throw Error("Le calendrier ne peut pas être chargé.");
    planning = await response.json();
    try {
      const saved = JSON.parse(
        localStorage.getItem(planning.storageKey) || "null",
      );
      if (
        saved?.version === 6 &&
        Array.isArray(saved.slots) &&
        Array.isArray(saved.bookings)
      )
        planning = {
          ...planning,
          slots: saved.slots,
          blockouts: saved.blockouts || [],
        };
    } catch {}
    slots = reservableSessions(planning, product);
    month = slots[0]?.startsAt.slice(0, 7) || "";
    day = slots[0] ? dateKey(new Date(slots[0].startsAt)) : "";
    if (!disposed) render();
  }
  section.addEventListener("click", (event) => {
    if (event.target === section) {
      const bounds = section.getBoundingClientRect();
      if (
        event.clientX < bounds.left ||
        event.clientX > bounds.right ||
        event.clientY < bounds.top ||
        event.clientY > bounds.bottom
      )
        close();
    }
    const target = event.target.closest("button");
    if (!target) return;
    if (target.hasAttribute("data-calendar-close")) {
      close();
      return;
    }
    if (target.dataset.calendarDay) {
      day = target.dataset.calendarDay;
      render();
      content
        .querySelector(`[data-calendar-day="${day}"]`)
        ?.focus({ preventScroll: true });
    }
    if (target.dataset.calendarShift) {
      const value = new Date(`${month}-01T12:00:00Z`);
      value.setUTCMonth(
        value.getUTCMonth() + Number(target.dataset.calendarShift),
      );
      month = value.toISOString().slice(0, 7);
      day = slots.find((slot) =>
        dateKey(new Date(slot.startsAt)).startsWith(month),
      )
        ? dateKey(
            new Date(
              slots.find((slot) =>
                dateKey(new Date(slot.startsAt)).startsWith(month),
              ).startsAt,
            ),
          )
        : `${month}-01`;
      render();
      content
        .querySelector("button:not(:disabled)")
        ?.focus({ preventScroll: true });
    }
    if (target.dataset.calendarBuy) {
      try {
        const owned = store.state.orders.some(
          (order) =>
            (order.beneficiaryStudentId || order.studentId) ===
              store.actor.studentId &&
            order.items.some((item) => item.productKey === String(product.key)),
        );
        if (owned) {
          const url = new URL(portalUrl("courses"), location.origin);
          url.searchParams.set("showcaseSlot", target.dataset.calendarBuy);
          location.assign(url);
        } else {
          store.setIntent(product.key, target.dataset.calendarBuy);
          stagePortalCart(product.key, 1);
          goToPortal("cart");
        }
      } catch (error) {
        let message = section.querySelector('[role="alert"]');
        if (!message) {
          message = document.createElement("p");
          message.setAttribute("role", "alert");
          section.append(message);
        }
        message.textContent = error.message;
      }
    }
  });
  refresh().catch((error) => {
    if (!disposed && error.name !== "AbortError")
      content.textContent = error.message;
  });
  return () => {
    disposed = true;
    controller.abort();
    close();
    window.removeEventListener("pagehide", close);
    section.remove();
    opener.remove();
  };
}
