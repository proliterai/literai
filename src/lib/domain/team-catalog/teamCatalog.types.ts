import type { CatalogItemRow } from '$lib/db/types';

export type TeamStep = 1 | 2;

export type StepConfig = {
  step: TeamStep;
  type: 'character' | 'scene';
  title: string;
  icon: string;
  pageSize: number;
  hasAvatar: boolean;
};

export const STEP_CONFIG: Record<TeamStep, StepConfig> = {
  1: { step: 1, type: 'character', title: 'Выберите персонажей (до 10)', icon: 'fa-users', pageSize: 20, hasAvatar: true },
  2: { step: 2, type: 'scene', title: 'Выберите мир или сцену', icon: 'fa-globe', pageSize: 20, hasAvatar: false }
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

export type TeamSelections = {
  1: CatalogItemRow[];    // массив выбранных персонажей
  2: CatalogItemRow | null;
};

export type TeamCatalogState = {
  ready: boolean;
  step: TeamStep;
  selections: TeamSelections;
  filters: Record<TeamStep, StepFilters>;
  runtime: Record<TeamStep, StepRuntime>;
};