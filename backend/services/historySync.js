const Result = require('../models/Result');

function getStartOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getEndOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function isWeekday(date) {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

function computeSums(open3, close3) {
  const openSum = open3.split('').reduce((sum, d) => sum + parseInt(d, 10), 0);
  const closeSum = close3.split('').reduce((sum, d) => sum + parseInt(d, 10), 0);
  return { openSum, closeSum };
}

function boundTwoDigits(n) {
  const nn = ((n % 100) + 100) % 100;
  return nn.toString().padStart(2, '0');
}

function simpleInterpolate(prev, next) {
  // Prev/next are Result-like docs
  // Strategy: average doubles modulo 100; reuse prev.open3/close3 if unavailable
  const prevDouble = parseInt(prev.double, 10);
  const nextDouble = parseInt(next.double, 10);
  const midDouble = boundTwoDigits(Math.round((prevDouble + nextDouble) / 2));

  const middle = midDouble;
  // Heuristic: keep open3/close3 from the nearer neighbor by date
  const usePrev = Math.abs(prev.date - next.date) > 0 ? true : true;
  const open3 = (usePrev ? prev.open3 : next.open3) || prev.open3;
  const close3 = (usePrev ? prev.close3 : next.close3) || next.close3;
  const { openSum, closeSum } = computeSums(open3, close3);
  return { open3, middle, close3, double: middle, openSum, closeSum };
}

async function findNeighbors(targetDate) {
  const prev = await Result.findOne({ date: { $lt: targetDate } }).sort({ date: -1 }).lean();
  const next = await Result.findOne({ date: { $gt: targetDate } }).sort({ date: 1 }).lean();
  return { prev, next };
}

async function upsertEstimated(targetDate, strategy = 'neighbor-average') {
  const { prev, next } = await findNeighbors(targetDate);
  if (!prev || !next) return null;
  let est;
  if (strategy === 'neighbor-average') {
    est = simpleInterpolate(prev, next);
  } else {
    est = simpleInterpolate(prev, next);
  }
  const doc = {
    date: targetDate,
    ...est,
    finalNumber: null,
    source: 'estimated',
    scrapedAt: new Date(),
    isEstimated: true,
    estimatedFrom: 'neighbor-average'
  };

  const updated = await Result.findOneAndUpdate(
    { date: { $gte: getStartOfDay(targetDate), $lt: getEndOfDay(targetDate) } },
    doc,
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return updated;
}

async function fillMissingWeekdays({ lookbackDays = 60 } = {}) {
  const end = getStartOfDay(new Date());
  const start = getStartOfDay(new Date());
  start.setDate(end.getDate() - lookbackDays);

  const existing = await Result.find({ date: { $gte: start, $lte: end } })
    .sort({ date: 1 })
    .lean();

  const existingByDay = new Map(existing.map(r => [getStartOfDay(r.date).getTime(), r]));

  const created = [];
  const missing = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    if (isWeekday(cursor)) {
      const key = getStartOfDay(cursor).getTime();
      if (!existingByDay.has(key)) {
        missing.push(new Date(cursor));
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  for (const d of missing) {
    const est = await upsertEstimated(d, 'neighbor-average');
    if (est) created.push(est);
  }

  return { createdCount: created.length, missingCount: missing.length };
}

async function confirmIfRealArrives(realDoc) {
  if (!realDoc || !realDoc.date) return;
  const dayStart = getStartOfDay(realDoc.date);
  const dayEnd = getEndOfDay(realDoc.date);
  const existing = await Result.findOne({ date: { $gte: dayStart, $lt: dayEnd } });
  if (existing && existing.isEstimated) {
    // Overwrite with real values and mark confirmed
    existing.open3 = realDoc.open3;
    existing.middle = realDoc.middle;
    existing.close3 = realDoc.close3;
    existing.double = realDoc.double;
    const sums = computeSums(existing.open3, existing.close3);
    existing.openSum = sums.openSum;
    existing.closeSum = sums.closeSum;
    existing.isEstimated = false;
    existing.source = 'dpboss';
    existing.estimatedFrom = null;
    existing.confirmedAt = new Date();
    await existing.save();
  }
}

module.exports = {
  fillMissingWeekdays,
  confirmIfRealArrives,
};


