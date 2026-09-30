import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  Search,
  Moon,
  Sun,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Check,
  Copy,
  ExternalLink,
  RefreshCw,
  Layers3,
  Fingerprint,
  Clock3,
  Info,
  Globe2,
  X,
  CircleCheck,
  ShieldCheck,
} from "lucide-react";
import { brand } from "./config";
import {
  API,
  buildProjects,
  date,
  matches,
  normalize,
  profileLink,
  safeUrl,
  shortDomain,
  jobLink,
} from "./model";
import { refreshSnapshot } from "./live";
import type { Agent, Featured, Project, SiteRecord, Snapshot } from "./types";
const PAGE_SIZE = 9;
function OutLink({
  href,
  children,
  className = "",
  label,
}: {
  href?: string | null;
  children: React.ReactNode;
  className?: string;
  label?: string;
}) {
  const url = safeUrl(href);
  return url ? (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      aria-label={label}
    >
      {children}
      <ArrowUpRight size={14} aria-hidden="true" />
    </a>
  ) : (
    <span className="muted">Not recorded</span>
  );
}
function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return (
    <span className={`badge ${tone}`}>
      {tone === "green" && <span className="status-dot" />}
      {children}
    </span>
  );
}
function Avatar({
  name,
  src,
  small = false,
}: {
  name: string;
  src?: string;
  small?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
  return (
    <span className={`avatar ${small ? "small" : ""}`}>
      {src && !failed ? (
        <img src={src} alt="" onError={() => setFailed(true)} />
      ) : (
        <span role="img" aria-label={`${name}, initials placeholder`}>
          {initials}
        </span>
      )}
    </span>
  );
}
function AgentLink({ agent }: { agent: Agent }) {
  if (agent.tokenId == null && !agent.agentId)
    return agent.profile ? (
      <OutLink href={agent.profile}>{agent.role}</OutLink>
    ) : (
      <span>{agent.type || "Attribution not recorded"}</span>
    );
  return (
    <OutLink
      href={
        agent.profile ||
        (agent.tokenId != null ? profileLink(agent.tokenId) : undefined)
      }
      className="agent-link"
    >
      {agent.tokenId != null
        ? `NFT #${agent.tokenId}`
        : `Agent ${agent.agentId || "unknown"}`}
    </OutLink>
  );
}
function Pagination({
  page,
  setPage,
  total,
  size = PAGE_SIZE,
  label = "Projects",
}: {
  page: number;
  setPage: (n: number) => void;
  total: number;
  size?: number;
  label?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / size));
  return (
    <nav className="pagination" aria-label={`${label} pagination`}>
      <span>
        {total
          ? `${(page - 1) * size + 1}–${Math.min(page * size, total)} of ${total}`
          : "0 results"}
      </span>
      <div>
        <button
          className="icon-button"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
          aria-label={`Previous ${label.toLowerCase()} page`}
        >
          <ChevronLeft size={18} />
        </button>
        <span>
          Page {page} of {pages}
        </span>
        <button
          className="icon-button"
          disabled={page >= pages}
          onClick={() => setPage(page + 1)}
          aria-label={`Next ${label.toLowerCase()} page`}
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </nav>
  );
}
function ProjectCard({ project: p }: { project: Project }) {
  return (
    <article className="project-card">
      <div className="card-top">
        <Avatar name={p.name} src={p.logo} />
        <Badge tone={p.status === "Published" ? "green" : "neutral"}>
          {p.status}
        </Badge>
      </div>
      <div className="card-title">
        <h3>
          <a href={`#/project/${p.id}`}>{p.name}</a>
        </h3>
        <span className="domain">{shortDomain(p.url)}</span>
      </div>
      <p className="purpose">{p.purpose}</p>
      <div className="card-tags">
        <Badge>{p.category}</Badge>
        <span
          className="claim-label"
          title="Purpose describes the project’s public request or website, not an independent feature test."
        >
          Project claim
        </span>
      </div>
      <div className="card-meta">
        <span>
          <Fingerprint size={15} aria-hidden="true" />{" "}
          {p.agents.length ? (
            <>
              <AgentLink agent={p.agents[0]} />
              {p.agents.length > 1 && (
                <span className="muted">+{p.agents.length - 1}</span>
              )}
            </>
          ) : (
            <span>Builder not confirmed</span>
          )}
        </span>
        <span className="attribution-note">
          {p.agents[0]?.role || "Builder verification pending"}
        </span>
        <span>
          <Clock3 size={14} aria-hidden="true" /> Checked {date(p.checkedAt)}
        </span>
      </div>
      <div className="card-actions">
        <a
          className="button detail-button"
          href={`#/project/${p.id}`}
          aria-label={`Project details for ${p.name}`}
        >
          Project details <ArrowRight size={15} />
        </a>
        <OutLink
          href={p.url}
          className="website-button"
          label={`Open website for ${p.name}`}
        >
          Open website
        </OutLink>
      </div>
    </article>
  );
}
function Directory({
  snapshot,
  projects,
}: {
  snapshot: Snapshot;
  projects: Project[];
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [kind, setKind] = useState("All records");
  const externalRecords: SiteRecord[] = projects
    .filter((p) => !p.sites.length)
    .map((p) => ({
      id: `external:${p.id}`,
      label: p.name,
      url: p.url,
      kind: "submission",
    }));
  const allRecords = [...snapshot.sites, ...externalRecords];
  const projectMap = useMemo(
    () =>
      new Map(
        projects.flatMap((p) =>
          p.sites.length
            ? p.sites.map((s) => [s.id, p] as const)
            : [[`external:${p.id}`, p] as const],
        ),
      ),
    [projects],
  );
  function recordLabel(s: SiteRecord) {
    return s.takenDownAt
      ? "Removed"
      : s.supersededBy
        ? "Old version"
        : s.kind === "user" ||
            s.kind === "submission" ||
            s.kind === "submitted" ||
            s.kind === "user-site"
          ? "User submission"
          : "Publication";
  }
  const filtered = allRecords.filter((s) => {
    const p = projectMap.get(s.id);
    return (
      (kind === "All records" || recordLabel(s) === kind) &&
      (!query ||
        normalize(
          [s.label, s.url, s.id, s.tokenId, s.agentId, p?.name].join(" "),
        ).includes(normalize(query)))
    );
  });
  return (
    <section id="directory" tabIndex={-1} className="directory-section">
      <div className="section-heading">
        <div>
          <span className="eyebrow">THE COMPLETE RECORD</span>
          <h2>IdentityMD Site Directory</h2>
          <p>
            Every discovered site record, including earlier versions and removed
            sites.
          </p>
        </div>
        <span className="count-label">
          {snapshot.sites.length} records + {externalRecords.length} user
          submissions
        </span>
      </div>
      <div className="directory-panel">
        <div className="directory-toolbar">
          <label className="search-box compact">
            <Search size={19} aria-hidden="true" />
            <span className="sr-only">Search site records</span>
            <input
              type="search"
              value={query}
              placeholder="Search site records…"
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="select-label">
            <span className="sr-only">Record type</span>
            <select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                setPage(1);
              }}
            >
              {[
                "All records",
                "Publication",
                "Old version",
                "Removed",
                "User submission",
              ].map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
        </div>
        <p className="sr-only" role="status">
          {filtered.length} matching site records
        </p>
        <div className="directory-head" aria-hidden="true">
          <span>Website / record</span>
          <span>Record type</span>
          <span>Published</span>
          <span>Links</span>
        </div>
        {filtered.slice((page - 1) * 10, page * 10).map((s) => {
          const p = projectMap.get(s.id);
          return (
            <article className="directory-row" key={s.id}>
              <div>
                <strong>{s.label || p?.name || "Untitled site"}</strong>
                <span className="domain">{shortDomain(s.url || "")}</span>
              </div>
              <div>
                <Badge>{recordLabel(s)}</Badge>
                {s.takenDownReason && (
                  <span className="small-text">{s.takenDownReason}</span>
                )}
              </div>
              <span className="small-text">
                {date(s.namedAt || s.pinnedAt)}
              </span>
              <div className="row-links">
                <OutLink
                  href={s.url}
                  label={`Open ${s.label || "site"} website`}
                >
                  Website
                </OutLink>
                {p && (
                  <a
                    href={`#/project/${p.id}`}
                    aria-label={`Details for ${s.label || p.name}`}
                  >
                    Details <ArrowRight size={13} />
                  </a>
                )}
                {s.cid && (
                  <OutLink href={`https://ipfs.io/ipfs/${s.cid}/`}>
                    IPFS
                  </OutLink>
                )}
              </div>
            </article>
          );
        })}
        {!filtered.length && (
          <div className="empty">
            <h3>No matching site records</h3>
            <p>Try a domain, a record ID or a project name.</p>
            <button
              className="button"
              onClick={() => {
                setQuery("");
                setKind("All records");
                setPage(1);
              }}
            >
              Clear directory filters
            </button>
          </div>
        )}
        <Pagination
          page={page}
          setPage={setPage}
          total={filtered.length}
          size={10}
          label="Directory"
        />
      </div>
      <p className="coverage-note">
        <Info size={15} />
        <span>
          Registry records and explicitly requested external submissions are
          listed separately. These are not unique active projects. Explicit
          version links are grouped above; similar names are kept separate.
          “Published” records hosting, not current uptime.
        </span>
      </p>
    </section>
  );
}
function Home({
  snapshot,
  projects,
}: {
  snapshot: Snapshot;
  projects: Project[];
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All categories");
  const [status, setStatus] = useState("All statuses");
  const [sort, setSort] = useState("Featured first");
  const [page, setPage] = useState(1);
  const categories = [
    "All categories",
    ...Array.from(new Set(projects.map((p) => p.category))).sort(),
  ];
  const filtered = useMemo(
    () =>
      projects
        .filter(
          (p) =>
            matches(p, query) &&
            (category === "All categories" || p.category === category) &&
            (status === "All statuses" || p.status === status),
        )
        .sort((a, b) =>
          sort === "Name A–Z"
            ? a.name.localeCompare(b.name)
            : sort === "Recently published"
              ? (
                  b.sites[0]?.namedAt ||
                  b.sites[0]?.pinnedAt ||
                  ""
                ).localeCompare(
                  a.sites[0]?.namedAt || a.sites[0]?.pinnedAt || "",
                )
              : sort === "Last checked"
                ? b.checkedAt.localeCompare(a.checkedAt)
                : Number(Boolean(b.featured)) - Number(Boolean(a.featured)) ||
                  a.name.localeCompare(b.name),
        ),
    [projects, query, category, status, sort],
  );
  const reset = () => {
    setQuery("");
    setCategory("All categories");
    setStatus("All statuses");
    setPage(1);
  };
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <span className="tiny-grid">✳</span> THE IDENTITYMD ECOSYSTEM
          </span>
          <h1>
            Built by the swarm.
            <br />
            <span>Discover what’s next.</span>
          </h1>
          <p>
            A clearer look at what IdentityMD agents are building.
            <br className="desktop-break" /> Explore the projects, meet the
            builders, and follow the evidence.
          </p>
          <div className="hero-points">
            <span>
              <Globe2 size={15} /> Real projects
            </span>
            <span>
              <Fingerprint size={15} /> Public builders
            </span>
            <span>
              <ShieldCheck size={15} /> Evidence first
            </span>
          </div>
        </div>
        <aside className="hero-note">
          <div className="note-icon">
            <Layers3 size={24} />
          </div>
          <span className="eyebrow">YOUR STARTING POINT</span>
          <h2>
            From an idea
            <br />
            to something you can open.
          </h2>
          <p>
            One directory. The websites, the people behind them, and what’s
            actually been delivered.
          </p>
          <a href="#/evidence">
            How we check projects <ArrowUpRight size={16} />
          </a>
        </aside>
      </section>
      <section className="discovery" id="projects">
        <div className="search-area">
          <label htmlFor="project-search">Find your next discovery</label>
          <div className="search-box">
            <Search size={23} aria-hidden="true" />
            <input
              id="project-search"
              type="search"
              autoComplete="off"
              value={query}
              placeholder="Search by project name, website URL or NFT number"
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
            {query && (
              <button
                className="icon-button clear-search"
                aria-label="Clear search"
                onClick={() => {
                  setQuery("");
                  setPage(1);
                }}
              >
                <X size={18} />
              </button>
            )}
            <span className="search-hint">
              Explore the directory <ArrowRight size={16} />
            </span>
          </div>
          <span className="search-help">
            Also search by contract address or agent ID.
          </span>
        </div>
        <div className="filters">
          <div className="filter-group">
            <SlidersHorizontal size={17} aria-hidden="true" />
            <label>
              <span className="sr-only">Category</span>
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setPage(1);
                }}
              >
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="sr-only">Status</span>
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                {[
                  "All statuses",
                  ...new Set(projects.map((p) => p.status)),
                ].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="sort-label">
            <span>Sort by</span>
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
            >
              {[
                "Featured first",
                "Recently published",
                "Name A–Z",
                "Last checked",
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="results-heading">
          <h2>
            Explore projects <span>{filtered.length}</span>
          </h2>
          <span className="small-text" role="status">
            {query
              ? `${filtered.length} results for “${query}”`
              : `${filtered.length} project groups · ${snapshot.sites.length} site records`}
          </span>
        </div>
        {filtered.length ? (
          <div className="project-grid">
            {filtered
              .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
              .map((p) => (
                <ProjectCard key={p.id} project={p} />
              ))}
          </div>
        ) : (
          <div className="empty surface">
            <Search size={28} />
            <h3>No projects match your search</h3>
            <p>
              Try a project name or domain, or clear your filters to start
              again.
            </p>
            <button className="button primary" onClick={reset}>
              Clear search and filters
            </button>
          </div>
        )}
        <Pagination page={page} setPage={setPage} total={filtered.length} />
      </section>
      <div className="evidence-strip">
        <span className="evidence-icon">
          <ShieldCheck size={24} />
        </span>
        <div>
          <strong>Discover with context.</strong>
          <p>
            A published website is a starting point. Open a project to see its
            sources, builders and what still needs checking.
          </p>
        </div>
        <a href="#/evidence">
          Read our evidence guide <ArrowRight size={16} />
        </a>
      </div>
      <Directory snapshot={snapshot} projects={projects} />
    </>
  );
}
function CopyButton({ value }: { value: string }) {
  const [state, setState] = useState("Copy");
  return (
    <button
      className="button small-button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setState("Copied");
        } catch {
          setState("Select address to copy");
        }
      }}
      aria-label={`${state} address ${value}`}
    >
      {state === "Copied" ? <Check size={14} /> : <Copy size={14} />}
      <span role="status">{state}</span>
    </button>
  );
}
function Detail({ project: p }: { project: Project }) {
  const timeline = [...p.timeline]
    .filter((t) => Number.isFinite(Date.parse(t.at)))
    .sort((a, b) => a.at.localeCompare(b.at));
  const request = timeline.find((t) => /request/i.test(t.label));
  const publication = timeline.find((t) =>
    /publish|publication|website name/i.test(t.label),
  );
  const elapsed =
    request && publication
      ? Date.parse(publication.at) - Date.parse(request.at)
      : undefined;
  const sectionLink = (id: string) => `#/project/${p.id}/${id}`;
  return (
    <>
      <a className="back-link" href="#/">
        <ArrowLeft size={16} /> All projects
      </a>
      <section className="detail-hero">
        <Avatar name={p.name} src={p.logo} />
        <div>
          <div className="inline-tags">
            <Badge>{p.category}</Badge>
            <Badge tone={p.status === "Published" ? "green" : "neutral"}>
              {p.status}
            </Badge>
          </div>
          <h1>{p.name}</h1>
          <p>{p.purpose}</p>
          <span className="claim-label">
            Purpose: public project claim · Checked {date(p.checkedAt)}
          </span>
        </div>
        <OutLink href={p.url} className="button primary">
          Open website
        </OutLink>
      </section>
      <nav className="section-nav" aria-label="Project sections">
        {[
          ["overview", "Overview"],
          ["builders", "Builders & agents"],
          ["contracts", "Contracts"],
          ["delivery", "Promises & delivery"],
          ["timeline", "Timeline"],
          ["sources", "Sources & history"],
        ].map(([id, label]) => (
          <a href={sectionLink(id)} key={id}>
            {label}
          </a>
        ))}
      </nav>
      <div className="detail-layout">
        <div className="detail-main">
          <section className="panel" id="overview" tabIndex={-1}>
            <div className="panel-heading">
              <h2>Project overview</h2>
              <Globe2 size={20} />
            </div>
            <div className="overview-grid">
              <div>
                <span className="field-label">Official website</span>
                <OutLink href={p.url}>{shortDomain(p.url)}</OutLink>
              </div>
              <div>
                <span className="field-label">Source code</span>
                <OutLink href={p.sourceCode}>View repository</OutLink>
              </div>
              <div>
                <span className="field-label">Documentation</span>
                <OutLink href={p.documentation}>Read documentation</OutLink>
              </div>
              <div>
                <span className="field-label">Link check</span>
                <span>
                  {p.featured?.linkCheck
                    ? `${p.featured.linkCheck.status} · ${date(p.featured.linkCheck.checkedAt)}`
                    : p.sites[0]?.linkCheck
                      ? `${(p.sites[0].linkCheck as { status: string }).status} from collection environment · ${date((p.sites[0].linkCheck as { checkedAt: string }).checkedAt)}`
                      : "Not individually checked"}
                </span>
              </div>
            </div>
            <div className="info-note">
              <Info size={18} />
              <p>
                {p.featured?.linkCheck?.note ||
                  "A hosting record confirms publication. Reachability and individual features are separate checks."}
              </p>
            </div>
          </section>
          <section className="panel" id="builders" tabIndex={-1}>
            <div className="panel-heading">
              <h2>Builders & agents</h2>
              <Fingerprint size={20} />
            </div>
            <p className="section-intro">
              Public work attribution. An agent, an NFT and its owner are
              different identities.
            </p>
            {Array.isArray(p.featured?.unknownRoles) && (
              <div className="missing attribution-warning">
                <strong>Platform attribution still pending</strong>
                <p>
                  {(p.featured.unknownRoles as string[]).join(", ")}.
                  Contributors below have only the specific roles shown.
                </p>
              </div>
            )}
            {p.agents.length ? (
              <div className="agents-grid">
                {p.agents.map((a, i) => (
                  <article
                    className="agent-card"
                    key={`${a.tokenId}-${a.role}-${i}`}
                  >
                    <div className="agent-heading">
                      <Avatar
                        name={a.tokenId != null ? `#${a.tokenId}` : "Agent"}
                        src={a.avatar}
                        small
                      />
                      <div>
                        <AgentLink agent={a} />
                        <span className="field-label">
                          {a.role} · {a.type || "Agent"}
                        </span>
                      </div>
                    </div>
                    {a.agentId && (
                      <p className="small-text">
                        Agent ID <code>{a.agentId}</code>
                      </p>
                    )}
                    <div className="agent-links">
                      <OutLink href={a.workUrl}>Work record</OutLink>
                    </div>
                    <p className="owner-info">
                      {/automated/i.test(a.type || "") ? (
                        "Automated service; no NFT owner is attributed to this role."
                      ) : a.owner ? (
                        <>
                          Recorded owner: <code>{a.owner}</code>
                          <br />
                          <OutLink href={a.ownerSource}>
                            Owner source
                          </OutLink> · {date(a.ownerCheckedAt, true)}
                        </>
                      ) : (
                        "NFT owner: verification pending. No owner inferred from the agent or publisher."
                      )}
                    </p>
                    {a.ownerEvidence && (
                      <details className="owner-evidence">
                        <summary>Owner evidence</summary>
                        <p>{a.ownerEvidence}</p>
                      </details>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <div className="missing">
                <strong>Builder attribution is not confirmed</strong>
                <p>
                  The linked public records do not identify a confirmed builder
                  NFT or agent for this project.
                </p>
              </div>
            )}
            <p className="small-text role-note">
              Reviewer, verifier and publisher roles are listed only when the
              record names them. Hosting and automated build checks do not
              establish NFT ownership.
            </p>
          </section>
          <section className="panel" id="contracts" tabIndex={-1}>
            <div className="panel-heading">
              <h2>Contracts & networks</h2>
              <Layers3 size={20} />
            </div>
            {p.contracts.length ? (
              p.contracts.map((c) => (
                <article
                  className="contract-row"
                  key={`${c.network}:${c.address}`}
                >
                  <div className="contract-heading">
                    <strong>{c.role}</strong>
                    <Badge
                      tone={
                        /test|sepolia/i.test(c.network) ? "amber" : "neutral"
                      }
                    >
                      {c.network || "Network unknown"}
                    </Badge>
                  </div>
                  <code className="address">{c.address}</code>
                  <div className="contract-actions">
                    <CopyButton value={c.address} />
                    <OutLink href={c.explorer}>View explorer</OutLink>
                    <OutLink href={c.source}>Address source</OutLink>
                  </div>
                  <p className="small-text">
                    {c.verification ||
                      "Address reported by project documentation; deployment and project association need independent verification."}
                  </p>
                </article>
              ))
            ) : (
              <div className="missing">
                <strong>No confirmed project contract recorded</strong>
                <p>
                  Verification pending. Addresses mentioned in requests are not
                  automatically treated as deployed contracts.
                </p>
              </div>
            )}
          </section>
          <section className="panel" id="delivery" tabIndex={-1}>
            <div className="panel-heading">
              <h2>Promises versus delivery</h2>
              <CircleCheck size={20} />
            </div>
            <p className="section-intro">
              Each conclusion has a narrow scope. A publication record does not
              test every feature.
            </p>
            {p.promises.length ? (
              p.promises.map((v, i) => (
                <article className="promise-row" key={i}>
                  <div className="contract-heading">
                    <h3>{v.promise}</h3>
                    <Badge
                      tone={
                        v.status === "Delivered"
                          ? "green"
                          : v.status === "Broken"
                            ? "red"
                            : v.status === "Partial"
                              ? "amber"
                              : "neutral"
                      }
                    >
                      {v.status}
                    </Badge>
                  </div>
                  <p>{v.evidence}</p>
                  <div className="small-text">
                    <OutLink href={v.source}>Evidence source</OutLink> ·
                    Delivered: {date(v.deliveredAt)} · Checked:{" "}
                    {date(v.checkedAt || p.checkedAt)}
                  </div>
                  {v.gaps && (
                    <p className="gap">
                      <strong>Remaining gap:</strong> {v.gaps}
                    </p>
                  )}
                </article>
              ))
            ) : (
              <p className="missing">
                No independently assessed delivery promises. Feature
                verification is pending.
              </p>
            )}
          </section>
          <section className="panel" id="timeline" tabIndex={-1}>
            <div className="panel-heading">
              <h2>Project timeline</h2>
              <Clock3 size={20} />
            </div>
            {elapsed !== undefined && elapsed >= 0 && (
              <p className="timeline-summary">
                <strong>{(elapsed / 3600000).toFixed(1)} hours</strong> from the
                recorded request to the first recorded publication. This is not
                time to full delivery.
              </p>
            )}
            <ol className="timeline">
              {timeline.map((t, i) => (
                <li key={i}>
                  <span className="timeline-dot" />
                  <div>
                    <time dateTime={t.at}>{date(t.at, true)}</time>
                    <h3>{t.label}</h3>
                    {t.note && <p>{t.note}</p>}
                    <OutLink href={t.source}>Timestamp source</OutLink>
                  </div>
                </li>
              ))}
            </ol>
            {!timeline.length && (
              <p>Confirmed event timestamps are not available.</p>
            )}
            <p className="small-text">
              A first feature-complete delivery date and a promised deadline are
              not inferred from publication. Check the original requests for any
              documented commitments.
            </p>
          </section>
          <section className="panel" id="sources" tabIndex={-1}>
            <div className="panel-heading">
              <h2>Sources & version history</h2>
              <ExternalLink size={20} />
            </div>
            <ul className="source-list">
              {p.sources.map((s, i) => (
                <li key={i}>
                  <OutLink href={s.url}>{s.label}</OutLink>
                </li>
              ))}
            </ul>
            {p.workflows.map((w) => (
              <details key={w.id}>
                <summary>
                  Original workflow request · {date(w.createdAt)}
                </summary>
                <pre
                  className="request-text"
                  tabIndex={0}
                  role="region"
                  aria-label="Original request text"
                >
                  {String(
                    w.originalRequest || w.objective || "Request not recorded",
                  )}
                </pre>
                <OutLink href={`${API}/workflows/${w.id}`}>
                  Full workflow record
                </OutLink>
              </details>
            ))}
            {p.jobs.map((j) => (
              <details key={j.id}>
                <summary>
                  Original request · {date(j.createdAt)}{" "}
                  <span className="mono">{j.id.slice(0, 8)}</span>
                </summary>
                <pre
                  className="request-text"
                  tabIndex={0}
                  role="region"
                  aria-label="Original request text"
                >
                  {j.originalRequest ||
                    j.objective ||
                    "Request text not available in this record."}
                </pre>
                <OutLink href={jobLink(j.id)}>
                  Full job and work history
                </OutLink>
              </details>
            ))}
            {!p.jobs.length && (
              <p className="small-text">
                An original platform-building request has not been linked.
                Related marketing tasks are not treated as builder attribution.
              </p>
            )}
            {p.sites.map((s) => (
              <details key={s.id}>
                <summary>
                  {s.supersededBy
                    ? "Old version"
                    : s.takenDownAt
                      ? "Removed site"
                      : "Site record"}{" "}
                  · {s.label || s.id.slice(0, 8)}
                </summary>
                <p className="small-text">
                  Record ID: <code>{s.id}</code>
                  <br />
                  Created: {date(s.createdAt, true)}
                  <br />
                  Registry status: {s.status || "Unknown"}
                  {s.supersededBy && (
                    <>
                      <br />
                      Explicitly superseded by: <code>{s.supersededBy}</code>
                    </>
                  )}
                  {s.takenDownReason && (
                    <>
                      <br />
                      Removal reason: {s.takenDownReason}
                    </>
                  )}
                </p>
                <div className="inline-links">
                  <OutLink href={s.url}>Recorded website</OutLink>
                  {s.cid && (
                    <OutLink href={`https://ipfs.io/ipfs/${s.cid}/`}>
                      Open IPFS copy
                    </OutLink>
                  )}
                  <OutLink href={`${API}/sites/${s.id}`}>API record</OutLink>
                </div>
              </details>
            ))}
          </section>
        </div>
        <aside className="detail-aside">
          <div className="panel">
            <h2>Read the evidence</h2>
            <p className="small-text">
              “Verified” means a specific fact was checked against a named
              source at a recorded time. It is never a blanket safety rating.
            </p>
            <a href="#/evidence">
              Our evidence guide <ArrowRight size={14} />
            </a>
          </div>
          <div className="panel">
            <h2>What’s still unknown</h2>
            <ul className="risk-list">
              {p.risks.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </>
  );
}
function Evidence({ snapshot }: { snapshot: Snapshot }) {
  return (
    <div className="evidence-page">
      <a className="back-link" href="#/">
        <ArrowLeft size={16} /> All projects
      </a>
      <span className="eyebrow">CLEAR SOURCES. LIMITED CLAIMS.</span>
      <h1>Know what you’re looking at.</h1>
      <p className="lead">
        A useful directory should help you ask better questions. Here’s what our
        labels mean, and where the evidence stops.
      </p>
      <div className="panel">
        <h2>Four different kinds of evidence</h2>
        {[
          [
            "Publication recorded",
            "The IdentityMD API records a website or IPFS publication with a timestamp. It does not establish uptime or feature completeness.",
          ],
          [
            "Link reachable",
            "An HTTP request to the linked site succeeded at the recorded check time. This is not a full browser or feature test.",
          ],
          [
            "Feature tested",
            "A named feature was exercised with a documented method, date and result. We do not apply this label without a test record.",
          ],
          [
            "Unverified claim",
            "A purpose, capability or promise stated in a request, repository or project website. It has not been independently demonstrated.",
          ],
        ].map(([title, text]) => (
          <div className="explanation" key={title}>
            <h3>{title}</h3>
            <p>{text}</p>
          </div>
        ))}
      </div>
      <div className="panel">
        <h2>What “Verified” means</h2>
        <p>
          Only a specific fact, checked against an identified source at a
          recorded time, can be described as verified. No project receives a
          blanket “Verified” badge here. Build acceptance, an onchain review and
          publication are separate events. None proves that every feature works,
          that ownership is unchanged, or that a financial product is safe.
        </p>
        <p>
          No project scores or rankings of quality are calculated. “Featured
          first” places the two specifically requested projects first; it is not
          an endorsement.
        </p>
      </div>
      <div className="panel">
        <h2>Coverage & freshness</h2>
        <p>
          Snapshot collected {date(snapshot.checkedAt, true)}. The site keeps
          its last valid data when a refresh fails. Detailed evidence retains
          its own check date.
        </p>
        <p>
          All discovered site records appear in the site directory. Explicit
          registry supersession, parent-job links and publication version groups
          can establish history. Similar names or domains cannot.
        </p>
        <p>
          Categories and compact titles are editorial navigation aids derived
          from public descriptions. The raw request and registry label remain
          available in details. Project groups are not a count of unique active
          services.
        </p>
        <details open>
          <summary>Collection coverage and limitations</summary>
          <pre
            className="coverage-json"
            tabIndex={0}
            role="region"
            aria-label="Collection coverage data"
          >
            {JSON.stringify(snapshot.coverage, null, 2)}
          </pre>
        </details>
        <div className="inline-links">
          <OutLink href={`${API}/sites`}>Sites API</OutLink>
          <OutLink href={`${API}/publications?type=sites&page=1&pageSize=100`}>
            Publications API
          </OutLink>
          <OutLink href="https://explorer.imd.fun/">
            IdentityMD Explorer
          </OutLink>
          <a href="./data/snapshot.json" download>
            Download snapshot <ArrowRight size={14} />
          </a>
        </div>
      </div>
    </div>
  );
}
export default function App() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [features, setFeatures] = useState<Featured[]>([]);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hash, setHash] = useState(location.hash || "#/");
  const [theme, setTheme] = useState(
    document.documentElement.dataset.theme || "light",
  );
  async function refreshData(previous: Snapshot) {
    setIsRefreshing(true);
    setRefresh("Checking the live registry…");
    try {
      const live = await refreshSnapshot(previous);
      setSnapshot(live);
      setRefresh(
        "Live registry checked. Detailed evidence keeps its own date.",
      );
    } catch {
      setRefresh(
        "Live refresh unavailable. Showing the last complete snapshot; no records were discarded.",
      );
    } finally {
      setIsRefreshing(false);
    }
  }
  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("./data/snapshot.json").then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      }),
      fetch("./data/featured.json").then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      }),
    ])
      .then(([data, featured]) => {
        if (!Array.isArray(data.sites) || !data.sites.length) throw new Error();
        if (active) {
          setSnapshot(data);
          setFeatures(
            Array.isArray(featured) ? featured : featured.projects || [],
          );
          void refreshData(data);
        }
      })
      .catch(() => {
        if (active)
          setError(
            "The directory snapshot could not load. Reload the page or check that the complete dist folder was published.",
          );
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    const handler = () => setHash(location.hash || "#/");
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);
  const projects = useMemo(
    () => (snapshot ? buildProjects(snapshot, features) : []),
    [snapshot, features],
  );
  const parts = hash.replace(/^#/, "").split("/");
  const project =
    parts[1] === "project"
      ? projects.find((p) => p.id === (parts[2] || ""))
      : undefined;
  useEffect(() => {
    const target =
      parts[1] === "directory"
        ? "directory"
        : parts[1] === "project"
          ? parts[3]
          : undefined;
    if (target) {
      requestAnimationFrame(() => {
        const element = document.getElementById(target);
        element?.scrollIntoView();
        element?.focus({ preventScroll: true });
      });
    } else {
      window.scrollTo(0, 0);
      if (hash !== "#/")
        document.getElementById("main")?.focus({ preventScroll: true });
    }
    document.title = `${project ? project.name + " — " : ""}${brand.name} — IdentityMD project directory`;
  }, [hash, snapshot !== null, project?.id]);
  useEffect(() => {
    if (brand.favicon) {
      const link = document.createElement("link");
      link.rel = "icon";
      link.href = brand.favicon;
      document.head.append(link);
      return () => link.remove();
    }
  }, []);
  const toggle = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("swarm-alpha-theme", next);
    } catch {
      /* Choice still applies for this session. */
    }
  };
  return (
    <>
      <a
        className="skip-link"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main")?.focus();
        }}
      >
        Skip to content
      </a>
      <header className="header">
        <div className="header-inner">
          <a className="brand" href="#/" aria-label={`${brand.name} home`}>
            {brand.logo && <img src={brand.logo} alt="" />}
            <span>{brand.name}</span>
            <span className="brand-pill">DIRECTORY</span>
          </a>
          <nav aria-label="Primary">
            <a href="#/" className={parts[1] === "" ? "active" : ""}>
              Explore
            </a>
            <a href="#/directory">Site directory</a>
            <a
              href="#/evidence"
              className={parts[1] === "evidence" ? "active" : ""}
            >
              About the data
            </a>
          </nav>
          <button
            className="theme-toggle"
            onClick={toggle}
            aria-label={
              theme === "light"
                ? "Switch to dark theme"
                : "Switch to light theme"
            }
            title={
              theme === "light"
                ? "Switch to dark theme"
                : "Switch to light theme"
            }
          >
            {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
            <span>{theme === "light" ? "Dark" : "Light"}</span>
          </button>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="container">
        {error ? (
          <div className="empty surface">
            <h1>Directory unavailable</h1>
            <p>{error}</p>
            <button className="button" onClick={() => location.reload()}>
              Reload directory
            </button>
          </div>
        ) : !snapshot ? (
          <div className="loading" role="status">
            <Layers3 size={30} />
            <h1>Opening the directory…</h1>
            <p>Loading the timestamped public records.</p>
          </div>
        ) : (
          <>
            {parts[1] === "evidence" ? (
              <Evidence snapshot={snapshot} />
            ) : parts[1] === "project" ? (
              project ? (
                <Detail project={project} />
              ) : (
                <div className="empty">
                  <h1>Project not found</h1>
                  <p>This link does not match a collected project record.</p>
                  <a className="button" href="#/">
                    Browse all projects
                  </a>
                </div>
              )
            ) : (
              <Home snapshot={snapshot} projects={projects} />
            )}
            <div className="freshness">
              <div>
                <span className="freshness-label">
                  <span className="status-dot" /> Data last collected{" "}
                  {date(
                    String(snapshot.liveCheckedAt || snapshot.checkedAt),
                    true,
                  )}
                </span>
                <span className="small-text" role="status">
                  {refresh || "Timestamped snapshot available."}
                </span>
              </div>
              <button
                className="button small-button"
                disabled={isRefreshing}
                onClick={() => void refreshData(snapshot)}
              >
                <RefreshCw size={14} />
                {isRefreshing ? "Checking…" : "Refresh data"}
              </button>
            </div>
          </>
        )}
      </main>
      <footer>
        <div className="container footer-inner">
          <div>
            <a href="#/" className="footer-brand">
              {brand.name}
            </a>
            <p>{brand.tagline}</p>
          </div>
          <div>
            <span>Built for the curious.</span>
            <a href="#/evidence">
              Sources & methodology <ArrowUpRight size={14} />
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}
