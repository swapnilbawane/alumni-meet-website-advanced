# Customization

1. Replace all `YOUR-...` placeholders in `website/index.html`.
2. Set the website backend `/exec` URL in the page's `API_URL` constant.
3. Set the RSVP buttons to your Google Form URL.
4. Adjust `apps-script/rsvp-sync/Code.gs` `SETTINGS.HEADERS` to match your Form response headings.
5. Set `DESTINATION_SPREADSHEET_ID` if the profiles tab is not in the Form response spreadsheet.
6. Keep `NEW_PROFILE_STATUS` as `pending` if organisers should review profiles before publication.
7. Add photos and other assets only when you have permission to publish them.

The README contains the complete setup flow. The public API's `PUBLIC_FIELDS` list controls what the website can display. Never add private fields such as email or phone to that allowlist.
