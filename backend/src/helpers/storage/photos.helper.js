// Object storage for group photos (X4). The ONLY file that talks to S3 / MinIO.
// Works with any S3-compatible service; MinIO needs path-style URLs (http://host:9000/bucket/key).
const { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand, HeadBucketCommand, CreateBucketCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { s3 } = require('../../config');

const clientFor = (endpoint) => new S3Client({
  endpoint,
  region: s3.region,
  forcePathStyle: true,
  credentials: { accessKeyId: s3.accessKeyId, secretAccessKey: s3.secretAccessKey },
});

const client = clientFor(s3.endpoint);
// Presigned links are signed for the address the browser will use.
const publicClient = s3.publicEndpoint === s3.endpoint ? client : clientFor(s3.publicEndpoint);

let bucketReady = null;
/** Creates the bucket on first use if it doesn't exist yet (docker-compose normally creates it). */
function ensureBucket() {
  bucketReady ??= (async () => {
    try {
      await client.send(new HeadBucketCommand({ Bucket: s3.bucket }));
    } catch (error) {
      if (error?.$metadata?.httpStatusCode !== 404 && error?.name !== 'NotFound') throw error;
      await client.send(new CreateBucketCommand({ Bucket: s3.bucket }));
    }
  })().catch((error) => { bucketReady = null; throw error; });
  return bucketReady;
}

async function put(key, body, contentType) {
  await ensureBucket();
  await client.send(new PutObjectCommand({ Bucket: s3.bucket, Key: key, Body: body, ContentType: contentType, CacheControl: 'private, max-age=3600' }));
}

async function remove(key) {
  await client.send(new DeleteObjectCommand({ Bucket: s3.bucket, Key: key }));
}

/** True when the object exists (used by tests and cleanup). */
async function exists(key) {
  try {
    await client.send(new HeadObjectCommand({ Bucket: s3.bucket, Key: key }));
    return true;
  } catch (error) {
    if (error?.$metadata?.httpStatusCode === 404 || error?.name === 'NotFound') return false;
    throw error;
  }
}

/** A time-limited GET link the browser can use in <img src> while the bucket stays private. */
function signedUrl(key, ttlSeconds = s3.linkTtlSeconds) {
  return getSignedUrl(publicClient, new GetObjectCommand({ Bucket: s3.bucket, Key: key }), { expiresIn: ttlSeconds });
}

module.exports = { ensureBucket, put, remove, exists, signedUrl, linkTtlSeconds: s3.linkTtlSeconds };
