"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { SignInButton, UserButton, useUser } from "@clerk/nextjs";
import { cardCatalogue as cards, cardIssuers as issuers, PaymentMode, PurchaseType, PublicCard } from "@/lib/card-catalogue";
import { estimatedValueLabel } from "@/lib/value-display";
import { merchants, resolveMerchant } from "@/lib/merchants";
import { useConvex, useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAnalytics } from "./AnalyticsProvider";
import { LandingDemo } from "./LandingDemo";
import { clearWallet, readWallet, shouldRestoreAccount, writeWallet } from "@/lib/wallet-storage";

type Screen = "landing" | "wallet" | "ask" | "result";
const screens: Screen[] = ["landing", "wallet", "ask", "result"];
const purchaseTypes: PurchaseType[] = ["shopping", "flight", "hotel", "dining", "utility", "insurance", "fuel", "rent", "education", "jewellery", "railway", "government", "gaming", "toll", "gift-card", "emi", "general"];
const money = (value: number) => `₹${Math.round(value).toLocaleString("en-IN")}`;
const merchantNames = merchants.map((merchant) => merchant.name);

type Recommendation = {
  id: string;
  cardKey: string;
  cardName: string;
  issuer: string;
  kind: "direct" | "voucher" | "portal";
  title: string;
  action: string;
  pointsLabel: string;
  minValue: number;
  maxValue: number;
  bestValueLabel?: string;
  bestValueCalculation?: string;
  bestValueSourceUrl?: string;
  fallbackValue?: number;
  fallbackValueLabel?: string;
  fallbackValueCalculation?: string;
  fallbackValueSourceUrl?: string;
  matchedRule: string;
  calculation?: string;
  caveat?: string;
  sourceUrl?: string;
  checkedAt?: number;
  conditional: boolean;
  effort?: string;
};

export default function Home() {
  const captureAnalytics = useAnalytics();
  const convex = useConvex();
  const { isSignedIn, user } = useUser();
  const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
  const [ready, setReady] = useState(false);
  const [screen, setScreen] = useState<Screen>("landing");
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [activeIds, setActiveIds] = useState<string[]>([]);
  const [merchant, setMerchant] = useState("");
  const [purchaseText, setPurchaseText] = useState("");
  const [parsed, setParsed] = useState(false);
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<PurchaseType>("shopping");
  const [mode, setMode] = useState<PaymentMode>("online");
  const [issuer, setIssuer] = useState("All");
  const [search, setSearch] = useState("");
  const [requestOpen, setRequestOpen] = useState(false);
  const [includePortals, setIncludePortals] = useState(true);
  const [voucherSpendThisMonth, setVoucherSpendThisMonth] = useState("0");
  const [sbiCashbackEarned, setSbiCashbackEarned] = useState("0");
  const [feedbackName, setFeedbackName] = useState("");
  const [feedbackNote, setFeedbackNote] = useState("");
  const [feedbackVerdict, setFeedbackVerdict] = useState<"useful" | "unsure" | "wrong" | null>(null);
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [accountStatus, setAccountStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [results, setResults] = useState<Recommendation[]>([]);
  const [recommendationStatus, setRecommendationStatus] = useState<"idle" | "loading" | "empty" | "error">("idle");
  const previousSignedIn = useRef<boolean | undefined>(undefined);
  const restoredAccountId = useRef<string | null>(null);
  const suppressNextWalletWrite = useRef(false);
  const account = useQuery(api.accounts.me, isConvexAuthenticated ? {} : "skip");
  const submitFeedback = useMutation(api.recommendationFeedback.submit);
  const saveFirstUse = useMutation(api.accounts.saveFirstUse);

  const goTo = useCallback((next: Screen) => {
    setScreen(next);
    let url = next === "landing" ? "/" : `/?step=${next}`;
    if (next === "result") {
      const matched = resolveMerchant(merchant);
      const params = new URLSearchParams({
        m: matched?.key ?? merchant.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        amt: amount,
        type,
        mode,
      });
      url = `/?${params.toString()}`;
    }
    window.history.pushState({ screen: next }, "", url);
  }, [amount, merchant, mode, type]);

  useEffect(() => {
    const wallet = readWallet(localStorage, new Set(cards.map((card) => card.id)));
    const params = new URLSearchParams(window.location.search);
    const queryMerchant = params.get("m")?.trim() ?? "";
    const queryAmount = params.get("amt")?.trim() ?? "";
    const queryType = params.get("type") as PurchaseType | null;
    const queryMode = params.get("mode") as PaymentMode | null;
    const hasPurchaseQuery = Boolean(queryMerchant && Number(queryAmount) > 0 && queryType && purchaseTypes.includes(queryType) && (queryMode === "online" || queryMode === "store"));
    let initialScreen: Screen = "landing";
    if (wallet.saved.length) {
        const saved = wallet.saved;
        const active = wallet.active;
        // Browser wallet restoration happens once after hydration.
        setSavedIds(saved);
        setActiveIds(active);
        if (active.length && hasPurchaseQuery) {
          const knownMerchant = resolveMerchant(queryMerchant);
          setMerchant(knownMerchant?.name ?? queryMerchant.replace(/-/g, " "));
          setAmount(String(Math.round(Number(queryAmount))));
          setType(knownMerchant?.defaultType ?? queryType as PurchaseType);
          setMode(queryMode as PaymentMode);
          initialScreen = "result";
        } else {
          initialScreen = active.length ? "ask" : saved.length ? "wallet" : "landing";
        }
        setScreen(initialScreen);
    }
    const initialUrl = initialScreen === "result" ? `${window.location.pathname}${window.location.search}` : initialScreen === "landing" ? "/" : `/?step=${initialScreen}`;
    window.history.replaceState({ screen: initialScreen }, "", initialUrl);
    setReady(true);
  }, []);

  useEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => { window.history.scrollRestoration = previous; };
  }, []);

  useEffect(() => {
    const handleBack = (event: PopStateEvent) => {
      const next = event.state?.screen;
      if (screens.includes(next)) setScreen(next);
    };
    window.addEventListener("popstate", handleBack);
    return () => window.removeEventListener("popstate", handleBack);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (suppressNextWalletWrite.current) {
      suppressNextWalletWrite.current = false;
      clearWallet(localStorage);
      return;
    }
    writeWallet(localStorage, { saved: savedIds, active: activeIds });
  }, [savedIds, activeIds, ready]);

  useEffect(() => {
    const accountId = user?.id;
    if (!ready || !isConvexAuthenticated || account === undefined || !shouldRestoreAccount(accountId, restoredAccountId.current)) return;
    restoredAccountId.current = accountId ?? null;
    if (!account) return;
    const supportedIds = new Set(cards.map((card) => card.id));
    const saved = account.savedCardIds.filter((id) => supportedIds.has(id));
    setSavedIds(saved);
    setActiveIds(account.activeCardIds.filter((id) => saved.includes(id)));
  }, [account, isConvexAuthenticated, ready, user?.id]);

  useEffect(() => {
    if (!ready || isSignedIn === undefined) return;
    if (previousSignedIn.current === true && isSignedIn === false) {
      suppressNextWalletWrite.current = true;
      clearWallet(localStorage);
      restoredAccountId.current = null;
      setSavedIds([]);
      setActiveIds([]);
      setMerchant("");
      setPurchaseText("");
      setAmount("");
      setParsed(false);
      setType("shopping");
      setMode("online");
      setIncludePortals(true);
      setVoucherSpendThisMonth("0");
      setSbiCashbackEarned("0");
      setFeedbackName("");
      setFeedbackVerdict(null);
      setFeedbackStatus("");
      setFeedbackNote("");
      setAccountStatus("idle");
      setScreen("landing");
      window.history.replaceState({ screen: "landing" }, "", "/");
    }
    previousSignedIn.current = isSignedIn;
  }, [isSignedIn, ready]);

  useLayoutEffect(() => {
    if (screen !== "result") return;
    window.scrollTo(0, 0);
    const frame = requestAnimationFrame(() => window.scrollTo(0, 0));
    const timer = window.setTimeout(() => window.scrollTo(0, 0), 120);
    return () => { cancelAnimationFrame(frame); window.clearTimeout(timer); };
  }, [screen]);

  const catalogue = cards.filter((card) => (issuer === "All" || card.issuer === issuer) && `${card.name} ${card.issuer}`.toLowerCase().includes(search.toLowerCase()));
  const walletCards = cards.filter((card) => savedIds.includes(card.id));
  const matchedMerchant = resolveMerchant(merchant);
  const requestRecommendations = useCallback(async () => {
    setRecommendationStatus("loading");
    setResults([]);
    try {
      const request = convex.query(api.recommendations.get, {
        amount: Number(amount), merchant, purchaseType: type, paymentMode: mode,
        cardIds: activeIds, now: Date.now(),
        includePortals,
        voucherSpendThisMonth: Number(voucherSpendThisMonth),
        sbiCashbackEarnedThisCycle: Number(sbiCashbackEarned),
      });
      const next = await Promise.race([
        request,
        new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error("Recommendation request timed out.")), 8000)),
      ]);
      setResults(next);
      setRecommendationStatus(next.length ? "idle" : "empty");
      captureAnalytics("recommendation_generated", { purchase_type: type, payment_mode: mode, known_merchant: Boolean(resolveMerchant(merchant)), active_cards: activeIds.length });
      setAccountStatus("idle");
      goTo("result");
    } catch {
      setRecommendationStatus("error");
    }
  }, [activeIds, amount, captureAnalytics, convex, goTo, includePortals, merchant, mode, sbiCashbackEarned, type, voucherSpendThisMonth]);

  useEffect(() => {
    if (!ready || screen !== "result" || results.length || recommendationStatus !== "idle") return;
    void requestRecommendations();
  }, [ready, recommendationStatus, requestRecommendations, results.length, screen]);

  useEffect(() => {
    if (screen !== "result" || !isSignedIn || !isConvexAuthenticated || !user || !results[0] || accountStatus !== "idle") return;
    setAccountStatus("saving");
    void saveFirstUse({
      savedCardIds: savedIds,
      activeCardIds: activeIds,
      merchant,
      purchaseType: type,
      winningRoute: results[0].id,
    }).then(({ created }) => {
      setAccountStatus("saved");
      captureAnalytics(created ? "signup_with_first_use" : "signed_in_first_use", { purchase_type: type, payment_mode: mode });
    }).catch(() => setAccountStatus("error"));
  }, [accountStatus, activeIds, captureAnalytics, isConvexAuthenticated, isSignedIn, merchant, mode, results, savedIds, saveFirstUse, screen, type, user]);

  const addCard = (id: string) => {
    setSavedIds((current) => current.includes(id) ? current : [...current, id]);
    setActiveIds((current) => current.includes(id) ? current : [...current, id]);
  };
  const removeCard = (id: string) => {
    setSavedIds((current) => current.filter((item) => item !== id));
    setActiveIds((current) => current.filter((item) => item !== id));
  };
  const toggleActive = (id: string) => setActiveIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const fillFromSentence = () => {
    const text = purchaseText.trim();
    if (!text) return;
    const amounts = [...text.matchAll(/(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)\s*(k|thousand|l|lakh)?/gi)].map((match) => {
      let value = Number(match[1].replace(/,/g, ""));
      const suffix = match[2]?.toLowerCase();
      if (suffix === "k" || suffix === "thousand") value *= 1000;
      if (suffix === "l" || suffix === "lakh") value *= 100000;
      return value;
    });
    if (amounts.length) setAmount(String(Math.round(Math.max(...amounts))));
    const lower = text.toLowerCase();
    const foundMerchant = merchantNames.find((name) => lower.includes(name.toLowerCase()));
    const inferredType: PurchaseType = /flight|airline|ticket/.test(lower) ? "flight" : /hotel|stay|room/.test(lower) ? "hotel" : /food|dining|restaurant|swiggy|zomato/.test(lower) ? "dining" : /utility|electricity|water bill|gas bill/.test(lower) ? "utility" : /insurance/.test(lower) ? "insurance" : /fuel|petrol|diesel/.test(lower) ? "fuel" : /rent/.test(lower) ? "rent" : /school|college|education|tuition/.test(lower) ? "education" : /jewel|gold|silver/.test(lower) ? "jewellery" : /railway|train/.test(lower) ? "railway" : /tax|government/.test(lower) ? "government" : /gift card|voucher|digital product/.test(lower) ? "gift-card" : /shop|buy|amazon|flipkart|myntra/.test(lower) ? "shopping" : "general";
    setType(inferredType);
    setMode(/offline|in[ -]?store|at the store|shop counter/.test(lower) ? "store" : "online");
    setMerchant(foundMerchant ?? "");
    setParsed(true);
  };

  if (!ready) return null;
  if (screen === "landing") return <Landing onStart={() => goTo("wallet")} />;

  return (
    <main className="app-shell">
      <header>
        <Logo onClick={() => goTo(activeIds.length ? "ask" : savedIds.length ? "wallet" : "landing")} />
        <div className="header-actions"><button className="text-button" onClick={() => goTo(screen === "wallet" ? (activeIds.length ? "ask" : "landing") : "wallet")}>{screen === "wallet" ? "Back to home" : `My Wallet · ${savedIds.length}`}</button>{isSignedIn && <UserButton />}</div>
      </header>

      {screen === "wallet" && (
        <section className="content wallet-page">
          <div className="step">YOUR WALLET</div>
          <h2>{savedIds.length ? "Manage your cards" : "What’s in your wallet?"}</h2>
          <p className="lede">Add card names only. We never ask for card numbers, expiry or CVV.</p>

          {walletCards.length > 0 && <div className="saved-wallet">
            <h3>In your wallet</h3>
            {walletCards.map((card) => <div className="wallet-row" key={card.id}>
              <span className={`mini-card ${card.tone}`}>{card.short.slice(0, 2)}</span>
              <div><strong>{card.name}</strong><small>{activeIds.includes(card.id) ? "Active in recommendations" : "Paused"}</small></div>
              <button className="secondary small" onClick={() => toggleActive(card.id)}>{activeIds.includes(card.id) ? "Pause" : "Activate"}</button>
              <button className="remove" aria-label={`Remove ${card.name}`} onClick={() => removeCard(card.id)}>×</button>
            </div>)}
          </div>}

          <div className="catalogue-head"><h3>Add a card</h3><span>{cards.length} cards supported</span></div>
          <div className="issuer-tabs">{["All", ...issuers].map((name) => <button key={name} className={issuer === name ? "active" : ""} onClick={() => setIssuer(name)}>{name}</button>)}</div>
          <input className="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search card name or bank" />
          <div className="catalogue-list">{catalogue.map((card) => {
            const added = savedIds.includes(card.id);
            return <div className="catalogue-row" key={card.id}><span className={`mini-card ${card.tone}`}>{card.short.slice(0, 2)}</span><div><small>{card.issuer}</small><strong>{card.name}</strong></div><button className="secondary" disabled={added} onClick={() => addCard(card.id)}>{added ? "Added" : "+ Add"}</button></div>;
          })}</div>
          {catalogue.length === 0 && <p className="empty-search">Nothing matched</p>}
          <button className="request-link" onClick={() => setRequestOpen(true)}>Can’t find your card? Request it →</button>
          {requestOpen && <CardRequest onClose={() => setRequestOpen(false)} />}
          <div className="sticky-action"><button className="primary" disabled={!activeIds.length} onClick={() => goTo("ask")}>Continue with {activeIds.length} active card{activeIds.length === 1 ? "" : "s"} <span>→</span></button></div>
        </section>
      )}

      {screen === "ask" && (
        <section className="content narrow ask-page">
          <div className="eyebrow">A REAL PURCHASE. A CLEAR ANSWER.</div>
          <h2>What are you paying for?</h2>
          <div className="smart-entry"><label htmlFor="purchase-sentence">Describe it in one line</label><div className="smart-entry-row"><input id="purchase-sentence" autoFocus value={purchaseText} onChange={(event) => { setPurchaseText(event.target.value); setParsed(false); }} onKeyDown={(event) => { if (event.key === "Enter") fillFromSentence(); }} placeholder="e.g. ₹18,000 Air India flight online" /><button className="secondary" disabled={!purchaseText.trim()} onClick={fillFromSentence}>Fill details</button></div>{parsed && <small>Details filled below. Check them before continuing.</small>}</div>
          <div className="or-divider">OR ENTER DETAILS</div>
          <label>Merchant or website<input value={merchant} onChange={(event) => setMerchant(event.target.value)} onBlur={() => { const known = resolveMerchant(merchant); if (known) setType(known.defaultType); }} placeholder="e.g. Amazon, Air India, Marriott" /></label>
          <label>Amount<div className="amount-field"><span>₹</span><input inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^0-9]/g, ""))} placeholder="4,000" /></div></label>
          <fieldset><legend>Purchase type</legend><div className="types">{(["shopping", "flight", "hotel", "dining", "general"] as PurchaseType[]).map((item) => <button key={item} className={type === item ? "active" : ""} onClick={() => setType(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}</div></fieldset>
          <label>More specific category<select value={["shopping", "flight", "hotel", "dining", "general"].includes(type) ? "" : type} onChange={(event) => event.target.value && setType(event.target.value as PurchaseType)}><option value="">Not one of these</option><option value="utility">Utility</option><option value="insurance">Insurance</option><option value="fuel">Fuel</option><option value="rent">Rent</option><option value="education">Education</option><option value="jewellery">Jewellery or precious metals</option><option value="railway">Railway</option><option value="government">Tax or government</option><option value="gaming">Gaming</option><option value="toll">Toll</option><option value="gift-card">Gift card or digital product</option><option value="emi">EMI purchase</option></select><small>Choose this when it applies. Several cards exclude these categories.</small></label>
          <fieldset><legend>How are you paying?</legend><div className="types two">{(["online", "store"] as PaymentMode[]).map((item) => <button key={item} className={mode === item ? "active" : ""} onClick={() => setMode(item)}>{item === "online" ? "Online" : "In store"}</button>)}</div></fieldset>
          {type === "shopping" && merchant.toLowerCase().includes("amazon") && includePortals && <label>Amazon vouchers bought this month<div className="amount-field"><span>₹</span><input inputMode="numeric" value={voucherSpendThisMonth} onChange={(event) => setVoucherSpendThisMonth(event.target.value.replace(/[^0-9]/g, ""))} /></div><small>Used only to calculate the remaining monthly voucher allowance.</small></label>}
          {activeIds.includes("sbi-cashback") && <label>SBI cashback already earned this statement cycle<div className="amount-field"><span>₹</span><input inputMode="numeric" value={sbiCashbackEarned} onChange={(event) => setSbiCashbackEarned(event.target.value.replace(/[^0-9]/g, ""))} /></div><small>Enter online cashback for an online purchase, or offline cashback for an in-store purchase.</small></label>}
          <label className="portal-toggle"><input type="checkbox" checked={includePortals} onChange={(event) => setIncludePortals(event.target.checked)} /><span><strong>Include bank portals</strong><small>We’ll show a better route such as SmartBuy when a reviewed rule exists.</small></span></label>
          {!activeIds.length && <div className="flow-warning">No cards are active. <button onClick={() => goTo("wallet")}>Activate a card</button></div>}
          {recommendationStatus === "error" && <div className="flow-warning" role="alert"><strong>Verified recommendations are unavailable.</strong> We will not guess without the reviewed data. <button onClick={() => void requestRecommendations()}>Try again</button></div>}
          <button className="primary full" disabled={!merchant.trim() || !Number(amount) || !activeIds.length || recommendationStatus === "loading"} onClick={() => void requestRecommendations()}>{recommendationStatus === "loading" ? "Checking verified rules…" : "Find the best way to pay"} <span>→</span></button>
          <p className="fine">Ranked by the highest supported redemption value. The redemption route, fallback, caps and assumptions stay visible.</p>
        </section>
      )}

      {screen === "result" && recommendationStatus === "loading" && <section className="content narrow result"><p className="lede">Checking verified rules…</p></section>}
      {screen === "result" && recommendationStatus === "error" && <section className="content narrow result"><div className="flow-warning" role="alert"><strong>Verified recommendations are unavailable.</strong> We will not guess without the reviewed data. <button onClick={() => void requestRecommendations()}>Try again</button></div><button className="back" onClick={() => goTo("ask")}>← Change purchase</button></section>}
      {screen === "result" && recommendationStatus === "empty" && <section className="content narrow result"><div className="flow-warning" role="alert"><strong>No verified recommendation is available for these cards yet.</strong> Try another card or purchase.</div><button className="back" onClick={() => goTo("ask")}>← Change purchase</button></section>}
      {screen === "result" && recommendationStatus === "idle" && results.length > 0 && (
        <section className="content narrow result">
          <button className="back" onClick={() => goTo("ask")}>← Change purchase</button>
          <h2 className="winner-label">{results[0].conditional ? "BEST AVAILABLE ESTIMATE" : "BEST WAY TO PAY"}</h2>
          {!matchedMerchant && <p className="merchant-honesty">Using general card rates for this merchant.</p>}
          <div className="route-callout"><small>{results[0].conditional ? "ESTIMATED" : results[0].kind === "direct" ? "PAY DIRECTLY" : results[0].kind === "voucher" ? "BUY A VOUCHER FIRST" : "USE THE BANK WEBSITE"} · {results[0].effort ?? "No extra steps"}</small><strong>{results[0].title}</strong><span>{results[0].action}</span><div className={`winning-card ${cardFor(results[0]).tone}`}><span>{results[0].issuer}</span><b>{results[0].cardName}</b></div></div>
          {(() => { const direct = results.find((route) => route.kind === "direct" && route.cardKey === results[0].cardKey); const gain = direct && results[0].kind !== "direct" ? results[0].maxValue - direct.maxValue : 0; return gain > 0 && direct ? <div className="winner-comparison"><small>WHY THIS IS BETTER</small><strong>Up to {money(gain)} more supported value</strong><div><span>Pay directly with {direct.cardName}<b>{estimatedValueLabel(direct)}</b></span><span className="better">Follow this recommendation<b>{estimatedValueLabel(results[0])}</b></span></div></div> : null; })()}
          <div className="points-first"><strong>{results[0].pointsLabel}</strong><span>{estimatedValueLabel(results[0])} estimated value</span></div>
          <ResultMath result={results[0]} />
          {results.length > 1 && <div className="alternatives"><div className="alternatives-title">OTHER WAYS TO PAY</div>{results.slice(1, 4).map((route) => <div className="route-option" key={route.id}><div><small>{route.conditional ? "ESTIMATED" : route.kind.toUpperCase()} · {route.effort ?? "No extra steps"}</small><strong>{route.title}</strong><span>{route.cardName} · {route.pointsLabel}</span>{route.conditional && route.caveat && <span className="route-caveat">{route.caveat}</span>}{route.sourceUrl && <a href={route.sourceUrl} target="_blank" rel="noreferrer">Terms · checked {checkedDate(route.checkedAt)} ↗</a>}</div><b>{estimatedValueLabel(route)}</b></div>)}</div>}
          <div className="saved honest">Ranked using the highest supported value of {money(results[0].maxValue)}. Availability and assumptions are shown above.</div>
          <div className="result-disclaimer"><strong>Estimate, not a bank confirmation.</strong><span>Calculated from public information checked on the dates shown. Actual rewards can differ because of the merchant category code, eligibility, caps and posting rules. The bank’s current terms and posted rewards prevail.</span></div>
          {!isSignedIn ? <div className="account-prompt"><div><strong>Save your wallet across devices</strong><span>Optional. Sign in only after seeing the recommendation.</span></div><SignInButton mode="modal"><button className="primary">Continue with Google</button></SignInButton></div> : <div className={`account-prompt compact ${accountStatus === "error" ? "account-error" : ""}`}><div><strong>{accountStatus === "error" ? "Could not save your account yet" : accountStatus === "saved" ? "Wallet saved to your account" : "Saving your wallet…"}</strong><span>{accountStatus === "error" ? "Your local wallet is safe. Try again after the next recommendation." : user?.primaryEmailAddress?.emailAddress}</span></div><UserButton /></div>}
          <div className={`feedback-strip ${feedbackVerdict ? "open" : ""}`}><div className="feedback-question"><span>Was this useful?</span>{feedbackStatus === "sent" ? <strong>Thanks for helping us improve.</strong> : <div className="feedback-options">{(["useful", "unsure", "wrong"] as const).map((verdict) => <button className={feedbackVerdict === verdict ? "selected" : ""} key={verdict} onClick={() => { setFeedbackVerdict(verdict); setFeedbackStatus(""); }}>{verdict === "useful" ? "Yes" : verdict === "unsure" ? "Not sure" : "No"}</button>)}</div>}</div>{feedbackVerdict && feedbackStatus !== "sent" && <div className="feedback-followup"><p>Help us check this answer.</p><div><input maxLength={80} value={feedbackName} onChange={(event) => setFeedbackName(event.target.value)} placeholder="First name" aria-label="Feedback first name" /><input maxLength={500} value={feedbackNote} onChange={(event) => setFeedbackNote(event.target.value)} placeholder="What looked wrong or unclear? (optional)" aria-label="Feedback note" /></div><button className="secondary" disabled={feedbackName.trim().length < 2 || feedbackStatus === "sending"} onClick={async () => { setFeedbackStatus("sending"); try { await submitFeedback({ firstName: feedbackName, merchant, amount: Number(amount), purchaseType: type, paymentMode: mode, winningRouteId: results[0].id, winningRouteTitle: results[0].title, winningCard: results[0].cardName, verdict: feedbackVerdict, note: feedbackNote || undefined }); setFeedbackStatus("sent"); } catch { setFeedbackStatus("error"); } }}>{feedbackStatus === "sending" ? "Sending…" : "Send feedback"}</button>{feedbackStatus === "error" && <small>Could not save that. Please try again.</small>}</div>}</div>
          <button className="primary full" onClick={() => { setMerchant(""); setAmount(""); setResults([]); setRecommendationStatus("idle"); setFeedbackVerdict(null); setFeedbackStatus(""); setFeedbackNote(""); setAccountStatus("idle"); goTo("ask"); }}>Check another purchase</button>
        </section>
      )}
      <Footer />
    </main>
  );
}

function Landing({ onStart }: { onStart: () => void }) {
  return <main className="landing shell">
    <nav><Logo onClick={() => undefined} /><span className="coverage-note">Built for Indian cards</span></nav>
    <section className="hero">
      <div className="hero-copy"><div className="eyebrow">FIND THE BEST WAY TO PAY</div><h1>Pay karne se pehle,<br /><em>poochho.</em></h1><p>Tell us what you want to buy. We check your cards and tell you the best way to pay.</p><button className="primary jumbo" onClick={onStart}>Show me how to pay <span>→</span></button><div className="coverage-line"><strong>{cards.length} cards in catalogue</strong><span>Verified coverage is shown with each answer.</span></div><div className="trust"><span>✓ No card details</span><span>✓ No bank login</span><span>✓ Sources shown</span></div></div>
      <LandingDemo onStart={onStart} />
    </section>
    <Footer />
  </main>;
}

function Footer() { return <footer><span>Independent tool. Not affiliated with any bank.</span><nav><a href="/privacy">Privacy</a><a href="/terms">Terms</a></nav></footer>; }

function cardFor(result: Recommendation): PublicCard {
  return cards.find((card) => card.id === result.cardKey) ?? { id: result.cardKey, issuer: result.issuer, name: result.cardName, short: result.cardName, tone: "navy" };
}

function checkedDate(value?: number) {
  return value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "date unavailable";
}

function ResultMath({ result }: { result: Recommendation }) {
  return <div className="math"><strong>How we calculated it</strong><p>{result.matchedRule}</p>{result.bestValueCalculation && <small>{result.bestValueCalculation}</small>}{result.fallbackValue !== undefined && result.fallbackValueLabel && <small>Fallback: {money(result.fallbackValue)} via {result.fallbackValueLabel}{result.fallbackValueCalculation ? ` — ${result.fallbackValueCalculation}` : ""}</small>}{result.calculation && <small>{result.calculation}</small>}{result.caveat && <small>{result.caveat}</small>}{result.sourceUrl && <a href={result.sourceUrl} target="_blank" rel="noreferrer">Earning terms · checked {checkedDate(result.checkedAt)} ↗</a>}{result.bestValueSourceUrl && <a href={result.bestValueSourceUrl} target="_blank" rel="noreferrer">Redemption value source ↗</a>}</div>;
}

function CardRequest({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const requestCard = useMutation(api.cardRequests.request);
  const submit = async () => {
    setError("");
    try {
      await requestCard({ cardName: name });
      setSent(true);
    } catch {
      setError("Could not save that request. Please try again.");
    }
  };
  return <div className="request-box">{sent ? <><strong>Request noted.</strong><small>We’ll use requests to choose the next cards.</small></> : <><label>Card name<input maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. SBI Aurum" />{error && <small>{error}</small>}</label><button className="primary" disabled={name.trim().length < 3} onClick={submit}>Request card</button></>}<button className="remove" onClick={onClose}>×</button></div>;
}

function Logo({ onClick }: { onClick: () => void }) { return <button className="logo" onClick={onClick}><span>K</span> Kaunsa Card?</button>; }
