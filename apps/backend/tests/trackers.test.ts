import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/utils/prisma.js';

describe('Spending Tracker API', () => {
  const app = createApp();
  const userEmail = `tracker_user_${Date.now()}@fynly.test`;
  let token = '';
  let userId = '';
  let accountId = '';
  let trackerId = '';
  let firstExpenseId = '';

  const daysAgo = (days: number): string => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    date.setHours(12, 0, 0, 0);
    return date.toISOString();
  };

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: userEmail,
        password: 'Password123!',
        name: 'Tracker User',
      });

    token = res.body.data.tokens.accessToken;
    userId = res.body.data.user.id;

    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    accountId = meRes.body.data.accounts[0].id;
  });

  afterAll(async () => {
    if (userId) {
      await prisma.user.delete({ where: { id: userId } });
    }
  });

  it('creates a spending tracker', async () => {
    const res = await request(app)
      .post('/api/v1/trackers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Trip Spend', startedAt: daysAgo(3) });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Trip Spend');
    expect(res.body.data.isActive).toBe(true);
    expect(res.body.data.summary.totalPaise).toBe('0');

    trackerId = res.body.data.id;
  });

  it('rejects a second active tracker', async () => {
    const res = await request(app)
      .post('/api/v1/trackers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Another Tracker' });

    expect(res.status).toBe(409);
    expect(res.body.error.details.activeTrackerId).toBe(trackerId);
  });

  it('adds expenses linked to the tracker and updates account balance', async () => {
    const first = await request(app)
      .post(`/api/v1/trackers/${trackerId}/expenses`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId,
        amountPaise: 10000,
        description: 'Day one lunch',
        date: daysAgo(2),
      });

    expect(first.status).toBe(201);
    expect(first.body.data.transaction.trackerId).toBe(trackerId);
    expect(first.body.data.summary.totalPaise).toBe('10000');
    firstExpenseId = first.body.data.transaction.id;

    const second = await request(app)
      .post(`/api/v1/trackers/${trackerId}/expenses`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        amountPaise: 25050,
        description: 'Day three groceries',
        date: daysAgo(0),
      });

    expect(second.status).toBe(201);
    expect(second.body.data.summary.totalPaise).toBe('35050');
    expect(second.body.data.summary.expenseCount).toBe(2);
    expect(second.body.data.summary.activeDays).toBe(2);

    const account = await prisma.financialAccount.findUnique({
      where: { id: accountId },
    });
    expect(account?.balancePaise.toString()).toBe('-35050');
  });

  it('returns a detailed tracker summary grouped by day', async () => {
    const res = await request(app)
      .get(`/api/v1/trackers/${trackerId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.transactions).toHaveLength(2);
    expect(res.body.data.summary.dailyBreakdown).toHaveLength(2);
    expect(res.body.data.summary.durationDays).toBe(4);
    expect(res.body.data.summary.averagePerDayPaise).toBe('8762');
    expect(res.body.data.summary.averagePerActiveDayPaise).toBe('17525');
    expect(res.body.data.summary.highestSpendDay.totalPaise).toBe('25050');
  });

  it('ends the tracker and freezes further additions', async () => {
    const res = await request(app)
      .post(`/api/v1/trackers/${trackerId}/end`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(false);
    expect(res.body.data.endedAt).toBeTruthy();
    expect(res.body.data.summary.totalPaise).toBe('35050');

    const blocked = await request(app)
      .post(`/api/v1/trackers/${trackerId}/expenses`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amountPaise: 500, description: 'Too late' });

    expect(blocked.status).toBe(400);
  });

  it('deletes a tracker expense and reverses the balance', async () => {
    const res = await request(app)
      .delete(`/api/v1/trackers/${trackerId}/expenses/${firstExpenseId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.summary.totalPaise).toBe('25050');
    expect(res.body.data.summary.expenseCount).toBe(1);

    const account = await prisma.financialAccount.findUnique({
      where: { id: accountId },
    });
    expect(account?.balancePaise.toString()).toBe('-25050');
  });

  it('lists ended trackers with summary', async () => {
    const res = await request(app)
      .get('/api/v1/trackers?status=ended')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].summary.totalPaise).toBe('25050');
  });
});
