import type { CatalogItemRow } from '$lib/db/types';

export type HeroStep = 1 | 2 | 3;

export type StepConfig = {
  step: HeroStep;
  type: 'character' | 'role' | 'scene';
  title: string;
  icon: string;
  pageSize: number;
  hasAvatar: boolean;
};

export const STEP_CONFIG: Record<HeroStep, StepConfig> = {
  1: { step: 1, type: 'character', title: 'Выберите персонажа (вы играете)', icon: 'fa-user', pageSize: 20, hasAvatar: true },
  2: { step: 2, type: 'role',     title: 'Выберите роль персонажа', icon: 'fa-briefcase', pageSize: 20, hasAvatar: false },
  3: { step: 3, type: 'scene',    title: 'Выберите мир или сцену', icon: 'fa-globe', pageSize: 20, hasAvatar: false }
};

export type StepFilters = {
  search: string;
  selectedTags: string[];
  onlyCustom: boolean;
  sortByDate: boolean;
  activeLetter: string | null;
};

export type StepRuntime = {
  items: CatalogItemRow[];
  allTags: string[];
  allLetters: string[];
  hasMore: boolean;
  isLoading: boolean;
  page: number;
};

export type HeroSelections = {
  1: CatalogItemRow | null;
  2: CatalogItemRow | null;
  3: CatalogItemRow | null;
};

export type HeroCatalogState = {
  ready: boolean;
  step: HeroStep;
  selections: HeroSelections;
  filters: Record<HeroStep, StepFilters>;
  runtime: Record<HeroStep, StepRuntime>;
};