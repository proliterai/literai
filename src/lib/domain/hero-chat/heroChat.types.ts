export type Role = 'system' | 'user' | 'assistant';

export type MsgVersion = {
  content: string;
  createdAt: string;
};

export type ChatMessage = {
  id: string;
  role: Role;
  content: string;
  createdAt: string;
  versions?: MsgVersion[];
  activeVersion?: number;
  isEdited?: boolean;
  isError?: boolean;
};

export type Branch = {
  id: string;
  name: string;
  messages: ChatMessage[];
  createdAt: string;
  partId: string;
  parentBranchId?: string | null;
  forkPoint?: number | null;
};

export type PartSummaryRef = { partName: string; summary: string };

export type ChatPart = {
  id: string;
  partNumber: number;
  name: string;
  summary: string;
  previousSummaries: PartSummaryRef[];
  branchIds: string[];
  createdAt: string;
};

export type HeroSelectedItems = {
  heroCharacter: any;
  heroRole: any;
  scene: any;
};

export type ChatTree = {
  branches: Branch[];
  activeBranchIndex: number;
};

export type HeroChatState = {
  sessionId: string | null;
  title: string;
  selectedItems: HeroSelectedItems | null;
  generatedScript: string;
  chatTree: ChatTree;
  chatParts: ChatPart[];
  currentPartIndex: number;
  isSummarizing: boolean;
  isRerolling: boolean;
  isGenerating: boolean;
  analyticsData: any | null;
  mapData: any | null;
};

export type HeroChatSessionRow = {
  id: string;
  mode: 'hero';  // <-- важно
  title: string;
  selectedItems: HeroSelectedItems | null;
  generatedScript: string;
  chatTree: ChatTree;
  chatParts: ChatPart[];
  currentPartIndex: number;
  analyticsData: any | null;
  mapData?: any;
  systemPromptData?: any;
  cheatmodeData?: any;
  lorebookData?: any;
  createdAt: string;
  updatedAt: string;
};