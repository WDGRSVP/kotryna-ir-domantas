# Wedding RSVP site — GitHub Pages + Google Sheet

- **GitHub Pages** hosts the page guests see (`index.html`), at `https://<name>.github.io`.
- **Google Sheet + Apps Script** (`Code.gs`) stores replies. Guests never see it. You and anyone you share the sheet with see replies appear live.

Total time ≈ 20 minutes, all free.

---

## Part A — Pick your address (GitHub)
1. Sign in at github.com.
2. To get a custom name before `.github.io`: **+ → New organization → Free**, name it e.g. `domantas-ir-ona`.
3. In that organization: **New repository**, name it **exactly** `domantas-ir-ona.github.io` (same as the org name + `.github.io`), Public.
   → Your site will be `https://domantas-ir-ona.github.io`.

## Part B — The database (Google Sheet)
1. Go to sheets.new, name it "Wedding RSVP".
2. **Extensions → Apps Script.** Replace everything in `Code.gs` with **Code.gs**.
3. At the top, edit `CONFIG`:
   - `siteUrl` → your address from Part A, e.g. `https://domantas-ir-ona.github.io`
   - names, date, intro, deadline, contact, and the `events` itinerary (Vilnius local time, `2027-06-12 15:00`).
4. Save. Reload the spreadsheet tab → **💍 Wedding → 1. Set up sheets** (approve the authorisation: Advanced → Go to project → Allow).
5. **Deploy → New deployment → ⚙ Web app**, Execute as **Me**, Who has access **Anyone** → Deploy → copy the URL ending in **/exec**.

## Part C — Connect the page and publish
1. Open **index.html** in a text editor. Near the top of the `<script>`, replace
   `https://script.google.com/macros/s/PASTE-YOUR-DEPLOYMENT-ID/exec` with your /exec URL.
2. In your GitHub repo: **Add file → Upload files** → drop in `index.html` → Commit.
3. Repo **Settings → Pages**: Source **Deploy from a branch**, branch **main**, folder **/ (root)** → Save. After a minute or two the site is live.

## Part D — Guests and links
1. In the **Guests** sheet, one row per invitation: name in column B (`Jonas & Ona`), number of people in column C.
2. **💍 Wedding → 2. Generate missing links.** Column D gets each personal link, e.g. `https://domantas-ir-ona.github.io/?i=3f9a…`.
3. Test your own row first (reply, reopen, edit), then send links out. Adding guests later? Add rows and run step 2 again — existing links never change.

## Sharing the replies with others
Share the Google Sheet with the normal **Share** button:
- **Viewer** — sees replies live (parents, planner).
- **Editor** — can also add guests and generate links. Editors can see the script too, so only trusted people.
Anyone with access to the sheet can see all guest links.

## Changing things later
- **Text / itinerary** (in `CONFIG`): edit Code.gs, then **Deploy → Manage deployments → ✏ Edit → Version: New version → Deploy**. The /exec URL stays the same, so nothing on GitHub needs changing.
- **Design / page wording** (in index.html): edit and re-upload the file to GitHub.
- **Guest name or max guests:** just edit the sheet.

## Notes
- The **Summary** sheet counts replies, declines, waiting, and total people coming.
- Links contain a random 16-character code; nobody can guess another guest's link. Someone a guest forwards their link to could edit that invitation.
- "Apple Calendar" downloads an `.ics` file (works with iPhone, Mac, Outlook, Android). Try it on an iPhone during testing.
- The page tells search engines not to index it.
