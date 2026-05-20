import type { SessionMode, SessionRow, CatalogItemRow } from '$lib/db/types';

export type ImportCharacter = {
  key: string;              // стабильный ключ для UI
  name: string;
  description: string;
  avatar?: string;
  source?: CatalogItemRow | any;
};

export type ImportRole = {
  key: string;
  name: string;
  description: string;
  source?: CatalogItemRow | any;
};

export type ImportScene = {
  name: string;
  description: string;
  source?: CatalogItemRow | any;
};

export type ImportPreview = {
  mode: SessionMode;
  title: string;
  characters: ImportCharacter[];
  roles: ImportRole[];
  scene: ImportScene | null;
  generatedScript: string;
  rawSession: SessionRow;
};

export type ParseImportResult =
  | { ok: true; preview: ImportPreview }
  | { ok: false; message: string };