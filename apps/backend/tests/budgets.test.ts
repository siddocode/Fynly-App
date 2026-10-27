import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/utils/prisma.js';
import {
  getPeriodBoundaries,
  calculateSafeToSpend,
  calculateBudgetUsage,
} from '../src/utils/budget.utils.js';

describe('Budget Calculations & Date Boundaries (Unit Tests)', () => {
  it('calculates DAILY boundaries correctly', () => {
    const testDate = new Date('2026-10-25T15:30:00.000Z');
    const boundaries = getPeriodBoundaries('DAILY', testDate);

    expect(boundaries.totalDays).toBe(1);
    expect(boundaries.remainingDays).toBe(1);
    expect(boundaries.startDate.getHours()).toBe(0);
    expect(boundaries.endDate.getHours()).toBe(23);
  });

  it('calculates MONTHLY boundaries including accurate month length', () => {
    // January has 31 days
    const janDate = new Date('2026-01-15T12:00:00.000Z');
    const jan = getPeriodBoundaries('MONTHLY', janDate);
    expect(jan.totalDays).toBe(31);
    expect(jan.startDate.getDate()).toBe(1);
    expect(jan.endDate.getDate()).toBe(31);
    expect(jan.remainingDays).toBe(31 - 15 + 1); // 17 days

    // February in non-leap year (2025) has 28 days
    const febDate = new Date('2025-02-10T12:00:00.000Z');
    const feb = getPeriodBoundaries('MONTHLY', febDate);
    expect(feb.totalDays).toBe(28);

    // February in leap year (2024) has 29 days
    const leapFeb = new Date('2024-02-10T12:00:00.000Z');
    const leap = getPeriodBoundaries('MONTHLY', leapFeb);
    expect(leap.totalDays).toBe(29);
  });

  it('calculates safe-to-spend accurately in integer paise', () => {
    // ₹3,000.00 (300000 paise) across 10 remaining days -> ₹300.00 (30000 paise)
    expect(calculateSafeToSpend(300000n, 10)).toBe(30000n);

    // Zero remaining budget -> 0 paise
    expect(calculateSafeToSpend(0n, 10)).toBe(0n);

    // Negative remaining budget (overspent) -> 0 paise
    expect(calculateSafeToSpend(-50000n, 10)).toBe(0n);

    // 1 day remaining -> full remaining amount
    expect(calculateSafeToSpend(150000n, 1)).toBe(150000n);
  });

  it('determines budget status and thresholds correctly', () => {
    // 50% spent
    const onTrack = calculateBudgetUsage(100000n, 50000n);
    expect(onTrack.usagePercentage).toBe(50);
    expect(onTrack.status).toBe('ON_TRACK');

    // 75% spent (>= 70%)
    const warn70 = calculateBudgetUsage(100000n, 75000n);
    expect(warn70.usagePercentage).toBe(75);
    expect(warn70.status).toBe('WARNING_70');

    // 92% spent (>= 90%)
    const warn90 = calculateBudgetUsage(100000n, 92000n);
    expect(warn90.usagePercentage).toBe(92);
    expect(warn90.status).toBe('WARNING_90');

    // 105% spent (>= 100%)
    const exceeded = calculateBudgetUsage(100000n, 105000n);
    expect(exceeded.usagePercentage).toBe(105);
    expect(exceeded.status).toBe('EXCEEDED');
  });
});

describe('Budget & Dashboard API (Integration Tests)', () => {
  const app = createApp();
  const testEmail = `budget_user_${Date.now()}@fynly.test`;
  let token = '';
  let userId = '';
  let accountId = '';
  let categoryId = '';

  beforeAll(async () => {
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: testEmail,
        password: 'Password123!',
        name: 'Budget Master',
      });

    token = regRes.body.data.tokens.accessToken;
    userId = regRes.body.data.user.id;

    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    accountId = meRes.body.data.accounts[0].id;

    const catRes = await request(app)
      .get('/api/v1/categories')
      .set('Authorization', `Bearer ${token}`);

    categoryId = catRes.body.data[0].id;
  });

  afterAll(async () => {
    if (userId) {
      await prisma.user.delete({ where: { id: userId } });
    }
  });

  it('POST /api/v1/budgets creates a monthly budget with category allocation', async () => {
    const res = await request(app)
      .post('/api/v1/budgets')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'October Monthly Allowance',
        period: 'MONTHLY',
        limitPaise: 5000000, // ₹50,000.00
        categories: [
          {
            categoryId,
            limitPaise: 1500000, // ₹15,000.00
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('October Monthly Allowance');
    expect(res.body.data.categories.length).toBe(1);
  });

  it('GET /api/v1/budgets returns budget with live spending tracking', async () => {
    // Add an expense within current month
    await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId,
        categoryId,
        type: 'EXPENSE',
        amountPaise: 1000000, // ₹10,000.00
        description: 'Monthly Dining Out',
        date: new Date().toISOString(),
      });

    const res = await request(app)
      .get('/api/v1/budgets')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);

    const budget = res.body.data[0];
    expect(BigInt(budget.spentPaise)).toBeGreaterThanOrEqual(1000000n);
    expect(budget).toHaveProperty('safeToSpendTodayPaise');
    expect(budget).toHaveProperty('periodDetails');
    expect(budget.categories.length).toBe(1);
    expect(BigInt(budget.categories[0].spentPaise)).toBeGreaterThanOrEqual(1000000n);
  });

  it('GET /api/v1/dashboard/summary returns consolidated financial state', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('totalBalancePaise');
    expect(res.body.data).toHaveProperty('todaySpentPaise');
    expect(res.body.data).toHaveProperty('monthSpentPaise');
    expect(res.body.data).toHaveProperty('safeToSpendTodayPaise');
    expect(res.body.data).toHaveProperty('budget');
    expect(res.body.data.topCategories.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.recentTransactions.length).toBeGreaterThanOrEqual(1);
  });
});
