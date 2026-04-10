import { createReadStream, createWriteStream } from 'node:fs';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

let r2Client: S3Client | null = null;

function getR2Client(): S3Client {
  if (!r2Client) {
    r2Client = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT ?? '',
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
      },
    });
  }
  return r2Client;
}

const bucket = () => process.env.R2_BUCKET_NAME ?? 'nuit-one';

export async function downloadFromR2(key: string, destPath: string): Promise<void> {
  const command = new GetObjectCommand({ Bucket: bucket(), Key: key });
  const response = await getR2Client().send(command);
  if (!response.Body) throw new Error(`Empty response for key: ${key}`);
  const writable = createWriteStream(destPath);
  await pipeline(response.Body as Readable, writable);
}

export async function uploadToR2(key: string, filePath: string, contentType: string): Promise<void> {
  const stream = createReadStream(filePath);
  const command = new PutObjectCommand({
    Bucket: bucket(),
    Key: key,
    Body: stream,
    ContentType: contentType,
  });
  await getR2Client().send(command);
}

export async function getDownloadUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: bucket(), Key: key });
  return getSignedUrl(getR2Client(), command, { expiresIn: 3600 });
}

export async function deleteR2Objects(prefix: string): Promise<void> {
  let continuationToken: string | undefined;

  do {
    const listResult = await getR2Client().send(
      new ListObjectsV2Command({
        Bucket: bucket(),
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );

    const objects = listResult.Contents;
    if (!objects || objects.length === 0) break;

    await getR2Client().send(
      new DeleteObjectsCommand({
        Bucket: bucket(),
        Delete: { Objects: objects.map((o) => ({ Key: o.Key })) },
      }),
    );

    continuationToken = listResult.IsTruncated ? listResult.NextContinuationToken : undefined;
  } while (continuationToken);
}
