/**
 * Mock Data for Testing
 * Provides sample data for unit and property-based tests
 */

export const mockUsers = [
  {
    id: 1,
    name: 'Alice Johnson',
    email: 'alice@example.com',
    created_at: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 2,
    name: 'Bob Smith',
    email: 'bob@example.com',
    created_at: '2024-01-02T00:00:00.000Z',
  },
  {
    id: 3,
    name: 'Charlie Brown',
    email: 'charlie@example.com',
    created_at: '2024-01-03T00:00:00.000Z',
  },
];

export const mockKVData = {
  'config:theme': 'dark',
  'config:language': 'en',
  'user:preferences': JSON.stringify({ notifications: true, theme: 'dark' }),
  'cache:data': JSON.stringify({ timestamp: Date.now(), value: 'cached' }),
};

export const mockR2Files = [
  {
    key: 'documents/report.pdf',
    size: 1024000,
    contentType: 'application/pdf',
  },
  {
    key: 'images/logo.png',
    size: 50000,
    contentType: 'image/png',
  },
  {
    key: 'data/export.json',
    size: 2048,
    contentType: 'application/json',
  },
];
