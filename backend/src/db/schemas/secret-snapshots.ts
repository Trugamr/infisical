// Code generated by automation script, DO NOT EDIT.
// Automated by pulling database and generating zod schema
// To update. Just run npm run generate:schema
// Written by akhilmhdh.

import { z } from "zod";

import { TImmutableDBKeys } from "./models";

export const SecretSnapshotsSchema = z.object({
  id: z.string().uuid(),
  envId: z.string().uuid(),
  folderId: z.string().uuid(),
  parentFolderId: z.string().uuid().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export type TSecretSnapshots = z.infer<typeof SecretSnapshotsSchema>;
export type TSecretSnapshotsInsert = Omit<TSecretSnapshots, TImmutableDBKeys>;
export type TSecretSnapshotsUpdate = Partial<Omit<TSecretSnapshots, TImmutableDBKeys>>;
