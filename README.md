# Alumni Meetup Website Starter

An open-source starter for running an alumni meetup website with **automatic RSVP-to-profile synchronisation**. It uses Google Forms, Google Sheets, Google Apps Script, static HTML and Netlify.

The organiser configures the workflow once. New RSVP submissions are then processed automatically. No copying rows between sheets.

## What it does

- Publishes event information, updates, approved alumni profiles, guests and student contributors.
- Automatically processes new Google Form responses using an installable form-submit trigger.
- Can sync only confirmed YES responses.
- Matches returning alumni by email and updates their existing profile rather than duplicating it.
- Keeps email in the private Sheet for matching. Email is not exposed by the public website API.
- Creates new profiles as `pending` by default. Organisers approve them before public display.
- Hosts the static website on Netlify.

## Architecture

```text
Google Form submission
        |
        v
Form response spreadsheet
        |
        | installable form-submit trigger
        v
Private RSVP sync Apps Script
        |
        | optional YES-only filter
        | match/update by email
        v
Private profiles Sheet
        |
        | approved rows only
        v
Read-only website Apps Script API
        |
        v
Static website on Netlify
```

The RSVP sync script and public website API are separate Apps Script projects. The RSVP script is trusted automation with write access. The public API is read-only and returns only approved, allowlisted fields.

## Repository layout

```text
website/
  index.html
  netlify.toml
  images/README.md
apps-script/
  rsvp-sync/
    Code.gs
    appsscript.json
  website-backend/
    Code.gs
    appsscript.json
docs/
  CUSTOMIZATION.md
  SECURITY.md
README.md
LICENSE
ASSET-LICENSE.md
.gitignore
```

## Setup overview

1. Create or identify the Google Form and its response spreadsheet.
2. Create a destination Google Sheet with `profiles`, `updates`, `guests`, and `students` tabs. This can be the same spreadsheet as the Form responses.
3. Install the automatic RSVP sync script in the Form response spreadsheet.
4. Deploy the read-only website backend bound to the destination Sheet.
5. Add the backend `/exec` URL to the website and customise event details.
6. Deploy the `website` folder to Netlify.

## 1. Prepare the Google Sheets

Create a destination Google Sheet with these tabs and headers in row 1.

**profiles**

`timestamp | status | email | name | year | branch | role | want | experience | guide | linkedin | photo`

The `email` column is private and used only for matching returning alumni. It is deliberately excluded from the public API. New RSVP profiles are marked `pending`.

**updates**

`timestamp | status | title | body`

**guests**

`timestamp | status | name | note | sortOrder | photo`

**students**

`timestamp | status | name | role | linkedin | sortOrder | photo`

Do not put phone numbers, private notes or sensitive information in public fields.

## 2. Configure automatic RSVP synchronisation

### 2.1 Open the Form response spreadsheet

Open the spreadsheet receiving Google Form responses. Choose **Extensions → Apps Script**.

Copy `apps-script/rsvp-sync/Code.gs` into the editor. In Project Settings, enable **Show appsscript.json manifest file in editor**, then copy `apps-script/rsvp-sync/appsscript.json` into the manifest.

### 2.2 Configure SETTINGS

At the top of `Code.gs`, edit:

- `DESTINATION_SPREADSHEET_ID`: leave blank if the `profiles` tab is in the Form response spreadsheet. Otherwise paste the destination spreadsheet ID.
- `DESTINATION_SHEET_NAME`: normally `profiles`.
- `REQUIRE_YES_ATTENDANCE`: `true` to sync only YES responses, `false` to process all submissions.
- `ATTENDANCE_HEADER`: attendance question heading in your Form response sheet.
- `YES_VALUES`: accepted YES answer text.
- `NEW_PROFILE_STATUS`: defaults to `pending`. Keep this if organisers should approve profiles before publication.
- `HEADERS`: change the labels to match the exact column headings in your Form response sheet.

A name and email column are required for reliable matching. Other mapped profile fields are optional. The script combines designation and company into the `role` field.

### 2.3 Install the trigger once

Select `installFormSubmitTrigger` in Apps Script and click **Run**. Complete the Google authorisation prompt.

This creates an installable spreadsheet form-submit trigger. From then on, each new form response is processed automatically. Do not run `handleFormSubmit` manually.

### 2.4 Import existing responses (optional)

If the Form already has responses, run `importExistingResponses` once. It uses the same email matching, so it updates matching profiles instead of creating duplicate rows. It is safe to rerun.

### What happens for each submission

1. The script reads the submitted row.
2. If YES-only mode is enabled, it checks the attendance answer and skips non-YES responses.
3. It maps the configured fields to the `profiles` tab.
4. It searches for an existing profile with the same email.
5. It updates the matching row or appends a new row.
6. New profiles receive `pending` status. An organiser can review the row and set it to `approved`.

The script does not create Google Contacts and does not request People API access.

**Important:** The trigger processes new submissions. If respondents are allowed to edit old responses later, those edits do not necessarily fire a new submit trigger. Disable response editing or add a scheduled reconciliation workflow if edits must sync too.

## 3. Deploy the public website API

The website backend is a separate Apps Script project bound to the destination Google Sheet.

1. Open the destination Sheet and choose **Extensions → Apps Script**.
2. Copy `apps-script/website-backend/Code.gs` into the editor.
3. Enable the manifest file and copy `apps-script/website-backend/appsscript.json`.
4. Save and choose **Deploy → New deployment → Web app**.
5. Execute as **Me** and set access to **Anyone** if the site is public.
6. Authorise and copy the deployed `/exec` URL.

Open `YOUR_WEB_APP_EXEC_URL?action=all`. It should return JSON containing `profiles`, `updates`, `guests` and `students`.

The API returns only rows with `status = approved` and only fields listed in `PUBLIC_FIELDS`. Email is intentionally excluded.

## 4. Connect and customise the website

Open `website/index.html` and search for `PASTE_YOUR_APPS_SCRIPT_EXEC_URL_HERE`. Replace it with your deployed `/exec` URL. Update organisation name, event date, venue, RSVP link, contact details and other `YOUR-` placeholders.

The RSVP button links to your Google Form. The automatic sync trigger processes submissions in the background.

## 5. Deploy to Netlify

1. Push the repository to GitHub.
2. In Netlify, choose **Add new site → Import an existing project**.
3. Select the repository. Set publish directory to `website`. Leave build command blank.
4. Deploy.

## 6. Day-to-day operation

- **RSVPs:** arrive through the Form and sync automatically.
- **Profiles:** review new `pending` rows in `profiles`. Set status to `approved` to publish.
- **Updates:** add rows to `updates`, fill `title` and `body`, and set status to `approved`.
- **Guests:** add rows to `guests`, set status to `approved`, and use `sortOrder` to control display order.
- **Students:** add rows to `students`, set status to `approved`, and use `sortOrder` to control display order.

The website caches data in the visitor's session for five minutes. A hard refresh or new session can fetch updates sooner.

## Security model and limitations

- Keep both Google Sheets private. Share editor access only with trusted organisers.
- The RSVP sync script is trusted automation with write access. It must not be deployed as a public web app.
- The website backend is a separate read-only Apps Script Web App.
- The public API returns only approved rows and explicitly allowlisted fields.
- Email is stored privately for matching and excluded from the public API.
- Treat all fields returned by the public API as public and copyable.
- Do not commit real RSVP exports, attendee lists, credentials or private deployment configuration.
- Review Google authorisation prompts and Apps Script scopes before granting access.
- This is a lightweight starter, not a substitute for a security review or a dedicated backend for high-risk or high-volume use.

## Troubleshooting

- **No profile appears:** check trigger executions, response headers, attendance answer and `REQUIRE_YES_ATTENDANCE`.
- **Missing column error:** update `SETTINGS.HEADERS` to match the Form response headings.
- **Duplicate profiles:** check that email is present and consistent. Matching is case-insensitive.
- **Profile synced but not visible:** set its status to `approved`, then allow for the website's five-minute cache or refresh.
- **Permission error:** confirm the trigger owner can edit the destination Sheet and has authorised the script.

## License

The original source code is released under the MIT License. Logos, photographs, fonts, icons and other third-party assets added by adopters remain subject to their owners' terms. See `ASSET-LICENSE.md`.
