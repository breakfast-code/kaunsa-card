"use client";

import Link from "next/link";
import { SignInButton, UserButton } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

const date = (value: number) => new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
const words = (value: string) => value.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function AdminPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const data = useQuery(api.admin.overview, isAuthenticated ? {} : "skip");
  if (isLoading) return <AdminState message="Checking access…" />;
  if (!isAuthenticated) return <AdminState message="Sign in with the admin account to view private card rules."><SignInButton mode="modal"><button className="primary">Sign in</button></SignInButton></AdminState>;
  if (data === undefined) return <AdminState message="Loading private rules…" />;
  if (data.access !== "granted") return <AdminState message="This account does not have admin access."><UserButton /></AdminState>;

  return <main className="admin-shell">
    <header className="admin-header"><div><Link href="/">← Kaunsa Card?</Link><span>Private admin</span></div><UserButton /></header>
    <section className="admin-intro"><div><p className="eyebrow">RULE COVERAGE</p><h1>What the recommendation engine knows</h1><p>Read-only view of the private data currently saved in Convex.</p></div><small>Updated {date(data.generatedAt)}</small></section>
    <section className="admin-metrics"><Metric value={data.counts.cards} label="Cards" /><Metric value={data.counts.directRules} label="Direct rules" /><Metric value={data.counts.routes} label="Portal & voucher routes" /><Metric value={data.counts.sources} label="Official sources" /></section>
    <AdminSection heading="Cards" note="Coverage and rule counts by card"><div className="admin-table"><div className="admin-table-head"><span>Card</span><span>Coverage</span><span>Rules</span><span>Checked</span></div>{data.cards.map((card) => <div className="admin-table-row" key={card.cardKey}><span><strong>{card.name}</strong><small>{card.bank} · {card.cardKey}</small></span><span><Status value={card.status} /><small>{words(card.coverage)}</small></span><span>{card.directRuleCount} direct · {card.routeCount} routed</span><span>{date(card.checkedAt)}</span></div>)}</div></AdminSection>
    <AdminSection heading="Direct rules" note={`${data.counts.directRules} saved versions`}><div className="admin-details">{data.directRules.map((rule) => <details key={`${rule.ruleKey}-${rule.version}`}><summary><span><strong>{rule.cardKey}</strong><small>{rule.ruleKey} · v{rule.version}</small></span><span>{rule.purchaseTypes.join(", ")}</span><Status value={rule.status} /></summary><div><p>{rule.matchedRule}</p>{rule.caveat && <p className="admin-caveat">{rule.caveat}</p>}<dl><dt>Payment</dt><dd>{rule.paymentModes.join(", ")}</dd><dt>Outcome</dt><dd>{rule.outcome} · {rule.rewardCurrency}</dd><dt>Checked</dt><dd>{date(rule.checkedAt)}</dd></dl><a href={rule.sourceUrl} target="_blank" rel="noreferrer">Open official source ↗</a></div></details>)}</div></AdminSection>
    <AdminSection heading="Portal and voucher routes" note="Special routes that compete with paying directly"><div className="admin-details">{data.routes.map((route) => <details key={`${route.routeKey}-${route.version}`}><summary><span><strong>{route.card}</strong><small>{route.platform} · {route.routeKey} · v{route.version}</small></span><span>{words(route.routeType)} · {words(route.purchaseType)}</span><Status value={route.status} /></summary><div><p>{route.evidence}</p><dl><dt>Payment</dt><dd>{words(route.paymentMode)}</dd><dt>Merchant</dt><dd>{route.merchant ?? "Any eligible merchant"}</dd><dt>Checked</dt><dd>{date(route.checkedAt)}</dd></dl>{route.sourceUrl && <a href={route.sourceUrl} target="_blank" rel="noreferrer">Open official source ↗</a>}</div></details>)}</div></AdminSection>
    <AdminSection heading="Official sources" note={`${data.counts.sources} source records; ${data.sources.filter((source) => source.hasFingerprint).length} fingerprinted`}><div className="admin-source-grid">{data.sources.map((source) => <a href={source.url} target="_blank" rel="noreferrer" key={source.sourceKey}><small>{source.publisher} · {words(source.kind)}</small><strong>{source.title}</strong><span>Retrieved {date(source.retrievedAt)} · {source.hasFingerprint ? "Fingerprinted" : "No fingerprint"} ↗</span></a>)}</div></AdminSection>
    <p className="admin-footnote">Also saved: {data.counts.proposals} research proposals, {data.counts.coverageCells} coverage cells, and {data.counts.legacyRules} legacy rule records. These do not power the launch recommendation API.</p>
  </main>;
}

function Metric({ value, label }: { value: number; label: string }) { return <div><strong>{value}</strong><span>{label}</span></div>; }
function Status({ value }: { value: string }) { return <span className={`admin-status ${value}`}>{words(value)}</span>; }
function AdminSection({ heading, note, children }: { heading: string; note: string; children: React.ReactNode }) { return <section className="admin-section"><div className="admin-section-head"><h2>{heading}</h2><p>{note}</p></div>{children}</section>; }
function AdminState({ message, children }: { message: string; children?: React.ReactNode }) { return <main className="admin-state"><Link href="/">← Kaunsa Card?</Link><div><span className="logo-mark">K</span><h1>Private admin</h1><p>{message}</p>{children}</div></main>; }
