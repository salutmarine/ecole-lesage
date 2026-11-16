import * as Engine from './engine.mjs';

const HOUR = 3600000;
const clamp = (value, fallback, maximum) => Number.isFinite(Number(value)) ? Math.max(1, Math.min(maximum, Math.floor(Number(value)))) : fallback;
const instant = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? Engine.fromParisDateTime(value, '00:00') : new Date(value).toISOString();

/**
 * Read-only suggestions from the same rules as booking.create.
 * A productKey without enrollmentId previews a purchase made now, on a copy of
 * the state. Suggested times never hold places or create persistent credits.
 * from is inclusive; weekStart plus maxWeeks:1 restricts results to that week.
 */
export function findAvailableSlots(store, options = {}) {
  let eligibilityAt = null, searchedUntil = null;
  const result = (slots = [], reason = null, code = null) => ({slots, searchedUntil, eligibilityAt, reason, code});
  try {
    const state = store?.state;
    const catalog = store?.catalog25 || store?.catalog;
    const products = Array.isArray(catalog) ? catalog : catalog?.products || [];
    if (!state || !products.length) return result([], 'Le planning ne peut pas être consulté.', 'PLANNING_UNAVAILABLE');
    const nowISO = instant(store.now || state.clockISO || new Date());
    let planningState = state;
    let enrollment = state.enrollments?.find(item => item.id === options.enrollmentId);
    if (options.enrollmentId && !enrollment) return result([], 'Le droit de cours est introuvable.', 'ENROLLMENT_NOT_FOUND');
    if (!enrollment) {
      const product = products.find(item => String(item.key) === String(options.productKey) || item.ids?.map(String).includes(String(options.productKey)));
      if (!product) return result([], 'Ce cours n’est pas disponible dans le catalogue.', 'PRODUCT_NOT_FOUND');
      let studentId;
      if(store.profile===null||store.actor?.role==='guest'){
        // Anonymous visitors share the school's capacity, never a fixture student's
        // personal conflicts. The temporary record exists only in this projection.
        studentId='availability-preview-guest';
        while(state.students?.some(student=>student.id===studentId))studentId+='-';
        planningState={...state,students:[...(state.students||[]),{id:studentId,firstName:'Visitor',lastName:'Preview',email:'availability-preview@example.test',phone:'',language:'fr'}]};
      }else studentId=state.students?.find(item => item.id === store.actor?.studentId)?.id || state.students?.[0]?.id;
      if (!studentId) return result([], 'Choisissez un profil élève.', 'STUDENT_NOT_FOUND');
      planningState = Engine.applyAction(planningState, {
        type:'enrollment.add',
        payload:{studentId, productKey:product.key, purchasedAt:nowISO, source:'availability-preview'}
      }, {role:'admin', studentId}, nowISO, products);
      enrollment = planningState.enrollments.find(item => item.id === planningState.lastEnrollmentId);
    }
    const rules = Engine.getRules(planningState, enrollment.productKey, products);
    eligibilityAt = new Date(Date.parse(enrollment.purchasedAt) + rules.minPurchaseHours * HOUR).toISOString();
    const lowerBound = Math.max(Date.parse(nowISO), options.from ? Date.parse(instant(options.from)) : -Infinity);
    if (Date.parse(enrollment.expiresAt) <= lowerBound) return result([], 'La période de validité de ce cours est terminée.', 'EXPIRED');
    const used = planningState.bookings.filter(booking => booking.enrollmentId === enrollment.id && booking.status !== 'cancelled' && booking.id !== options.excludeBookingId).length;
    if (used >= enrollment.sessions) return result([], 'Toutes les séances de ce cours sont déjà réalisées ou planifiées.', 'NO_CREDIT');

    const limit = clamp(options.limit, 8, 100);
    const maxWeeks = clamp(options.maxWeeks, 12, 52);
    const earliest = Math.max(lowerBound, options.override ? -Infinity : Date.parse(eligibilityAt));
    const firstWeek = Engine.weekStartParis(options.weekStart || new Date(earliest).toISOString());
    const slots = [], seen = new Set();
    for (let index = 0; index < maxWeeks; index++) {
      const weekStart = Engine.addDays(firstWeek, index * 7);
      const weekEnd = Engine.fromParisDateTime(Engine.addDays(weekStart, 4), '19:00');
      searchedUntil = weekEnd;
      if (Date.parse(Engine.fromParisDateTime(weekStart, '09:00')) >= Date.parse(enrollment.expiresAt)) break;
      const week = Engine.getAvailability(planningState, {
        enrollmentId:enrollment.id, studentId:enrollment.studentId, weekStart,
        nowISO, catalog:products, excludeBookingId:options.excludeBookingId,
        override:options.override === true
      });
      for (const slot of week.slots) {
        if (slot.available && Date.parse(slot.start) >= lowerBound && !seen.has(slot.start)) {
          slots.push(slot);
          seen.add(slot.start);
          if (slots.length === limit) return result(slots);
        }
      }
    }
    if (slots.length) return result(slots);
    if (!options.override && searchedUntil && Date.parse(searchedUntil) <= Date.parse(eligibilityAt)) {
      return result([], `La première séance est possible ${rules.minPurchaseHours} h après l’achat.`, 'PURCHASE_DELAY');
    }
    return result([], 'Aucun créneau disponible dans la période consultée.', 'NO_AVAILABILITY');
  } catch (error) {
    return result([], error.message || 'Le planning ne peut pas être consulté.', error.code || 'PLANNING_UNAVAILABLE');
  }
}
