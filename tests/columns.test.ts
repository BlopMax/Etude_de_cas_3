import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { Column } from '../src/models/Column.js';
import { createTestUser, getAuthToken, createTestColumn } from './helpers.js';
import './setup.js';

const app = createApp();

describe('Columns Routes /api/columns', () => {
  let authToken: string;

  beforeEach(async () => {
    const user = await createTestUser();
    authToken = getAuthToken(user);
  });

  describe('GET /api/columns', () => {
    it("Retourne une liste vide avec le code 200 lorsqu'il n'y a pas de colonnes", async () => {
      const response = await request(app)
        .get('/api/columns')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Columns retrieved successfully');
      expect(response.body.data).toEqual([]);
    });

    it("Retourne les colonnes avec la structure attendue, triées par position", async () => {
      await createTestColumn('Second', 1);
      await createTestColumn('First', 0);

      const response = await request(app)
        .get('/api/columns')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data.map((c: { name: string }) => c.name)).toEqual([
        'First',
        'Second',
      ]);
      expect(response.body.data[0]).toMatchObject({ name: 'First', position: 0 });
      expect(response.body.data[0]).toHaveProperty('_id');
      expect(response.body.data[0]).toHaveProperty('createdAt');
    });

    it("Retourne une erreur 401 sans token", async () => {
      const response = await request(app).get('/api/columns');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/columns', () => {
    it("Crée une colonne, retourne 201 avec la structure attendue et l'insère dans la base de données", async () => {
      const response = await request(app)
        .post('/api/columns')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Colonne de Test' });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message', 'Column created successfully');
      expect(response.body.data).toMatchObject({ name: 'Colonne de Test', position: 0 });
      expect(response.body.data).toHaveProperty('_id');

      const columnInDb = await Column.findById(response.body.data._id);
      expect(columnInDb).not.toBeNull();
      expect(columnInDb?.name).toBe('Colonne de Test');
      expect(await Column.countDocuments()).toBe(1);
    });

    it("Retourne une erreur 400 et n'insère rien lorsque le nom est manquant", async () => {
      const response = await request(app)
        .post('/api/columns')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(await Column.countDocuments()).toBe(0);
    });

    it("Retourne une erreur 401 sans token", async () => {
      const response = await request(app)
        .post('/api/columns')
        .send({ name: 'Colonne interdite' });

      expect(response.status).toBe(401);
      expect(await Column.countDocuments()).toBe(0);
    });
  });
});