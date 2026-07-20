import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { env } from '../config/env';

const client = env.storageEnabled
  ? new S3Client({
      region: env.s3Region,
      endpoint: env.s3Endpoint || undefined,
      forcePathStyle: env.s3ForcePathStyle,
      credentials: {
        accessKeyId: env.s3AccessKeyId,
        secretAccessKey: env.s3SecretAccessKey,
      },
    })
  : null;

function requireClient() {
  if (!client) {
    throw new Error(
      'Armazenamento de arquivos não configurado. Configure as variáveis S3 no servidor.'
    );
  }

  return client;
}

export async function createDocumentUploadUrl(input: {
  key: string;
  mimeType: string;
}) {
  return getSignedUrl(
    requireClient(),
    new PutObjectCommand({
      Bucket: env.s3Bucket,
      Key: input.key,
      ContentType: input.mimeType,
    }),
    { expiresIn: 10 * 60 }
  );
}

export async function createDocumentDownloadUrl(key: string) {
  return getSignedUrl(
    requireClient(),
    new GetObjectCommand({
      Bucket: env.s3Bucket,
      Key: key,
    }),
    { expiresIn: 10 * 60 }
  );
}

