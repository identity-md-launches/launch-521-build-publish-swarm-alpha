import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildProjects, matches, normalize, safeUrl, date } from "../src/model";
import type { Featured, JobRecord, SiteRecord, Snapshot } from "../src/types";

const snapshot = JSON.parse(
  readFileSync(
    new URL("../public/data/snapshot.json", import.meta.url),
    "utf8",
  ),
) as Snapshot;
const featured = JSON.parse(
  readFileSync(
    new URL("../public/data/featured.json", import.meta.url),
    "utf8",
  ),
) as Featured[];
const projects = buildProjects(snapshot, featured);
const pepe = projects.find((p) => p.id === "pepe2pepe")!;
const hive = projects.find((p) => p.id === "hive")!;
const baseTime = "2026-09-01T12:00:00Z";
const fixture = (sites: SiteRecord[], jobs: JobRecord[] = []): Snapshot => ({
  checkedAt: baseTime,
  coverage: {},
  sites,
  jobs,
  workflows: [],
});
const site = (id: string, extra: Partial<SiteRecord> = {}): SiteRecord => ({
  id,
  label: "same-name",
  url: "https://same.example/",
  createdAt: baseTime,
  status: "named",
  ...extra,
});

test("Pepe2Pepe is found by name, domain, URL, case and trailing-slash variants", () => {
  assert.ok(pepe, "The requested external project is present");
  for (const query of [
    "pepe2pepe",
    "pepe2pepe.fun",
    "https://pepe2pepe.fun/",
    " HTTPS://WWW.PEPE2PEPE.FUN/ ",
  ]) {
    assert.equal(matches(pepe, query), true, query);
    assert.equal(
      projects
        .filter((p) => matches(p, query))
        .some((p) => p.id === "pepe2pepe"),
      true,
    );
  }
  assert.equal(normalize(" HTTPS://WWW.PEPE2PEPE.FUN/ "), "pepe2pepe.fun");
});

test("Numeric NFT and agent IDs are exact identifiers, including useful prefixes", () => {
  for (const query of ["1974", "#1974", "NFT 1974", "NFT #1974", "51361"])
    assert.equal(matches(pepe, query), true, query);
  for (const query of ["197", "#197", "5136", "9999999"])
    assert.equal(matches(pepe, query), false, query);
  assert.equal(matches(hive, "1639"), true);
  assert.equal(matches(hive, "51557"), true);
  assert.equal(matches(hive, "#1974"), false);
});

test("Confirmed contract search is case-insensitive and includes both mainnets", () => {
  for (const address of [
    "0x54F97D8B32D8E90770D76B7D9EEDE1B77E28E3B8",
    "0x412f9b71c119aee1bec6331a7cb7bb5c4fa1518b",
  ]) {
    assert.equal(matches(pepe, address), true);
  }
  assert.equal(
    matches(hive, "0xCdaE63D95D6dd4f89f6e508c77bD4388b4e5C8Ab"),
    true,
  );
  assert.ok(pepe.contracts.some((c) => /Ethereum mainnet/.test(c.network)));
  assert.ok(pepe.contracts.some((c) => /Robinhood mainnet/.test(c.network)));
  for (const c of [...pepe.contracts, ...hive.contracts]) {
    assert.doesNotMatch(c.network, /testnet|sepolia/i);
    assert.equal(
      c.explorer?.includes("etherscan.io"),
      c.network.includes("Ethereum"),
    );
  }
});

test("Every discovered site record survives project reconciliation exactly once", () => {
  assert.equal(
    snapshot.sites.length,
    151,
    "The delivered snapshot includes all 151 discovered site records",
  );
  const expected = snapshot.sites.map((s) => s.id).sort();
  const mapped = projects.flatMap((p) => p.sites.map((s) => s.id)).sort();
  assert.deepEqual(mapped, expected);
  assert.equal(new Set(mapped).size, 151);
  for (const removed of snapshot.sites.filter((s) => s.takenDownAt)) {
    assert.ok(
      projects.some((p) =>
        p.sites.some(
          (s) => s.id === removed.id && s.takenDownAt === removed.takenDownAt,
        ),
      ),
    );
  }
  assert.ok(
    projects.some((p) => p.sites.some((s) => s.supersededBy)),
    "Older versions are retained",
  );
});

test("Explicit supersession groups versions while preserving old URLs", () => {
  const input = fixture([
    site("old", { url: "https://old.example/", supersededBy: "new" }),
    site("new", {
      url: "https://new.example/",
      createdAt: "2026-09-02T12:00:00Z",
    }),
  ]);
  const result = buildProjects(input, []);
  assert.equal(result.length, 1);
  assert.deepEqual(
    new Set(result[0].sites.map((s) => s.url)),
    new Set(["https://old.example/", "https://new.example/"]),
  );
  assert.equal(result[0].url, "https://new.example/");
});

test("Explicit project version links reconcile differently named versions", () => {
  const versionInfo = {
    id: "job-a",
    head: "job-b",
    versions: [{ jobId: "job-a" }, { jobId: "job-b" }],
  };
  const input = fixture(
    [
      site("a", {
        label: "first-brand",
        jobId: "job-a",
        url: "https://a.example/",
      }),
      site("b", {
        label: "totally-different-brand",
        jobId: "job-b",
        url: "https://b.example/",
        createdAt: "2026-09-02T12:00:00Z",
      }),
    ],
    [
      {
        id: "job-a",
        objective: "First project request",
        createdAt: baseTime,
        project: versionInfo,
      },
      {
        id: "job-b",
        objective: "Explicit continuation",
        createdAt: "2026-09-02T11:00:00Z",
        parentJobId: "job-a",
        project: versionInfo,
      },
    ],
  );
  const result = buildProjects(input, []);
  assert.equal(result.length, 1);
  assert.deepEqual(
    new Set(result[0].jobs.map((j) => j.id)),
    new Set(["job-a", "job-b"]),
  );
  assert.equal(result[0].sites.length, 2);
});

test("Publication records can explicitly group site versions without similar names", () => {
  const input = fixture([
    site("pub-a", { label: "alpha" }),
    site("pub-b", { label: "zulu" }),
  ]);
  input.publications = [
    { id: "publication-group", siteIds: ["pub-a", "pub-b"] },
  ];
  const result = buildProjects(input, []);
  assert.equal(result.length, 1);
  assert.deepEqual(
    new Set(result[0].sites.map((s) => s.id)),
    new Set(["pub-a", "pub-b"]),
  );
});

test("Similar names and identical domains alone never merge unrelated projects", () => {
  const result = buildProjects(
    fixture(
      [site("one", { jobId: "job-one" }), site("two", { jobId: "job-two" })],
      [
        { id: "job-one", objective: "Build the same name" },
        { id: "job-two", objective: "Build the same name" },
      ],
    ),
    [],
  );
  assert.equal(result.length, 2);
  assert.deepEqual(
    result.map((p) => p.sites.length),
    [1, 1],
  );
});

test("A removed-site fixture remains visible with its recorded removal reason", () => {
  const result = buildProjects(
    fixture([
      site("removed", {
        takenDownAt: "2026-09-03T12:00:00Z",
        takenDownReason: "Recorded fixture reason",
      }),
    ]),
    [],
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].status, "Removed");
  assert.equal(result[0].sites[0].takenDownReason, "Recorded fixture reason");
});

test("Missing supersession targets preserve the old record without inventing a successor", () => {
  const result = buildProjects(
    fixture([site("orphan", { supersededBy: "not-in-data" })]),
    [],
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].sites[0].id, "orphan");
  assert.equal(result[0].sites[0].supersededBy, "not-in-data");
});

test("Workflow deployments carry their actual Sepolia network, not review-chain Ethereum", () => {
  const workflows = snapshot.workflows as Array<Record<string, any>>;
  const deployed = workflows.filter((w) => w.handoff?.contracts?.length);
  assert.ok(
    deployed.length > 100,
    "The test covers the deployed workflow set, not one example",
  );
  let checked = 0;
  for (const workflow of deployed) {
    assert.equal(workflow.handoff.chainId, 11155111);
    const project = projects.find((p) =>
      p.workflows.some((w) => w.id === workflow.id),
    );
    if (!project) continue; // A workflow without a discovered site need not create a website card.
    for (const raw of workflow.handoff.contracts) {
      const shown = project.contracts.find(
        (c) => c.address.toLowerCase() === raw.address.toLowerCase(),
      );
      assert.ok(
        shown,
        `Mapped contract ${raw.name} for workflow ${workflow.id}`,
      );
      assert.match(shown.network, /sepolia|11155111/i);
      assert.match(shown.explorer || "", /^https:\/\/sepolia\.etherscan\.io\//);
      checked++;
    }
  }
  assert.ok(
    checked > 100,
    `At least 100 deployed addresses must be mapped; observed ${checked}`,
  );
});

test("Builders come from named work nodes and owner evidence has a source and time", () => {
  const p = projects.find((p) =>
    p.sites.some((s) => s.id === "7a9742d4-4de5-422e-b73c-ff37d37105af"),
  )!;
  assert.ok(p);
  assert.ok(
    p.agents.some((a) => String(a.tokenId) === "1120" && a.agentId === "50957"),
  );
  const owner = p.agents.find((a) => String(a.tokenId) === "1120" && a.owner);
  assert.ok(owner?.ownerSource);
  assert.ok(owner?.ownerCheckedAt);
  assert.match(owner?.profile || "", /\/agents\/1120$/);
  assert.ok(
    hive.agents.every((a) => /fleet/i.test(a.role)),
    "HIVE fleet members are not presented as platform builders",
  );
  assert.match(pepe.agents[0].role, /marketing/i);
});

test("Automated verification and publishing are not assigned invented NFT owners", () => {
  const p = projects.find((p) =>
    p.sites.some((s) => s.id === "7a9742d4-4de5-422e-b73c-ff37d37105af"),
  )!;
  const automated = p.agents.filter((a) => /automated/i.test(a.type || ""));
  assert.ok(automated.some((a) => /verifier/i.test(a.role)));
  assert.ok(automated.some((a) => /publisher/i.test(a.role)));
  for (const service of automated) {
    assert.equal(service.tokenId, undefined);
    assert.equal(service.owner, undefined);
    assert.ok(service.workUrl, "The service role retains its evidence link");
  }
});

test("Missing values stay missing and request addresses do not become deployments", () => {
  const request =
    "Build a website using token 0x1111111111111111111111111111111111111111";
  const result = buildProjects(
    fixture(
      [site("minimal", { jobId: "job", url: null, status: "pending" })],
      [
        {
          id: "job",
          objective: request,
          state: "completed",
          createdAt: baseTime,
          updatedAt: "2026-09-03T12:00:00Z",
        },
      ],
    ),
    [],
  )[0];
  assert.equal(result.url, undefined);
  assert.equal(result.contracts.length, 0);
  assert.equal(result.agents.length, 0);
  assert.equal(
    result.promises.some((p) => p.status === "Delivered"),
    false,
  );
  assert.equal(
    result.timeline.some((t) => /deliver|publish|publication/i.test(t.label)),
    false,
  );
  assert.equal(date(undefined), "Not recorded");
  assert.equal(date("not-a-date"), "Not recorded");
});

test("External featured projects do not borrow unrelated jobs or invented launch dates", () => {
  for (const p of [hive, pepe]) {
    assert.deepEqual(p.sites, []);
    assert.deepEqual(p.jobs, []);
    assert.equal(p.featured?.firstDeliveryAt, null);
    assert.equal(p.featured?.firstPublishedAt, null);
    assert.equal(p.featured?.promisedDeadline, null);
    assert.ok(
      p.risks.some((r) => /original|first delivery|first publication/i.test(r)),
    );
  }
  assert.ok(
    pepe.timeline.every(
      (t) =>
        !/^(first delivery|project published|platform launched)$/i.test(
          t.label,
        ),
    ),
  );
  assert.equal(
    hive.promises.find((p) => /Automatically purchase/.test(p.promise))?.status,
    "Pending",
  );
  assert.equal(
    hive.promises.find((p) => /Publish source code/.test(p.promise))
      ?.deliveredAt,
    undefined,
    "A git commit time is not an independently confirmed public-push time",
  );
});

test("Untrusted external URLs cannot become executable links", () => {
  assert.equal(safeUrl("javascript:alert(1)"), undefined);
  assert.equal(safeUrl("data:text/html,test"), undefined);
  assert.equal(safeUrl("https://pepe2pepe.fun/"), "https://pepe2pepe.fun/");
});
