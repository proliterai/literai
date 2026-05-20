// ================================================================================
// ФАЙЛ: src/lib/domain/chat/chat.types.ts
// ================================================================================

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

export type SelectedItems = {
  systemCharacter: any;
  systemRole: any;
  userCharacter: any;
  userRole: any;
  scene: any;
};

export type ChatTree = {
  branches: Branch[];
  activeBranchIndex: number;
};

export type ChatState = {
  sessionId: string | null;
  title: string;
  selectedItems: SelectedItems | null;
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

export type ChatSessionRow = {
  id: string;
  title: string;
  selectedItems: SelectedItems | null;
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