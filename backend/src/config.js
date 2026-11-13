const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });

const backendRoot = path.resolve(__dirname, '..');
const isTest = process.env.NODE_ENV === 'test';
const dbName = process.env.DB_NAME || 'booking';

module.exports = {
  isTest,
  port: Number(process.env.PORT) || 4000,
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173').split(',').map((s) => s.trim()),
  dataDir: path.resolve(backendRoot, process.env.DATA_DIR || '../hackathon-problem-3-group-travel-matcher'),
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'booking',
    password: process.env.DB_PASSWORD || 'booking',
    // Tests never touch the dev database: they use a separate one (default "<DB_NAME>_test").
    database: isTest ? process.env.DB_NAME_TEST || `${dbName}_test` : dbName,
  },
  // TASK-X4: S3-compatible storage (MinIO locally; real S3 works by changing these values).
  s3: {
    endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
    // Address the BROWSER uses for presigned links (differs from endpoint when the API runs inside Docker).
    publicEndpoint: process.env.S3_PUBLIC_ENDPOINT || process.env.S3_ENDPOINT || 'http://localhost:9000',
    region: process.env.S3_REGION || 'us-east-1',
    accessKeyId: process.env.S3_ACCESS_KEY || 'booking',
    secretAccessKey: process.env.S3_SECRET_KEY || 'booking-secret',
    bucket: isTest ? process.env.S3_BUCKET_TEST || 'group-photos-test' : process.env.S3_BUCKET || 'group-photos',
    linkTtlSeconds: Number(process.env.S3_LINK_TTL_SECONDS) || 3600,
  },
};
