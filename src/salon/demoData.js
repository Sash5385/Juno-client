// Вигадані дані салону для демо клієнта (?app=salon&demo=1): клієнтка Ірина Шевченко (demo-client). Firebase не чіпається.
import { toYMD, addDays, daySlotDocs, timeToMin, minToTime, slotIdOf } from '../utils/salonLogic'

export function buildSalonDemoTree() {
  const now = Date.now(), today = toYMD(new Date()), d1 = addDays(today, 1), d2 = addDays(today, 2)
  const wh = Array.from({ length: 7 }, () => ({ from: '09:00', to: '19:00', off: false }))
  const mine = (id, o) => ({ id, clientUid: 'demo-client', clientName: 'Ірина Шевченко', phone: '+380671234567', status: 'confirmed', paymentMethod: 'onsite', durationMin: 60, createdAt: now - 86400000, ...o })
  const bookings = {
    u1: mine('u1', { masterId: 'm1', serviceId: 's2', serviceName: 'Манікюр з покриттям', price: 700, durationMin: 90, date: d1, time: '12:00', paymentMethod: 'online', paymentStatus: 'deposit_paid', paidAmount: 210, clientConfirmed: false }),
    u2: mine('u2', { masterId: 'm2', serviceId: 's1', serviceName: 'Жіноча стрижка', price: 550, date: d2, time: '15:00', status: 'pending', paymentMethod: 'online', createdAt: now - 4 * 60000 }),
    u3: mine('u3', { masterId: 'm1', serviceId: 's2', serviceName: 'Манікюр з покриттям', price: 700, durationMin: 90, date: addDays(today, -3), time: '11:00', status: 'completed' }),
    u4: mine('u4', { masterId: 'm2', serviceId: 's1', serviceName: 'Жіноча стрижка', price: 550, date: addDays(today, -6), time: '16:00', status: 'cancelled', cancelledBy: 'client' }),
    x1: { id: 'x1', clientUid: 'other', masterId: 'm1', serviceName: 'Чужий запис', price: 500, durationMin: 60, date: d1, time: '10:00', status: 'confirmed' },
  }
  const timeslots = {}
  for (const mid of ['m1', 'm2']) {
    timeslots[mid] = {}
    for (let i = 0; i < 12; i++) {
      const date = addDays(today, i - 1), day = daySlotDocs({ from: '09:00', to: '19:00' }, 30)
      for (const b of Object.values(bookings)) {
        if (b.masterId !== mid || b.date !== date || b.status === 'cancelled') continue
        for (let m = timeToMin(b.time); m < timeToMin(b.time) + b.durationMin; m += 30) if (day[slotIdOf(minToTime(m))]) day[slotIdOf(minToTime(m))].available = false
      }
      timeslots[mid][date] = day
    }
  }
  return {
    salon_slugs: { 'beauty-studio': { salonId: 'demo-salon' } },
    salons: { 'demo-salon': {
      profile: { name: 'Beauty Studio', slug: 'beauty-studio', phone: '+380441234567', address: 'Київ, вул. Хрещатик, 1', about: 'Стрижки, манікюр, догляд за волоссям і бородою', timezone: 'Europe/Kyiv', slotStep: 30,
        payment: { enabled: true, hasToken: true, tokenLast4: 'a1b2', depositPercent: 30, allowFull: true, holdMinutes: 15, cancelFreeHours: 24 } },
      masters: { m1: { profile: { name: 'Анна Мельник', spec: 'Майстер манікюру', active: true, order: 0, workHours: wh } }, m2: { profile: { name: 'Борис Литвин', spec: 'Барбер-стиліст', active: true, order: 1, workHours: wh } } },
      services: {
        s1: { name: 'Жіноча стрижка', category: 'Стрижка', price: 600, duration: 60, masterIds: { m1: true, m2: true }, masterPrices: { m2: 550 }, active: true },
        s2: { name: 'Манікюр з покриттям', category: 'Манікюр', price: 700, duration: 90, masterIds: { m1: true }, masterPrices: {}, active: true },
        s3: { name: 'Чоловіча стрижка', category: 'Стрижка', price: 450, duration: 60, masterIds: { m2: true }, masterPrices: {}, active: true },
      },
      users: { 'demo-client': { profile: { name: 'Ірина Шевченко', phone: '+380671234567', termsAccepted: true, createdAt: now - 30 * 86400000 } } },
      bookings, timeslots,
      notifications: { 'demo-client': {
        n1: { title: '✅ Запис підтверджено', body: `${d1} о 12:00 · Манікюр з покриттям`, type: 'booking_confirmed', ts: now - 3600000, date: '03.10.2026', time: '10:00' },
        n2: { title: '💳 Оплату отримано', body: `210 ₴ · ${d1} о 12:00`, type: 'payment', ts: now - 7200000, date: '03.10.2026', time: '09:00' },
      } },
      chatMeta: { 'demo-client': { name: 'Ірина Шевченко', lastMsg: 'Так, чекаємо вас!', lastTs: now - 1800000, unreadForClient: 1 } },
      chats: { 'demo-client': { c1: { from: 'client', text: 'Добрий день! Чи можна прийти на 10 хв раніше?', ts: now - 2400000, time: '10:20' }, c2: { from: 'admin', text: 'Так, чекаємо вас!', ts: now - 1800000, time: '10:30' } } },
    } },
  }
}
