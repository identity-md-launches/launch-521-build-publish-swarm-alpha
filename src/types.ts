export interface SiteRecord {
  id: string;
  jobId?: string | null;
  kind?: string;
  tokenId?: string | number | null;
  agentId?: string | null;
  url?: string | null;
  status?: string;
  label?: string;
  cid?: string | null;
  ensName?: string | null;
  createdAt?: string;
  updatedAt?: string;
  namedAt?: string | null;
  pinnedAt?: string | null;
  supersededBy?: string | null;
  takenDownAt?: string | null;
  takenDownReason?: string | null;
  [key: string]: unknown;
}
export interface JobRecord {
  id: string;
  objective?: string;
  originalRequest?: string | null;
  state?: string;
  createdAt?: string;
  updatedAt?: string;
  project?: Record<string, unknown> | null;
  [key: string]: unknown;
}
export interface WorkflowRecord {
  id: string;
  objective?: string;
  frontendJobId?: string;
  contractsJobId?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}
export interface Snapshot {
  checkedAt: string;
  coverage: Record<string, unknown>;
  sites: SiteRecord[];
  jobs: JobRecord[];
  workflows: WorkflowRecord[];
  [key: string]: unknown;
}
export interface Agent {
  tokenId?: string | number;
  agentId?: string;
  role: string;
  profile?: string;
  avatar?: string;
  ownerEvidence?: string;
  avatarSource?: string;
  owner?: string;
  ownerSource?: string;
  ownerCheckedAt?: string;
  workUrl?: string;
  type?: string;
}
export interface Contract {
  address: string;
  role: string;
  network: string;
  explorer?: string;
  source?: string;
  verification?: string;
}
export interface PromiseRecord {
  promise: string;
  status: "Delivered" | "Partial" | "Pending" | "Broken" | "Unverified";
  evidence: string;
  source?: string;
  deliveredAt?: string;
  checkedAt?: string;
  gaps?: string;
}
export interface Milestone {
  label: string;
  at: string;
  source?: string;
  note?: string;
}
export interface Source {
  label: string;
  url: string;
}
export interface Featured {
  id: string;
  name: string;
  siteIds?: string[];
  jobIds?: string[];
  url: string;
  purpose: string;
  category: string;
  logo?: string;
  sourceCode?: string;
  documentation?: string;
  agents?: Agent[];
  contracts?: Contract[];
  promises?: PromiseRecord[];
  timeline?: Milestone[];
  risks?: string[];
  sources?: Source[];
  checkedAt?: string;
  linkCheck?: { status: string; checkedAt: string; note?: string };
  [key: string]: unknown;
}
export interface Project {
  id: string;
  name: string;
  purpose: string;
  category: string;
  status: string;
  url?: string;
  logo?: string;
  sites: SiteRecord[];
  jobs: JobRecord[];
  workflows: WorkflowRecord[];
  checkedAt: string;
  agents: Agent[];
  contracts: Contract[];
  promises: PromiseRecord[];
  timeline: Milestone[];
  sources: Source[];
  risks: string[];
  sourceCode?: string;
  documentation?: string;
  featured?: Featured;
}
