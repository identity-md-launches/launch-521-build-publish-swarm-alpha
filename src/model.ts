import type {
  Agent,
  Contract,
  Featured,
  JobRecord,
  Milestone,
  Project,
  SiteRecord,
  Snapshot,
  WorkflowRecord,
} from "./types";
export const API = "https://api.imd.fun";
export const jobLink = (id: string) =>
  `https://explorer.imd.fun/jobs/${encodeURIComponent(id)}`;
export const profileLink = (id: string | number) =>
  `https://explorer.imd.fun/agents/${encodeURIComponent(String(id))}`;
export function safeUrl(value?: string | null): string | undefined {
  if (!value) return undefined;
  try {
    const u = new URL(value);
    return ["https:", "http:"].includes(u.protocol) ? u.href : undefined;
  } catch {
    return undefined;
  }
}
export function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[/?#]+$/, "");
}
export function shortDomain(value?: string) {
  if (!value) return "Website not recorded";
  try {
    return new URL(value).hostname;
  } catch {
    return value;
  }
}
export function date(value?: string | null, time = false) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Not recorded";
  return (
    new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      ...(time ? { hour: "2-digit", minute: "2-digit" } : {}),
      timeZone: "UTC",
    }).format(new Date(value)) + (time ? " UTC" : "")
  );
}
// API objects are decoded at this boundary; absent values never imply zero or success.
type Data = Record<string, unknown>;
const obj = (v: unknown): Data =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Data) : {};
const rows = (v: unknown): Data[] => (Array.isArray(v) ? v.map(obj) : []);
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const workflowJob = (w: WorkflowRecord, kind: "frontend" | "contracts") =>
  str(obj(w[kind]).id) || str(w[`${kind}JobId`]);
function title(site: SiteRecord, request: string): string {
  const quoted =
    request.match(
      /^(?:build|create|make|design)\s+(?:a |an |the )?[“\"']([^”\"']{2,65})/i,
    ) ||
    request.match(/(?:called|named|titled)\s+[“"']([^”"']{2,65})/i) ||
    request.match(
      /(?:called|named)\s+([\w][\w -]{2,45}?)(?:\.|,| that| which| to|\n|$)/i,
    );
  if (quoted) return quoted[1].trim();
  let label = site.label || shortDomain(site.url || "") || "Untitled site";
  if (/^site-[a-f\d]+$/.test(label) && request) {
    label = request
      .split("\n")[0]
      .replace(
        /^(build|create|make|design|implement)\s+(a |an |the )?(new |simple |interactive |one-page |polished )*/i,
        "",
      )
      .split(/[.!?]\s/)[0]
      .slice(0, 80);
    return label.charAt(0).toUpperCase() + label.slice(1);
  }
  return label
    .replace(/-[0-9a-f]{4,8}$/, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (x) => x.toUpperCase());
}
function category(text: string): string {
  if (/game|playable|arcade|puzzle/i.test(text)) return "Games & worlds";
  if (
    /defi|token|trading|swap|lending|vault|stablecoin|yield|finance|price feed/i.test(
      text,
    )
  )
    return "Finance";
  if (/art|music|creative|pixel|dream|visualiz|sound|design studio/i.test(text))
    return "Art & experiments";
  if (/explorer|dashboard|analytics|monitor|directory|data|tracker/i.test(text))
    return "Data & tools";
  if (/agent|swarm|protocol|infrastructure|developer/i.test(text))
    return "Infrastructure";
  return "Community";
}
function extractAgents(
  jobs: JobRecord[],
  snapshot: Snapshot,
  site: SiteRecord,
): Agent[] {
  const result: Agent[] = [];
  const seats = rows(snapshot.seats);
  const roleNames: Record<string, string> = {
    implement: "Builder",
    review: "Reviewer",
    tests: "Test builder",
    integrate: "Integrator",
  };
  for (const job of jobs)
    for (const node of rows(job.nodes)) {
      const seat = obj(node.seat);
      if (seat.tokenId == null && !seat.agentId) continue;
      const tokenId = String(seat.tokenId ?? "");
      const role = roleNames[str(node.role)] || str(node.role) || "Contributor";
      const profile = seats.find((s) => String(s.tokenId) === tokenId);
      const owner = obj(profile?.profile);
      if (!result.some((a) => a.tokenId === tokenId && a.role === role))
        result.push({
          tokenId,
          agentId: str(seat.agentId),
          role,
          profile: profileLink(tokenId),
          type: "AI agent",
          workUrl: jobLink(job.id),
          owner: str(owner.owner) || undefined,
          ownerSource: str(profile?.sourceUrl) || undefined,
          ownerCheckedAt: str(profile?.checkedAt) || undefined,
          ownerEvidence:
            "Owner reported by the IdentityMD public API at the recorded time; not an independent ownerOf check.",
        });
    }
  const verified = jobs.find((j) =>
    rows(j.nodes).some((n) => Object.keys(obj(n.verdict)).length),
  );
  if (verified)
    result.push({
      role: "Build verifier",
      type: "Automated service",
      workUrl: jobLink(verified.id),
    });
  if (site.pinnedAt || site.namedAt)
    result.push({
      role: "Publisher",
      type: "Automated hosting service",
      workUrl: `${API}/sites/${site.id}`,
    });
  if (site.tokenId != null || site.agentId)
    result.push({
      tokenId: site.tokenId ?? undefined,
      agentId: site.agentId || undefined,
      role: "Submitter",
      type: "User submission",
    });
  return result;
}
export function networkFor(chainId: unknown) {
  return Number(chainId) === 1
    ? "Ethereum mainnet · chain 1"
    : Number(chainId) === 11155111
      ? "Sepolia testnet · chain 11155111"
      : Number(chainId) === 4663
        ? "Robinhood mainnet · chain 4663"
        : chainId
          ? `Network unknown · chain ${chainId}`
          : "Network unknown";
}
function workflowContracts(workflows: WorkflowRecord[]): Contract[] {
  const result: Contract[] = [];
  for (const w of workflows) {
    const handoff = obj(w.handoff);
    const chain = handoff.chainId ?? w.chainId;
    for (const c of rows(handoff.contracts)) {
      const address = str(c.address);
      if (!/^0x[\da-f]{40}$/i.test(address)) continue;
      const network = networkFor(chain);
      if (result.some((v) => v.address === address && v.network === network))
        continue;
      result.push({
        address,
        role: str(c.name) || "Role not recorded",
        network,
        explorer:
          Number(chain) === 11155111
            ? `https://sepolia.etherscan.io/address/${address}`
            : Number(chain) === 1
              ? `https://etherscan.io/address/${address}`
              : undefined,
        source: `${API}/workflows/${w.id}`,
        verification:
          "Deployment address and network from the workflow handoff. This records an API deployment claim; no independent security audit is implied.",
      });
    }
  }
  return result;
}
/** Group exclusively by explicit registry/job/publication relationships. */
export function buildProjects(
  snapshot: Snapshot,
  features: Featured[],
): Project[] {
  const parents = new Map(snapshot.sites.map((s) => [s.id, s.id]));
  const find = (id: string): string => {
    const p = parents.get(id);
    if (!p || p === id) return id;
    const root = find(p);
    parents.set(id, root);
    return root;
  };
  const union = (a: string, b: string) => {
    if (parents.has(a) && parents.has(b)) parents.set(find(a), find(b));
  };
  const jobSites = new Map<string, string>();
  for (const s of snapshot.sites) {
    if (s.jobId) {
      const old = jobSites.get(s.jobId);
      if (old) union(old, s.id);
      jobSites.set(s.jobId, s.id);
    }
    if (s.supersededBy) union(s.id, s.supersededBy);
  }
  const linkedJobs = new Map<string, Set<string>>();
  const connect = (a: string, b: string) => {
    if (!a || !b) return;
    linkedJobs.set(a, new Set([...(linkedJobs.get(a) || []), b]));
    linkedJobs.set(b, new Set([...(linkedJobs.get(b) || []), a]));
  };
  for (const j of snapshot.jobs) {
    connect(j.id, str(j.parentJobId));
    const project = obj(j.project);
    connect(j.id, str(project.id));
    for (const v of rows(project.versions)) connect(j.id, str(v.jobId));
  }
  const related = (ids: string[]) => {
    const set = new Set(ids),
      queue = [...ids];
    for (let i = 0; i < queue.length; i++)
      for (const id of linkedJobs.get(queue[i]) || [])
        if (!set.has(id)) {
          set.add(id);
          queue.push(id);
        }
    return set;
  };
  for (const j of snapshot.jobs) {
    const site = jobSites.get(j.id);
    if (site)
      for (const id of related([j.id])) {
        const other = jobSites.get(id);
        if (other) union(site, other);
      }
  }
  for (const publication of rows(snapshot.publications)) {
    const ids = Array.isArray(publication.siteIds)
      ? (publication.siteIds as string[])
      : [];
    for (const id of ids.slice(1)) union(ids[0], id);
  }
  const groups = new Map<string, SiteRecord[]>();
  for (const s of snapshot.sites) {
    const key = find(s.id);
    groups.set(key, [...(groups.get(key) || []), s]);
  }
  const projects: Project[] = [];
  for (const sites of groups.values()) {
    sites.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    const current =
      sites.find((s) => !s.supersededBy && !s.takenDownAt) || sites[0];
    const relatedIds = related(
      sites.flatMap((s) => (s.jobId ? [s.jobId] : [])),
    );
    const jobs = snapshot.jobs.filter((j) => relatedIds.has(j.id));
    const workflows = snapshot.workflows.filter(
      (w) =>
        relatedIds.has(workflowJob(w, "frontend")) ||
        relatedIds.has(workflowJob(w, "contracts")) ||
        jobs.some((j) => j.workflowId === w.id),
    );
    const feature = features.find((f) =>
      sites.some(
        (s) =>
          f.siteIds?.includes(s.id) ||
          Boolean(s.jobId && f.jobIds?.includes(s.jobId)),
      ),
    );
    const job = jobs.find((j) => j.id === current.jobId) || jobs[0];
    const request =
      str(workflows[0]?.originalRequest) ||
      job?.originalRequest ||
      job?.objective ||
      "";
    const name = feature?.name || title(current, request);
    const agents = feature?.agents?.length
      ? feature.agents
      : extractAgents(jobs, snapshot, current);
    const timeline: Milestone[] = [];
    for (const w of workflows)
      if (w.createdAt)
        timeline.push({
          label: "Workflow request recorded",
          at: w.createdAt,
          source: `${API}/workflows/${w.id}`,
        });
    for (const j of jobs) {
      if (j.createdAt)
        timeline.push({
          label: "Job request recorded",
          at: j.createdAt,
          source: jobLink(j.id),
        });
      for (const n of rows(j.nodes)) {
        const verdict = obj(n.verdict);
        if (verdict.at)
          timeline.push({
            label: `${str(n.role) || "Work"} ${str(verdict.status) || "verdict"} recorded`,
            at: str(verdict.at),
            source: jobLink(j.id),
            note:
              str(verdict.detail) ||
              "A work verdict, not proof of feature completeness.",
          });
      }
      const delivery = obj(j.delivery);
      if (delivery.deliveredAt)
        timeline.push({
          label: "Repository delivery recorded",
          at: str(delivery.deliveredAt),
          source: jobLink(j.id),
          note: "The delivery timestamp is distinct from first feature-complete delivery.",
        });
    }
    for (const s of sites) {
      if (s.pinnedAt)
        timeline.push({
          label: "IPFS publication recorded",
          at: s.pinnedAt,
          source: `${API}/sites/${s.id}`,
        });
      if (s.namedAt)
        timeline.push({
          label: "Website name recorded",
          at: s.namedAt,
          source: `${API}/sites/${s.id}`,
        });
    }
    const delivered = Boolean(current.pinnedAt || current.namedAt);
    const sourceCode =
      str(obj(job?.delivery).repoUrl) ||
      str(obj(workflows[0]?.frontend).repoUrl);
    projects.push({
      id: feature?.id || current.id,
      name,
      purpose:
        feature?.purpose ||
        (request
          ? request.replace(/\s+/g, " ").slice(0, 210) +
            (request.length > 210 ? "…" : "")
          : "A community-submitted website. A project purpose is not recorded in the public API."),
      category:
        feature?.category || category(name + " " + request.slice(0, 300)),
      status: current.takenDownAt
        ? "Removed"
        : current.supersededBy
          ? "Old version"
          : current.status === "named" || current.status === "pinned"
            ? "Published"
            : current.status === "failed"
              ? "Publication failed"
              : "Pending",
      url: safeUrl(feature?.url || current.url),
      logo: feature?.logo,
      sites,
      jobs,
      workflows,
      checkedAt: feature?.checkedAt || snapshot.checkedAt,
      agents,
      contracts: feature?.contracts || workflowContracts(workflows),
      promises: feature?.promises || [
        {
          promise: "Publish a website",
          status: delivered ? "Delivered" : "Unverified",
          evidence: delivered
            ? "The site registry records publication. This does not establish feature completeness."
            : "No confirmed publication timestamp is available.",
          source: `${API}/sites/${current.id}`,
          deliveredAt: current.pinnedAt || current.namedAt || undefined,
          checkedAt: snapshot.checkedAt,
          gaps: "Individual requested features have not been independently tested.",
        },
        {
          promise: "Deliver the requested functionality",
          status: "Unverified",
          evidence:
            "The original request is preserved in Sources & version history. Build acceptance is not a feature test. An item-by-item independent feature assessment is not yet available.",
          source: workflows[0]
            ? `${API}/workflows/${workflows[0].id}`
            : job
              ? jobLink(job.id)
              : `${API}/sites/${current.id}`,
          checkedAt: snapshot.checkedAt,
          gaps: "No feature-complete delivery date has been established.",
        },
      ],
      timeline: feature?.timeline?.length ? feature.timeline : timeline,
      sources: feature?.sources || [
        { label: "Public site record", url: `${API}/sites/${current.id}` },
        ...jobs.map((j) => ({
          label: "Job and work record",
          url: jobLink(j.id),
        })),
        ...workflows.map((w) => ({
          label: "Workflow and deployment evidence",
          url: `${API}/workflows/${w.id}`,
        })),
      ],
      risks: feature?.risks || [
        "Purpose summarizes requester claims. Features and financial safety have not been independently verified.",
        "Publication and build acceptance do not prove every promise was fulfilled.",
        "NFT ownership is reported by the API at its own check time; agent identity is separate.",
      ],
      sourceCode: feature?.sourceCode || safeUrl(sourceCode),
      documentation: feature?.documentation,
      featured: feature,
    });
  }
  for (const f of features)
    if (!projects.some((p) => p.id === f.id))
      projects.push({
        id: f.id,
        name: f.name,
        purpose: f.purpose,
        category: f.category,
        status: "Verification pending",
        url: safeUrl(f.url),
        logo: f.logo,
        sites: [],
        jobs: [],
        workflows: [],
        checkedAt: f.checkedAt || snapshot.checkedAt,
        agents: f.agents || [],
        contracts: f.contracts || [],
        promises: f.promises || [],
        timeline: f.timeline || [],
        sources: f.sources || [],
        risks: f.risks || [],
        sourceCode: f.sourceCode,
        documentation: f.documentation,
        featured: f,
      });
  return projects;
}
export function matches(project: Project, query: string): boolean {
  const q = normalize(query).replace(/^(?:nft\s*#?|#)\s*/, "");
  if (!q) return true;
  if (/^\d+$/.test(q))
    return (
      project.agents.some((a) => String(a.tokenId) === q || a.agentId === q) ||
      project.sites.some((s) => String(s.tokenId) === q || s.agentId === q)
    );
  const fields = [
    project.name,
    project.url || "",
    project.id,
    ...project.contracts.map((c) => c.address),
    ...project.agents.flatMap((a) => [
      String(a.tokenId ?? ""),
      a.agentId || "",
    ]),
    ...project.sites.flatMap((s) => [
      s.url || "",
      s.label || "",
      s.id,
      String(s.tokenId ?? ""),
      s.agentId || "",
    ]),
    ...project.jobs.map((j) => j.id),
  ];
  return fields.some((field) => normalize(field).includes(q));
}
