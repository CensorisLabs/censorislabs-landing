import test from 'node:test';
import { strict as assert } from 'node:assert/strict';
import { dailyTargets, buildPlan, planSummary, currentTarget, dayStatus } from '../src/lib/plan.js';
import { addDays, weekday } from '../src/lib/dates.js';

test('first target is exactly one page and ends at total', () => {
  const targets = dailyTargets(250, 'medium');
  assert.equal(targets[0], 1);
  assert.equal(targets.reduce((a, b) => a + b, 0), 250);
  const expectedLast = 250 - targets.slice(0, -1).reduce((a, b) => a + b, 0);
  assert.equal(targets[targets.length - 1], expectedLast);
});

test('medium difficulty targets climb to 25 and reach total', () => {
  const targets = dailyTargets(120, 'medium');
  assert.equal(targets[0], 1);
  for (let i = 1; i < targets.length; i++) {
    assert.ok(targets[i] >= targets[i - 1]);
    assert.ok(targets[i] <= 25);
  }
  assert.equal(targets.reduce((a, b) => a + b, 0), 120);
});

test('dense difficulty targets stay low and reach total', () => {
  const targets = dailyTargets(60, 'dense');
  assert.equal(targets[0], 1);
  assert.ok(targets.every((t) => t <= 8));
  assert.equal(targets.reduce((a, b) => a + b, 0), 60);
});

test('hard plan starts at one page and ends at total and uses reading days', () => {
  const plan = buildPlan({
    totalPages: 80,
    startDate: '2026-06-01',
    difficulty: 'hard',
    readingDays: [1, 3, 5],
    fromPage: 0,
  });
  assert.equal(plan.days[0].pages, 1);
  assert.ok(plan.days.every((d) => d.pages >= 1));
  assert.equal(plan.days.reduce((a, b) => a + b.pages, 0), 80);
  assert.ok(plan.days.every((d) => weekday(d.date) === 1 || weekday(d.date) === 3 || weekday(d.date) === 5));
});

test('plan summary tracks completion after full read', () => {
  const plan = buildPlan({ totalPages: 10, startDate: '2026-01-01', difficulty: 'easy', readingDays: [0, 1, 2, 3, 4, 5, 6], fromPage: 0 });
  const summary = planSummary(plan, 4, '2026-01-03');
  assert.equal(summary.doneCount, 1);
  assert.equal(summary.finished, false);
  assert.equal(summary.overduePages, 1);
  const second = planSummary(plan, 10, '2026-01-13');
  assert.equal(second.finished, true);
  assert.equal(second.doneCount, 3);
});
