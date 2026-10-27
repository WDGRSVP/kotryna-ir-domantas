/**
 * Wedding RSVP — Google Apps Script backend (API for the GitHub Pages site)
 * The Google Sheet this script is attached to IS the database.
 * Each guest row gets a private token → personal link (https://<site>/?i=TOKEN).
 * Guests can reopen the same link any time to see and change their reply.
 */

/******************** EDIT THIS ********************/
const CONFIG = {
  // Your GitHub Pages address, e.g. 'https://domantas-ir-ona.github.io' (no trailing slash)
  siteUrl: 'https://YOUR-NAME.github.io',

  coupleNames: 'Domantas & Partner',
  weddingDateText: 'Saturday, 12 June 2027',
  heroLine: 'We are getting married',
  intro: 'We would love for you to celebrate this day with us. Please let us know if you can make it.',
  rsvpDeadline: '1 May 2027',
  contact: 'Questions? Call or text +370 600 00000',
  timeZone: 'Europe/Vilnius',
  askSongRequest: true,

  // Times are local wedding time, format 'YYYY-MM-DD HH:mm'
  events: [
    {
      title: 'Ceremony',
      start: '2027-06-12 15:00',
      end: '2027-06-12 16:00',
      location: 'Church name, Street 1, Vilnius',
      notes: 'Please arrive 20 minutes early.'
    },
    {
      title: 'Reception & dinner',
      start: '2027-06-12 17:30',
      end: '2027-06-13 01:00',
      location: 'Venue name, Street 2, Vilnius district',
      notes: 'Dinner, dancing and celebration.'
    },
    {
      title: 'Day-after brunch',
      start: '2027-06-13 12:00',
      end: '2027-06-13 15:00',
      location: 'Venue name, Street 2, Vilnius district',
      notes: 'Relaxed, casual dress.'
    }
  ]
};
/***************************************************/

const SHEET_NAME = 'Guests';
const HEADERS = [
  'Token', 'Invite name (shown to guest)', 'Max guests', 'Personal link',
  'Status', 'Coming (count)', 'Names of guests coming', 'Dietary needs',
  'Song request', 'Message to couple', 'First replied', 'Last updated', 'Times edited'
];
const COL = {
  token: 1, name: 2, max: 3, link: 4, status: 5, count: 6, attendees: 7,
  dietary: 8, song: 9, message: 10, first: 11, updated: 12, edits: 13
};

/* ---------------- Spreadsheet menu ---------------- */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('💍 Wedding')
    .addItem('1. Set up sheets', 'setupSheets')
    .addItem('2. Generate missing links', 'generateLinks')
    .addToUi();
}

function setupSheets() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME, 0);

  sh.getRange(1, 1, 1, HEADERS.length)
    .setValues([HEADERS])
    .setFontWeight('bold')
    .setBackground('#efe7da')
    .setWrap(true);
  sh.setFrozenRows(1);
  const widths = [120, 220, 90, 320, 100, 110, 260, 200, 180, 280, 140, 140, 100];
  widths.forEach((w, i) => sh.setColumnWidth(i + 1, w));
  sh.getRange('K2:L').setNumberFormat('yyyy-mm-dd hh:mm');

  const statusRange = sh.getRange('E2:E');
  sh.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Attending')
      .setBackground('#d9ead3').setRanges([statusRange]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Declined')
      .setBackground('#f4cccc').setRanges([statusRange]).build()
  ]);

  const sum = ss.getSheetByName('Summary') || ss.insertSheet('Summary');
  sum.clear();
  const g = "'" + SHEET_NAME + "'!";
  sum.getRange('A1:B6').setValues([
    ['Invitations', '=COUNTA(' + g + 'B2:B)'],
    ['Replied', '=COUNTIF(' + g + 'E2:E,"Attending")+COUNTIF(' + g + 'E2:E,"Declined")'],
    ['Waiting for reply', '=B1-B2'],
    ['Invitations attending', '=COUNTIF(' + g + 'E2:E,"Attending")'],
    ['Invitations declined', '=COUNTIF(' + g + 'E2:E,"Declined")'],
    ['Total people coming', '=SUM(' + g + 'F2:F)']
  ]);
  sum.getRange('A1:A6').setFontWeight('bold');
  sum.setColumnWidth(1, 200);

  SpreadsheetApp.getUi().alert(
    'Done. Add one row per invitation on the "Guests" sheet: the name in column B ' +
    '(e.g. "Jonas & Ona") and how many people it covers in column C. ' +
    'Then run "Generate missing links".'
  );
}

function generateLinks() {
  const ui = SpreadsheetApp.getUi();
  const site = String(CONFIG.siteUrl || '').trim().replace(/\/+$/, '');
  if (!site || /YOUR-NAME/.test(site)) {
    ui.alert('Set CONFIG.siteUrl in Code.gs to your GitHub Pages address first.');
    return;
  }
  const sh = getSheet_();
  const last = sh.getLastRow();
  if (last < 2) { ui.alert('Add guest names in column B first.'); return; }

  const rng = sh.getRange(2, 1, last - 1, 4);
  const vals = rng.getValues();
  let made = 0;
  vals.forEach(r => {
    if (!String(r[1]).trim()) return;
    if (!r[0]) { r[0] = newToken_(); made++; }
    if (!r[2]) r[2] = 1;
    r[3] = site + '/?i=' + r[0];
  });
  rng.setValues(vals);
  ui.alert(made + ' new link(s) created. Copy each guest\'s link from column D and send it to them.');
}

/* ---------------- API ---------------- */

/**
 * GET ?action=invite&i=TOKEN  → JSON invitation + saved reply
 * GET ?ics=all | ?ics=<index> → calendar file
 */
function doGet(e) {
  const p = (e && e.parameter) || {};

  if (p.ics !== undefined) {
    return ContentService.createTextOutput(buildIcs_(p.ics))
      .setMimeType(ContentService.MimeType.ICAL)
      .downloadAsFile('wedding.ics');
  }

  if (p.action === 'invite') {
    return json_(safe_(() => getInvite_(p.i)));
  }

  return json_({ ok: false, error: 'Unknown request.' });
}

/** POST body (text/plain JSON): { token, attending, count, names[], dietary, song, message } */
function doPost(e) {
  return json_(safe_(() => {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    return saveRsvp_(body.token, body);
  }));
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function safe_(fn) {
  try { return fn(); }
  catch (err) { return { ok: false, error: String((err && err.message) || err) }; }
}

function getInvite_(token) {
  const config = publicConfig_();
  const row = findRow_(token);
  if (!row) return { ok: false, notFound: true, config: config };
  return { ok: true, config: config, invite: inviteFromRow_(row.values) };
}

function saveRsvp_(token, data) {
  data = data || {};
  if (data.attending !== 'yes' && data.attending !== 'no') {
    throw new Error('Please choose whether you can come.');
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const row = findRow_(token);
    if (!row) throw new Error('This invitation link was not recognised.');
    const v = row.values;
    const max = maxGuests_(v);
    const attending = data.attending === 'yes';

    let count = 0;
    let names = [];
    if (attending) {
      count = Math.min(max, Math.max(1, parseInt(data.count, 10) || 1));
      names = (Array.isArray(data.names) ? data.names : [])
        .slice(0, count)
        .map(n => clean_(n, 80).replace(/;/g, ','));
      while (names.length < count) names.push('');
      if (names.some(n => !n)) throw new Error('Please fill in the name of everyone coming.');
    }

    const now = new Date();
    const hadReply = !!v[COL.status - 1];
    const out = [
      attending ? 'Attending' : 'Declined',
      count,
      names.join('; '),
      attending ? clean_(data.dietary, 500) : '',
      attending ? clean_(data.song, 200) : '',
      clean_(data.message, 2000),
      v[COL.first - 1] || now,
      now,
      (Number(v[COL.edits - 1]) || 0) + (hadReply ? 1 : 0)
    ];
    row.sheet.getRange(row.index, COL.status, 1, out.length).setValues([out]);
    SpreadsheetApp.flush();

    const fresh = row.sheet.getRange(row.index, 1, 1, HEADERS.length).getValues()[0];
    return { ok: true, config: publicConfig_(), invite: inviteFromRow_(fresh) };
  } finally {
    lock.releaseLock();
  }
}

/* ---------------- Helpers ---------------- */

function getSheet_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  if (!sh) throw new Error('The RSVP sheet is not set up yet.');
  return sh;
}

function findRow_(token) {
  token = String(token || '');
  if (!/^[a-zA-Z0-9]{8,40}$/.test(token)) return null;
  const sh = getSheet_();
  const last = sh.getLastRow();
  if (last < 2) return null;
  const tokens = sh.getRange(2, COL.token, last - 1, 1).getValues();
  for (let i = 0; i < tokens.length; i++) {
    if (String(tokens[i][0]) === token) {
      const index = i + 2;
      return { sheet: sh, index: index, values: sh.getRange(index, 1, 1, HEADERS.length).getValues()[0] };
    }
  }
  return null;
}

function inviteFromRow_(v) {
  const status = v[COL.status - 1];
  const updated = v[COL.updated - 1];
  return {
    name: String(v[COL.name - 1]),
    maxGuests: maxGuests_(v),
    response: status ? {
      attending: status === 'Attending' ? 'yes' : 'no',
      count: Number(v[COL.count - 1]) || 0,
      names: String(v[COL.attendees - 1] || '').split('; ').filter(Boolean),
      dietary: String(v[COL.dietary - 1] || ''),
      song: String(v[COL.song - 1] || ''),
      message: String(v[COL.message - 1] || ''),
      updated: updated instanceof Date
        ? Utilities.formatDate(updated, CONFIG.timeZone, 'd MMM yyyy, HH:mm') : ''
    } : null
  };
}

function maxGuests_(v) {
  return Math.max(1, Math.min(20, parseInt(v[COL.max - 1], 10) || 1));
}

function clean_(s, max) {
  let t = String(s == null ? '' : s).trim().slice(0, max);
  if (/^[=+\-@]/.test(t)) t = "'" + t; // stop spreadsheet formula injection
  return t;
}

function newToken_() {
  return Utilities.getUuid().replace(/-/g, '').slice(0, 16);
}

function parseLocal_(s) {
  return Utilities.parseDate(s, CONFIG.timeZone, 'yyyy-MM-dd HH:mm');
}

function utcStamp_(d) {
  return Utilities.formatDate(d, 'UTC', "yyyyMMdd'T'HHmmss'Z'");
}

function publicConfig_() {
  const tz = CONFIG.timeZone;
  return {
    coupleNames: CONFIG.coupleNames,
    weddingDateText: CONFIG.weddingDateText,
    heroLine: CONFIG.heroLine,
    intro: CONFIG.intro,
    rsvpDeadline: CONFIG.rsvpDeadline,
    contact: CONFIG.contact,
    askSongRequest: CONFIG.askSongRequest,
    events: CONFIG.events.map(e => {
      const s = parseLocal_(e.start);
      const en = parseLocal_(e.end);
      const sameDay = Utilities.formatDate(s, tz, 'yyyyMMdd') === Utilities.formatDate(en, tz, 'yyyyMMdd');
      return {
        title: e.title,
        location: e.location,
        notes: e.notes || '',
        day: Utilities.formatDate(s, tz, 'EEEE, d MMMM'),
        time: Utilities.formatDate(s, tz, 'HH:mm') + ' – ' +
          Utilities.formatDate(en, tz, sameDay ? 'HH:mm' : 'HH:mm (d MMM)'),
        googleUrl: 'https://calendar.google.com/calendar/render?action=TEMPLATE' +
          '&text=' + encodeURIComponent(CONFIG.coupleNames + ' — ' + e.title) +
          '&dates=' + utcStamp_(s) + '/' + utcStamp_(en) +
          '&details=' + encodeURIComponent(e.notes || '') +
          '&location=' + encodeURIComponent(e.location || '')
      };
    })
  };
}

function icsEscape_(s) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;')
    .replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

function icsFold_(line) {
  const out = [];
  while (line.length > 74) { out.push(line.slice(0, 74)); line = ' ' + line.slice(74); }
  out.push(line);
  return out.join('\r\n');
}

function buildIcs_(which) {
  const all = CONFIG.events.map((e, i) => ({ e: e, i: i }));
  const list = which === 'all' ? all : all.filter(x => String(x.i) === String(which));
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Wedding RSVP//EN',
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:' + icsEscape_(CONFIG.coupleNames + ' wedding')
  ];
  const stamp = utcStamp_(new Date());
  list.forEach(x => {
    const s = parseLocal_(x.e.start);
    lines.push(
      'BEGIN:VEVENT',
      'UID:wedding-' + x.i + '-' + utcStamp_(s) + '@rsvp',
      'DTSTAMP:' + stamp,
      'DTSTART:' + utcStamp_(s),
      'DTEND:' + utcStamp_(parseLocal_(x.e.end)),
      'SUMMARY:' + icsEscape_(CONFIG.coupleNames + ' — ' + x.e.title),
      'LOCATION:' + icsEscape_(x.e.location),
      'DESCRIPTION:' + icsEscape_(x.e.notes),
      'END:VEVENT'
    );
  });
  lines.push('END:VCALENDAR');
  return lines.map(icsFold_).join('\r\n');
}
