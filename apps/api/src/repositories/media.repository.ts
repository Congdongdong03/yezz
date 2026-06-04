import { mediaAssets, type Db } from "@yezz/db";

export type MediaAssetCreateInput = {
  objectKey: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  uploadedById?: string | null;
};

export function createMediaRepository(db: Db) {
  return {
    async create(input: MediaAssetCreateInput) {
      const [row] = await db
        .insert(mediaAssets)
        .values({
          objectKey: input.objectKey,
          url: input.url,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          uploadedById: input.uploadedById ?? null,
        })
        .returning();
      return row;
    },
  };
}
