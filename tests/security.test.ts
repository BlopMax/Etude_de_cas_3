import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createTestUser, getAuthToken } from './helpers.js';
import './setup.js';

const app = createApp();
const routes = ['/api/columns', '/api/ofs'];

describe('Sécurité', () => {
  it('helmet enlève X-Powered-By et ajoute nosniff sur /health', async () => {
    const response = await request(app).get('/health');

    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('helmet marche aussi sur /api/auth/login (erreur 400)', async () => {
    const response = await request(app).post('/api/auth/login').send({});

    expect(response.status).toBe(400);
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it.each(routes)('%s sans token renvoie 401, avec les en-têtes helmet', async (route) => {
    const response = await request(app).get(route);

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('No token provided');
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it.each(routes)('%s avec un faux token renvoie 401', async (route) => {
    const response = await request(app).get(route).set('Authorization', 'Bearer faux-token');

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Invalid or expired token');
  });

  it.each(routes)('%s avec un vrai token renvoie 200', async (route) => {
    const token = getAuthToken(await createTestUser());
    const response = await request(app).get(route).set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
  });
});
