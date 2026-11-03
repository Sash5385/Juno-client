import assert from 'node:assert/strict'
import * as L from '../../src/salon/logic.js'
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok  ' + name) }
const NOW = '2030-05-13 10:00'
t('reminder state', () => {
  assert.equal(L.reminderState(null, NOW), 'gone')
  assert.equal(L.reminderState({ date: '2030-05-14', time: '09:30', status: 'confirmed' }, NOW), 'open')
  assert.equal(L.reminderState({ date: '2030-05-14', time: '09:30', status: 'confirmed', clientConfirmed: true }, NOW), 'confirmed')
  assert.equal(L.reminderState({ date: '2030-05-14', time: '09:30', status: 'cancelled' }, NOW), 'cancelled')
  assert.equal(L.reminderState({ date: '2030-05-14', time: '09:30', cancelledBy: 'reschedule' }, NOW), 'cancelled')
  assert.equal(L.reminderState({ date: '2030-05-13', time: '09:00', status: 'confirmed' }, NOW), 'past')
  assert.equal(L.reminderState({ date: '2030-05-20', time: '09:00', status: 'completed' }, NOW), 'past')
})
t('can rate only completed, unrated, not cancelled', () => {
  assert.equal(L.canRate({ status: 'completed' }), true)
  assert.equal(L.canRate({ status: 'completed', rating: 4 }), false)
  assert.equal(L.canRate({ status: 'completed', rating: 9 }), true) // некоректну оцінку ігноруємо
  assert.equal(L.canRate({ status: 'confirmed' }), false)
  assert.equal(L.canRate({ status: 'completed', cancelledBy: 'admin' }), false)
  assert.equal(L.canRate(null), false)
})
t('reschedule request text and duplicates', () => {
  const b = { date: '2030-05-14', time: '09:30', serviceName: 'Стрижка' }
  assert.match(L.rescheduleText(b), /2030-05-14 о 09:30 \(Стрижка\)/)
  assert.equal(L.hasRescheduleRequest([{ kind: 'reschedule_request', bookingId: 'b1' }], 'b1'), true)
  assert.equal(L.hasRescheduleRequest([{ kind: 'reschedule_request', bookingId: 'b2' }, { kind: 'reminder', bookingId: 'b1' }], 'b1'), false)
})
t('nowYmdHm pads', () => assert.equal(L.nowYmdHm(new Date(2030, 0, 5, 7, 3)), '2030-01-05 07:03'))
console.log(`salonClient: ${n} OK`)
