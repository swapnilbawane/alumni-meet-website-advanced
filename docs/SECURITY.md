# Security notes

- Keep the Form response spreadsheet and destination Sheet private.
- The RSVP sync script is an installable trusted automation with write access. Never deploy it as a public web app.
- The website backend is a separate read-only Apps Script Web App.
- The public API returns only approved rows and explicitly allowlisted public fields.
- Email is stored privately for matching and excluded from the public API allowlist.
- Treat every API field as public and copyable.
- Do not commit real RSVP exports, credentials, tokens or private attendee details.
- Review OAuth scopes and authorisation prompts before approving Apps Script access.
- New RSVP profiles default to `pending`. Organisers approve them before public display.
- The starter does not provide identity verification, consent management or a private attendee portal.
