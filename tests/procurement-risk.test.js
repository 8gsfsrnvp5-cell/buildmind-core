'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

const engine = require(
  path.resolve(
    __dirname,
    '..',
    'procurementRiskEngine.js'
  )
);


assert.equal(
  engine.version,
  'procurement-risk-v2.1'
);


const deficit = engine.calculate(
  {
    name: 'Труба 76',
    unit: 'м',
    need: 5800,
    stock: 0,
    reserved: 3000,
    confirmed: 3000,
    deliveryDate: '2026-07-10',
    leadDays: 1
  },
  {
    startDate: '2026-07-30',
    safetyDays: 2
  },
  '2026-07-09'
);

assert.equal(deficit.code, 'deficit');
assert.equal(deficit.level, 'critical');
assert.equal(deficit.free, 0);
assert.equal(deficit.available, 3000);
assert.equal(deficit.deficit, 2800);
assert.equal(
  engine.formatDate(deficit.needDate),
  '2026-07-28'
);
assert.equal(
  engine.formatDate(deficit.orderDeadline),
  '2026-07-27'
);
assert.ok(deficit.categories.includes('order'));


const coveredByStock = engine.calculate(
  {
    unit: 'шт',
    need: 100,
    stock: 150,
    reserved: 50,
    confirmed: 0,
    leadDays: 10
  },
  {
    startDate: '2026-08-10',
    safetyDays: 2
  },
  '2026-08-27'
);

assert.equal(
  coveredByStock.code,
  'ok',
  'Просроченная расчётная дата заказа не должна создавать риск, если свободного склада достаточно.'
);


const lateDelivery = engine.calculate(
  {
    unit: 'шт',
    need: 100,
    stock: 0,
    reserved: 0,
    confirmed: 100,
    deliveryDate: '2026-09-12',
    leadDays: 3
  },
  {
    startDate: '2026-09-10',
    safetyDays: 2
  },
  '2026-08-27'
);

assert.equal(
  lateDelivery.code,
  'delivery-after-need'
);
assert.equal(lateDelivery.level, 'critical');
assert.ok(lateDelivery.categories.includes('delayed'));


const deliveryDateMissing = engine.calculate(
  {
    unit: 'шт',
    need: 100,
    stock: 20,
    reserved: 0,
    confirmed: 80,
    deliveryDate: '',
    leadDays: 3
  },
  {
    startDate: '2026-09-10',
    safetyDays: 2
  },
  '2026-08-27'
);

assert.equal(
  deliveryDateMissing.code,
  'delivery-date-missing'
);
assert.equal(
  deliveryDateMissing.level,
  'warning'
);


const overdueDelivery = engine.calculate(
  {
    unit: 'шт',
    need: 100,
    stock: 20,
    reserved: 0,
    confirmed: 80,
    deliveryDate: '2026-08-20',
    leadDays: 3
  },
  {
    startDate: '2026-09-10',
    safetyDays: 2
  },
  '2026-08-27'
);

assert.equal(
  overdueDelivery.code,
  'delivery-overdue'
);
assert.equal(overdueDelivery.level, 'critical');


const missingSchedule = engine.calculate(
  {
    unit: 'шт',
    need: 10,
    stock: 10
  },
  {},
  '2026-08-27'
);

assert.equal(
  missingSchedule.code,
  'missing-schedule'
);
assert.equal(missingSchedule.level, 'critical');


console.log(
  'BuildMind procurement risk test: PASS'
);

