// Naptár-források: a Google Calendar és a Microsoft Graph válaszainak átalakítása az értelmező bemenetére (eventInput),
// lapozással. A hálózati hívás (fetchFn) és a hozzáférési jel (getToken) kívülről jön, így mintaválaszokkal tesztelhető.
// Csak olvasás: a naptárba soha nem írunk.
import { eventInput } from "./calendarParser.js";

const localMidnight = (ymd) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ymd ?? "")); return m ? new Date(+m[1], +m[2] - 1, +m[3], 0, 0, 0, 0).getTime() : NaN; };

/** HTML-es leírás egyszerű szöveggé (az Utazás célja a Leírás első sorából jöhet). */
export function htmlToText(s) {
  return String(s ?? "").replace(/<\s*br\s*\/?>/gi, "\n").replace(/<\/(p|div|li)>/gi, "\n").replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

// ---------- Google ----------

/** Egy Google Calendar esemény -> eventInput (vagy null, ha nem kell: például munkahely-jelölő). */
export function googleEventToInput(ev) {
  if (!ev || !ev.id) return null;
  if (ev.eventType === "workingLocation" || ev.eventType === "birthday") return null;
  const cancelled = ev.status === "cancelled";
  const allDay = !!(ev.start && ev.start.date && !ev.start.dateTime);
  const stamp = (t) => (t && t.dateTime ? Date.parse(t.dateTime) : t && t.date ? localMidnight(t.date) : NaN);
  let id = ev.id;
  if (ev.recurringEventId) {   // ismétlődő vagy kivételes példány: az azonosító után a példány eredeti kezdete (UNIX másodperc)
    const orig = stamp(ev.originalStartTime);
    id = Number.isFinite(orig) ? `${ev.recurringEventId}|${Math.round(orig / 1000)}` : ev.id;
  }
  const me = (ev.attendees || []).find((a) => a.self);
  return eventInput({
    id, title: ev.summary || "", location: ev.location || "", notes: htmlToText(ev.description),
    start: stamp(ev.start), end: stamp(ev.end), isAllDay: allDay,
    isDeclined: !!(me && me.responseStatus === "declined"), isCancelled: cancelled,
  });
}

const GOOGLE_FIELDS = "nextPageToken,items(id,status,summary,location,description,start,end,recurringEventId,originalStartTime,attendees(self,responseStatus),eventType)";
const GOOGLE_ID_FIELDS = "nextPageToken,items(id,status,start,end,recurringEventId,originalStartTime,eventType)";

export function createGoogleProvider({ fetchFn = (...a) => globalThis.fetch(...a), getToken }) {
  const base = "https://www.googleapis.com/calendar/v3";
  const get = async (url) => {
    const res = await fetchFn(url, { headers: { Authorization: `Bearer ${await getToken()}` } });
    if (!res.ok) { const e = new Error(`A Google Naptár hibát jelzett (${res.status}).`); e.status = res.status; throw e; }
    return res.json();
  };
  return {
    id: "google", title: "Google Naptár",
    async calendars() {
      const out = []; let page = "";
      for (let n = 0; n < 20; n++) {
        const j = await get(`${base}/users/me/calendarList?minAccessRole=reader&maxResults=250${page}`);
        for (const c of j.items || []) out.push({ id: "google:" + c.id, title: c.summary || c.id, primary: !!c.primary });
        if (!j.nextPageToken) break;
        page = "&pageToken=" + encodeURIComponent(j.nextPageToken);
      }
      return out;
    },
    /** ids: a kért naptárak (a provider-előtag nélküli azonosítók); null = az összes. light: csak az azonosításhoz kellő mezők. */
    async events(calendarIds, from, to, { light = false } = {}) {
      const ids = calendarIds || (await this.calendars()).map((c) => c.id.slice(7));
      const out = new Map();
      for (const cid of ids) {
        let page = "";
        for (let n = 0; n < 40; n++) {
          const url = `${base}/calendars/${encodeURIComponent(cid)}/events?timeMin=${encodeURIComponent(new Date(from).toISOString())}&timeMax=${encodeURIComponent(new Date(to).toISOString())}`
            + `&singleEvents=true&showDeleted=true&maxResults=2500&fields=${encodeURIComponent(light ? GOOGLE_ID_FIELDS : GOOGLE_FIELDS)}${page}`;
          const j = await get(url);
          for (const ev of j.items || []) { const e = googleEventToInput(ev); if (e && !out.has(e.id)) out.set(e.id, e); }
          if (!j.nextPageToken) break;
          page = "&pageToken=" + encodeURIComponent(j.nextPageToken);
        }
      }
      return [...out.values()];
    },
  };
}

// ---------- Microsoft (Outlook, Microsoft 365) ----------

const utcMs = (dt) => {
  if (!dt) return NaN;
  let s = String(dt).replace(/(\.\d{3})\d+/, "$1");
  if (!/[Zz]|[+-]\d\d:\d\d$/.test(s)) s += "Z";
  return Date.parse(s);
};

/** Egy Microsoft Graph esemény -> eventInput. A kérésben `Prefer: outlook.timezone="UTC"` szerepel. */
export function msEventToInput(ev) {
  if (!ev || !ev.id) return null;
  const allDay = !!ev.isAllDay;
  let id = ev.id;
  if ((ev.type === "occurrence" || ev.type === "exception") && ev.seriesMasterId) {
    const orig = ev.originalStart ? Date.parse(ev.originalStart) : utcMs(ev.start && ev.start.dateTime);
    id = Number.isFinite(orig) ? `${ev.seriesMasterId}|${Math.round(orig / 1000)}` : ev.id;
  }
  return eventInput({
    id, title: ev.subject || "", location: (ev.location && ev.location.displayName) || "", notes: ev.bodyPreview || "",
    start: allDay ? localMidnight(ev.start && ev.start.dateTime) : utcMs(ev.start && ev.start.dateTime),
    end: allDay ? localMidnight(ev.end && ev.end.dateTime) : utcMs(ev.end && ev.end.dateTime),
    isAllDay: allDay, isDeclined: !!(ev.responseStatus && ev.responseStatus.response === "declined"), isCancelled: !!ev.isCancelled,
  });
}

export function createMicrosoftProvider({ fetchFn = (...a) => globalThis.fetch(...a), getToken }) {
  const base = "https://graph.microsoft.com/v1.0";
  const get = async (url) => {
    const res = await fetchFn(url, { headers: { Authorization: `Bearer ${await getToken()}`, Prefer: 'outlook.timezone="UTC"' } });
    if (!res.ok) { const e = new Error(`A Microsoft Graph hibát jelzett (${res.status}).`); e.status = res.status; throw e; }
    return res.json();
  };
  return {
    id: "ms", title: "Outlook naptár",
    async calendars() {
      const out = []; let url = `${base}/me/calendars?$top=100`;
      for (let n = 0; n < 20 && url; n++) {
        const j = await get(url);
        for (const c of j.value || []) out.push({ id: "ms:" + c.id, title: c.name || c.id, primary: !!c.isDefaultCalendar });
        url = j["@odata.nextLink"] || "";
      }
      return out;
    },
    async events(calendarIds, from, to, { light = false } = {}) {
      const ids = calendarIds || (await this.calendars()).map((c) => c.id.slice(3));
      const out = new Map();
      const select = light ? "id,start,end,isAllDay,isCancelled,type,seriesMasterId,originalStart" : "id,subject,bodyPreview,location,start,end,isAllDay,isCancelled,responseStatus,type,seriesMasterId,originalStart";
      for (const cid of ids) {
        let url = `${base}/me/calendars/${encodeURIComponent(cid)}/calendarView?startDateTime=${encodeURIComponent(new Date(from).toISOString())}&endDateTime=${encodeURIComponent(new Date(to).toISOString())}&$top=250&$select=${select}`;
        for (let n = 0; n < 40 && url; n++) {
          const j = await get(url);
          for (const ev of j.value || []) { const e = msEventToInput(ev); if (e && !out.has(e.id)) out.set(e.id, e); }
          url = j["@odata.nextLink"] || "";
        }
      }
      return [...out.values()];
    },
  };
}

// ---------- Összevont forrás (a szinkronizáló ezt kapja) ----------

/** providers: a bejelentkezett szolgáltatók. A naptárazonosítók `google:…` / `ms:…` előtagúak. */
export function combineSources(providers) {
  const split = (ids) => {
    const by = new Map(providers.map((p) => [p.id, []]));
    if (!ids) return new Map(providers.map((p) => [p.id, null]));
    for (const full of ids) { const i = full.indexOf(":"), pid = full.slice(0, i); if (by.has(pid)) by.get(pid).push(full.slice(i + 1)); }
    return by;
  };
  return {
    access: () => (providers.length ? "granted" : "denied"),
    async calendars() { return (await Promise.all(providers.map(async (p) => (await p.calendars()).map((c) => ({ ...c, provider: p.id, providerTitle: p.title }))))).flat(); },
    async events(ids, from, to, opts = {}) {
      const by = split(ids), out = new Map();
      for (const p of providers) {
        const list = by.get(p.id);
        if (list && !list.length) continue;
        for (const e of await p.events(list, from, to, opts)) if (!out.has(e.id)) out.set(e.id, e);
      }
      return [...out.values()];
    },
  };
}
