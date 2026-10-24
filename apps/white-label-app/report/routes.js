// The client report: one page, two doors.
//   /w/:profileId/report   the agency's tab inside the workspace (period, Show spend, Copy client link, PDF)
//   /c/:profileId/report   the client's link: the agency brand only, none of the agency navigation
// Each door paints at once and fills its four sections from /report/part/:section fragments.
// Spend (spend, CPC, cost per result, CPM, ROAS) is hidden unless switched on; on the client link it shows
// only when the agency's link carries a valid signature, so editing the URL cannot reveal it.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { period, loadOrganic, loadPaid, loadCommunity, loadSentiment } from './data.js';
import {
  reportHeader, reportSections, printFrame, REPORT_SCRIPT, organicPart, paidPart, communityPart, sentimentPart,
  partError, rangeLabel,
} from './views.js';

const PARTS = new Set(['organic', 'paid', 'community', 'sentiment']);

const sign = (profileId) =>
  createHmac('sha256', process.env.REPORT_LINK_SECRET || process.env.WEBHOOK_SECRET || 'report-link')
    .update(`report-spend:${profileId}`).digest('base64url').slice(0, 22);
const validSig = (profileId, s) => {
  const want = Buffer.from(sign(profileId));
  const got = Buffer.from(String(s || ''));
  return got.length === want.length && timingSafeEqual(got, want);
};

const daysOf = (q) => (String(q.days) === '90' ? 90 : 30);

export default function reportRoutes(app, { clients, findClient, workspaceShell, clientPage, v }) {
  const { esc, icon, empty } = v;

  // The query a page hands to its fragments and its own links.
  const query = ({ days, spend, profileId, door }) => {
    const q = new URLSearchParams({ days: String(days) });
    if (spend) {
      q.set('spend', '1');
      if (door === 'c') q.set('s', sign(profileId));
    }
    return q.toString();
  };
  const linkBase = (req) => (process.env.BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');

  const periodSwitch = (href, days) => `<div class="seg" role="group" aria-label="Report period">
      ${[30, 90].map((d) => `<a class="seg-opt" href="${esc(href(d))}"${d === days ? ' aria-current="true"' : ''}>Last ${d} days</a>`).join('')}
    </div>`;

  const run = (part, client, p, spend) => {
    if (part === 'organic') return loadOrganic(client, p).then((o) => organicPart(o, p));
    if (part === 'paid')
      return Promise.all([loadPaid(client, p), loadOrganic(client, p).catch(() => null)]).then(([pd, o]) => paidPart(pd, o, p, { spend }));
    if (part === 'community') return loadCommunity(client, p).then((c) => communityPart(c, p));
    return loadSentiment(client, p).then(sentimentPart);
  };

  /* ---------------------------------------------------------------- agency tab */
  app.get('/w/:profileId/report', (req, res) => {
    const client = findClient(req, res);
    if (!client) return;
    const days = daysOf(req.query);
    const spend = req.query.spend === '1';
    const p = period(days);
    const id = encodeURIComponent(client.profileId);
    const here = (d, s = spend) => `/w/${id}/report?${query({ days: d, spend: s })}`;
    const clientLink = `${linkBase(req)}/c/${id}/report?${query({ days, spend, profileId: client.profileId, door: 'c' })}`;

    const controls = `<div class="rcontrols no-print">
        ${periodSwitch((d) => here(d), days)}
        <form method="get" action="/w/${esc(id)}/report" class="rswitch-form">
          <input type="hidden" name="days" value="${days}">
          <label class="rswitch">
            <input type="checkbox" name="spend" value="1"${spend ? ' checked' : ''} onchange="this.form.submit()">
            <span class="rswitch-track" aria-hidden="true"><span class="rswitch-knob"></span></span>
            <span class="rswitch-text">Show spend</span>
          </label>
          <noscript><button class="btn btn-ghost btn-sm" type="submit">Apply</button></noscript>
        </form>
        <span class="rcontrols-note">${spend ? 'Spend, cost per click and cost per result are visible on this page, the client link and the PDF.' : 'Spend is hidden here, on the client link and in the PDF.'}</span>
      </div>`;

    const parts = (sec) => `/w/${id}/report/part/${sec}?${query({ days, spend })}`;
    res.send(workspaceShell({
      client,
      tab: 'report',
      subtitle: `Client report · ${esc(rangeLabel(p.from, p.to))}`,
      actions: `<button type="button" class="btn btn-secondary js-copy" data-url="${esc(clientLink)}" aria-label="Copy client link for ${esc(client.name)}">${icon('link', 16)} Copy client link</button>
        <button type="button" class="btn btn-primary js-print">${icon('download', 16)} Download PDF</button>`,
      body: `<div class="report">${printFrame({ client, p, inner: `${reportHeader({ client, p })}${controls}${reportSections(parts)}` })}</div>${REPORT_SCRIPT}`,
    }));
  });

  /* ---------------------------------------------------------------- client link */
  const clientFor = (req) => clients().find((c) => c.profileId === req.params.profileId);
  const notValid = (res) => res.status(404).send(clientPage({
    title: 'Link not valid',
    lede: 'This report link does not point at an active report.',
    body: `<div class="card"><div class="card-body">${empty('We can’t open this report', 'The link may have expired or been typed incorrectly. Ask whoever sent it for a fresh one.')}</div></div>`,
  }));

  app.get('/c/:profileId/report', (req, res) => {
    const client = clientFor(req);
    if (!client) return notValid(res);
    const days = daysOf(req.query);
    const spend = req.query.spend === '1' && validSig(client.profileId, req.query.s);
    const p = period(days);
    const id = encodeURIComponent(client.profileId);
    const here = (d) => `/c/${id}/report?${query({ days: d, spend, profileId: client.profileId, door: 'c' })}`;
    const parts = (sec) => `/c/${id}/report/part/${sec}?${query({ days, spend, profileId: client.profileId, door: 'c' })}`;
    const controls = `<div class="rcontrols no-print">${periodSwitch(here, days)}</div>`;
    res.send(clientPage({
      title: `${client.name} · report`,
      wide: true,
      lede: '',
      bare: true,
      actions: `<button type="button" class="btn btn-primary js-print">${icon('download', 16)} Download PDF</button>`,
      body: `<div class="report">${printFrame({ client, p, inner: `${reportHeader({ client, p })}${controls}${reportSections(parts)}` })}</div>${REPORT_SCRIPT}`,
      foot: `Prepared by ${esc(v.BRAND.name)}`,
    }));
  });

  /* ---------------------------------------------------------------- fragments */
  const fragment = (door) => async (req, res) => {
    const client = clientFor(req);
    res.type('html');
    if (!client || !PARTS.has(req.params.part)) return res.status(404).send(partError('This section does not exist.'));
    const days = daysOf(req.query);
    const spend = req.query.spend === '1' && (door === 'w' || validSig(client.profileId, req.query.s));
    try {
      res.send(await run(req.params.part, client, period(days), spend));
    } catch (e) {
      console.error(`report ${req.params.part}:`, e.status || '', e.message);
      // The agency sees the status; the client sees a plain sentence and never an upstream message.
      const keyProblem = /API key (could not be read|file is empty)/.test(e.message);
      res.status(502).send(partError(door === 'w'
        ? keyProblem
          ? `${e.message} Check the keyFile entry for this workspace.`
          : `The data source answered ${e.status || 'with an error'}${e.status === 401 || e.status === 403 ? ' (check this workspace’s key)' : ''}.`
        : 'Please try again in a minute.'));
    }
  };
  app.get('/w/:profileId/report/part/:part', fragment('w'));
  app.get('/c/:profileId/report/part/:part', fragment('c'));
}
