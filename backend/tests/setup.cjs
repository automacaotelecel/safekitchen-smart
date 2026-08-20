// Keep the test suite self-contained without reading development or production secrets.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ||= 'postgresql://test:test@127.0.0.1:5432/safekitchen_test';
process.env.JWT_SECRET ||= 'test-jwt-secret-not-for-production-only';
