<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep install icons as dedicated PNG sizes in `public/`, referenced by the manifest and the iOS touch icon head link, so platforms receive correctly sized brand artwork instead of a scaled favicon.
- Gate authenticated content on a separate membership query before rendering Outlet; keep pending members on an informational screen to prevent panel flashes and forced logout races.
- Administrator identity edits use an authenticated server function that validates roles before syncing auth identity and profile fields, so client edits cannot bypass authorization.
- Use the root ThemeProvider and semantic light/dark CSS tokens for all theme controls; persist only the appearance preference locally.
