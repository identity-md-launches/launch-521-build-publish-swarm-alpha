import type { JobRecord, SiteRecord, Snapshot, WorkflowRecord } from "./types";

const API = "https://api.imd.fun";
const PAGE_SIZE = 500;
const TIMEOUT_MS = 60_000;
type Row = Record<string, unknown> & { id: string };
type PageResult = { rows: Row[]; pages: number };

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${label}: invalid object`);
  return value as Record<string, unknown>;
}
function rows(value: unknown, label: string): Row[] {
  if (!Array.isArray(value)) throw new Error(`${label}: invalid records`);
  return value.map((value) => {
    const row = object(value, label);
    if (typeof row.id !== "string" || !row.id || row.id.length > 200)
      throw new Error(`${label}: invalid record ID`);
    for (const key of [
      "objective",
      "originalRequest",
      "label",
      "url",
      "status",
      "state",
      "template",
      "kind",
      "agentId",
      "jobId",
      "cid",
      "ensName",
      "supersededBy",
      "takenDownReason",
    ]) {
      if (row[key] != null && typeof row[key] !== "string")
        throw new Error(`${label}: invalid ${key}`);
    }
    for (const key of [
      "createdAt",
      "updatedAt",
      "pinnedAt",
      "namedAt",
      "takenDownAt",
    ]) {
      if (row[key] != null && !validDate(row[key]))
        throw new Error(`${label}: invalid ${key}`);
    }
    if (
      row.tokenId != null &&
      typeof row.tokenId !== "string" &&
      typeof row.tokenId !== "number"
    )
      throw new Error(`${label}: invalid token ID`);
    return row as Row;
  });
}
function integer(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    throw new Error(`${label}: invalid count`);
  return value;
}
function unique(records: Row[], label: string): Map<string, Row> {
  const result = new Map<string, Row>();
  for (const record of records) {
    if (result.has(record.id)) throw new Error(`${label}: duplicate record`);
    result.set(record.id, record);
  }
  return result;
}
function validDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}
/** Null list fields and shorter summaries must never erase richer stored evidence. */
function mergeSummary<T extends Row>(previous: T | undefined, fresh: Row): T {
  const result: Record<string, unknown> = { ...previous };
  for (const [key, value] of Object.entries(fresh)) {
    if (value === null || value === undefined) continue;
    const existing = result[key];
    if (
      (key === "objective" || key === "originalRequest") &&
      typeof existing === "string" &&
      existing.length
    ) {
      // List endpoints are a summary surface. A complete original request stays
      // attached to its original observation rather than being silently revised.
      continue;
    }
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      existing &&
      typeof existing === "object" &&
      !Array.isArray(existing)
    ) {
      result[key] = {
        ...existing,
        ...Object.fromEntries(
          Object.entries(value).filter(
            ([, item]) => item !== null && item !== undefined,
          ),
        ),
      };
    } else {
      result[key] = value;
    }
  }
  return result as T;
}

/**
 * Fetch complete public indexes before committing one immutable update.
 * A timeout, CORS error, malformed response, missing history or incomplete page
 * throws; callers keep their previous snapshot. No API result is written to it.
 */
export async function refreshSnapshot(previous: Snapshot): Promise<Snapshot> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const signal = controller.signal;
  async function get(path: string): Promise<Record<string, unknown>> {
    const response = await fetch(`${API}${path}`, {
      signal,
      cache: "no-store",
      credentials: "omit",
    });
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    return object(await response.json(), path);
  }
  async function cursorPages(
    resource: "jobs" | "workflows",
  ): Promise<PageResult> {
    const collected: Row[] = [];
    const seen = new Set<string>();
    let before: string | undefined;
    for (let page = 1; page <= 1_000; page++) {
      const path = `/${resource}?limit=${PAGE_SIZE}${before ? `&before=${encodeURIComponent(before)}` : ""}`;
      const response = await get(path);
      const records = rows(response[resource], resource);
      if (
        records.length > PAGE_SIZE ||
        integer(response.count, resource) !== records.length
      )
        throw new Error(`${resource}: inconsistent page size`);
      for (const record of records) {
        if (!validDate(record.createdAt))
          throw new Error(`${resource}: invalid cursor timestamp`);
        if (before && Date.parse(record.createdAt) >= Date.parse(before))
          throw new Error(`${resource}: cursor did not advance`);
        if (seen.has(record.id))
          throw new Error(`${resource}: duplicate page record`);
        seen.add(record.id);
        collected.push(record);
      }
      if (records.length < PAGE_SIZE) return { rows: collected, pages: page };
      before = records.reduce(
        (oldest, record) =>
          Date.parse(String(record.createdAt)) < Date.parse(oldest)
            ? String(record.createdAt)
            : oldest,
        String(records[0].createdAt),
      );
    }
    throw new Error(`${resource}: pagination safety limit reached`);
  }
  async function allSites(): Promise<{
    sites: SiteRecord[];
    publications: Row[];
    pages: number;
    total: number;
    live?: number;
  }> {
    // /sites is deliberately capped at the newest 100 and has no supported
    // cursor. Paginated publication items expose the historical site IDs.
    const [latest, first] = await Promise.all([
      get("/sites"),
      get("/publications?type=sites&page=1&pageSize=100"),
    ]);
    const latestRows = rows(latest.sites, "sites");
    const total = integer(latest.total, "sites total");
    if (
      integer(latest.count, "sites count") !== latestRows.length ||
      latestRows.length > total
    )
      throw new Error("sites: inconsistent total");
    const pages = integer(first.totalPages, "publication pages");
    const publicationTotal = integer(first.count, "publication total");
    if (pages < 1 || pages > 10_000)
      throw new Error("publications: invalid pagination");
    const publications = rows(first.items, "publications");
    if (integer(first.page, "publication page") !== 1)
      throw new Error("publications: incorrect page");
    for (let page = 2; page <= pages; page++) {
      const response = await get(
        `/publications?type=sites&page=${page}&pageSize=100`,
      );
      if (
        integer(response.page, "publication page") !== page ||
        integer(response.totalPages, "publication pages") !== pages ||
        integer(response.count, "publication total") !== publicationTotal
      )
        throw new Error("publications changed during collection; retry later");
      publications.push(...rows(response.items, "publications"));
    }
    unique(publications, "publications");
    if (publications.length !== publicationTotal)
      throw new Error("publications: incomplete index");
    const discovered = unique(latestRows, "sites");
    for (const publication of publications) {
      for (const site of rows(publication.sites, "publication sites"))
        discovered.set(site.id, site);
    }
    if (discovered.size !== total || (previous.sites.length > 0 && total === 0))
      throw new Error("sites: historical coverage incomplete");
    if (previous.sites.some((site) => !discovered.has(site.id)))
      throw new Error(
        "sites: previously recorded history is missing; keeping snapshot",
      );
    const ids = [...discovered.keys()];
    const records: SiteRecord[] = new Array(ids.length);
    let cursor = 0;
    // Bound concurrency so the public service and browser stay responsive.
    await Promise.all(
      Array.from({ length: Math.min(8, ids.length) }, async () => {
        while (cursor < ids.length) {
          const index = cursor++;
          const id = ids[index];
          const response = await get(`/sites/${encodeURIComponent(id)}`);
          const record = rows([response.site ?? response], "site detail")[0];
          if (record.id !== id) throw new Error("sites: detail ID mismatch");
          records[index] = record as SiteRecord;
        }
      }),
    );
    return {
      sites: records,
      publications,
      pages,
      total,
      live:
        typeof latest.live === "number"
          ? integer(latest.live, "sites live")
          : undefined,
    };
  }
  try {
    const [siteResult, jobResult, workflowResult] = await Promise.all([
      allSites(),
      cursorPages("jobs"),
      cursorPages("workflows"),
    ]);
    const jobsById = unique(jobResult.rows, "jobs");
    const workflowsById = unique(workflowResult.rows, "workflows");
    const priorIndex = Array.isArray(previous.jobIndex)
      ? previous.jobIndex
      : [];
    const oldJobIds = new Set(previous.jobs.map((job) => job.id));
    for (const entry of priorIndex)
      if (Array.isArray(entry) && typeof entry[0] === "string")
        oldJobIds.add(entry[0]);
    if ([...oldJobIds].some((id) => !jobsById.has(id)))
      throw new Error("jobs: historical coverage regressed");
    if (previous.workflows.some((workflow) => !workflowsById.has(workflow.id)))
      throw new Error("workflows: historical coverage regressed");

    const checkedAt = new Date().toISOString();
    const previousSites = new Map(
      previous.sites.map((site) => [site.id, site]),
    );
    const sites = siteResult.sites.map((site) => {
      const old = previousSites.get(site.id);
      return {
        ...old,
        ...site,
        // A registry refresh is not a new website reachability check.
        ...(old?.linkCheck ? { linkCheck: old.linkCheck } : {}),
        registryCheckedAt: checkedAt,
        sourceUrl: `${API}/sites/${site.id}`,
      };
    });
    const oldJobs = new Map(previous.jobs.map((job) => [job.id, job]));
    const jobs = jobResult.rows
      .filter(
        (job) =>
          oldJobs.has(job.id) || !String(job.template ?? "").includes("oracle"),
      )
      .map((job) => ({
        ...mergeSummary<JobRecord>(oldJobs.get(job.id), job),
        registryCheckedAt: checkedAt,
      }));
    const oldWorkflows = new Map(
      previous.workflows.map((workflow) => [workflow.id, workflow]),
    );
    const workflows = workflowResult.rows.map((workflow) => ({
      ...mergeSummary<WorkflowRecord>(oldWorkflows.get(workflow.id), workflow),
      registryCheckedAt: checkedAt,
    }));
    const publications = siteResult.publications.map((publication) => ({
      id: publication.id,
      title:
        typeof publication.title === "string"
          ? publication.title.slice(0, 220)
          : "",
      publishedAt: publication.publishedAt,
      release: publication.release,
      types: publication.types,
      siteIds: rows(publication.sites, "publication sites").map(
        (site) => site.id,
      ),
      versions: Array.isArray(publication.versions)
        ? publication.versions.map((value) => {
            const version = object(value, "publication version");
            return Object.fromEntries(
              ["jobId", "state", "repoUrl", "commit", "createdAt", "site"]
                .filter((key) => version[key] != null)
                .map((key) => [key, version[key]]),
            );
          })
        : [],
    }));
    const columns = ["id", "state", "template", "createdAt", "updatedAt"];
    return {
      ...previous,
      // checkedAt dates the rich snapshot evidence. Only index/registry metadata
      // was refreshed, so it must not imply fresh contracts, ownership or tests.
      checkedAt: previous.checkedAt,
      liveCheckedAt: checkedAt,
      coverage: {
        ...previous.coverage,
        sites: {
          fetched: sites.length,
          total: siteResult.total,
          live: siteResult.live,
          pages: siteResult.pages,
          complete: true,
          publicationItems: publications.length,
          checkedAt,
          pagination:
            "/sites plus all site-publication pages and individual /sites/:id records",
        },
        jobs: {
          fetched: jobResult.rows.length,
          pages: jobResult.pages,
          complete: true,
          checkedAt,
          pagination: "limit=500; before=oldest createdAt; final page <500",
        },
        workflows: {
          fetched: workflowResult.rows.length,
          pages: workflowResult.pages,
          complete: true,
          checkedAt,
          pagination: "limit=500; before=oldest createdAt; final page <500",
        },
      },
      sites,
      jobs,
      workflows,
      publications,
      jobIndexColumns: columns,
      jobIndex: jobResult.rows.map((job) =>
        columns.map((key) => job[key] ?? null),
      ),
    };
  } catch (error) {
    controller.abort();
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
