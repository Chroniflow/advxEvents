# ADVX轶事 Design Specification

Date: 2026-07-24
Status: Approved design draft

## 1. Purpose

ADVX轶事 is a public archive for anecdotes written by AdventureX participants. The product preserves personal moments, short observations, long-form recollections, and optional photographs without making images a publishing requirement.

The public experience should feel like a futuristic youth archive rather than a conventional social feed. It borrows the visual language of AdventureX: black surfaces, white text, restrained orange emphasis, technical English labels, thin borders, compact metadata, and editorial typography.

## 2. Product Scope

The first release includes:

- A public gallery of approved anecdotes.
- User-controlled latest, hottest, and random ordering.
- Story detail pages for short and long text, with optional images.
- GitHub OAuth authentication.
- Authenticated likes, limited to one like per user and story.
- A submission workspace with drafts, preview, optional anonymity, and optional multi-image upload.
- A moderation queue and content lifecycle.
- Role and administrator management.
- An audit trail for moderation and role changes.

The first release does not include comments, follows, private messaging, arbitrary HTML, or public user-generated tags.

## 3. Brand And Visual Direction

The product name is **ADVX轶事**, with `ADVX ANECDOTES` as a supporting English label.

The approved public direction is a modular text wall:

- Pure text, quotations, long-form excerpts, and image-backed stories have equal editorial status.
- Cards may vary in height and width to establish rhythm, but text remains readable and the layout remains scannable.
- Orange is reserved for active state, calls to action, selection, and a small number of editorial anchors.
- Technical labels such as `/ LONG READ`, story numbers, dates, reading time, and author state provide structure.
- Cards use thin borders and small corner radii on near-black surfaces.
- Motion is restrained: fades, small vertical transitions, and responsive border or accent changes.
- The mobile gallery becomes a stable single-column reading flow.

The approved administration direction references the AdventureX United Portal: fixed sidebar navigation, dense dark panels, clear orange state markers, and a work-focused review queue.

The current mockups define information hierarchy and visual language, not final grid dimensions. Card spans, spacing, breakpoints, and exact panel arrangement will be tuned after complete functionality is populated with realistic content.

## 4. Public Experience

### 4.1 Gallery

The homepage opens directly on the story gallery rather than a marketing landing page. It includes:

- Brand and concise archive introduction.
- Published story count.
- Latest, hottest, and random sorting controls.
- Optional content filters for all, text-only, and stories with images.
- A modular wall of story previews.
- GitHub login and submission actions.

Latest ordering uses publication time. Hottest ordering uses authenticated like counts. Random ordering samples only approved, currently published stories.

### 4.2 Story Detail

Each story page shows its archive number, publication date, public author identity or anonymous state, reading time, and like count. The body uses a narrow long-form reading column. Optional images may appear between text sections with captions.

The page provides authenticated like/unlike, sharing, and a return to the gallery. Anonymous publication must not expose GitHub identity in any public response or page metadata.

## 5. Identity And Permissions

GitHub OAuth is the only login method in the first release. A first-time authenticated user receives the `USER` role.

| Principal | Permissions |
| --- | --- |
| `ANONYMOUS` | View the public gallery and published stories. This is an unauthenticated principal, not a stored user role. |
| `USER` | Anonymous permissions plus create and manage own drafts, submit revisions, withdraw pending submissions, and like or unlike stories. |
| `STAFF` | User permissions plus approve, reject, unpublish, and restore content. |
| `ADMIN` | Staff permissions plus manage user roles, administrators, and site-wide settings. |

`ADMIN_GITHUB_USERS` is a comma-separated Worker environment variable containing bootstrap administrators. It initially contains `icebraker`. Bootstrap administrators always resolve to `ADMIN` and cannot be demoted or removed through the application.

Administrators can find existing GitHub-authenticated users and assign `USER`, `STAFF`, or `ADMIN`. Role changes are audited.

## 6. Submission And Moderation

A story requires a title and plain-text body. Images are optional and multiple images are allowed. Authors can order images, remove them, and add captions. A `Publish anonymously` switch controls public attribution while retaining private author identity for moderation.

The submission workspace supports:

- Save draft.
- Preview public rendering.
- Submit for review.
- Withdraw while pending.
- View rejection reason.
- Revise and resubmit.

The lifecycle is:

```text
draft -> pending -> published
                 -> rejected -> draft
pending -> withdrawn -> draft
published -> unpublished -> published
```

Editing a published story creates a new draft revision. The previous approved revision remains public until staff approves the new revision. This prevents unreviewed edits from appearing publicly.

Staff can approve or reject a pending revision, with an optional review note on approval and a required reason on rejection. Staff can unpublish or restore content. Administrators can additionally feature stories, manage roles, and change site settings.

## 7. Administration Experience

The administration application shares the React codebase but uses a dedicated guarded layout. Its sidebar includes:

- Overview.
- Pending review.
- Published content.
- Unpublished content.
- Users and permissions.
- Site settings for administrators only.

The overview prioritizes the pending queue and shows compact counts for pending stories, published stories, users, and likes. Review views show the final public rendering alongside private author identity and revision metadata.

Role management displays bootstrap status explicitly and prevents controls that could demote a bootstrap administrator.

## 8. Technical Architecture

The application uses React with TypeScript and is deployed as a Cloudflare Worker. One Worker serves the built frontend and `/api` routes.

### 8.1 Storage Responsibilities

- **Workers KV:** user profiles, story drafts and revisions, review records, audit records, site settings, and paginated public content indexes.
- **Cloudflare R2:** validated original images. KV stores only image keys and display metadata.
- **SQLite-backed Durable Objects:** like membership, atomic like counts, and the hottest-story ranking.

Durable Objects are used because duplicate prevention and counters require coordinated writes. KV remains the requested source for user information and submission records.

### 8.2 Key Model

Representative KV keys:

```text
users:{githubId}
stories:{storyId}:meta
stories:{storyId}:revision:{revisionId}
reviews:{storyId}:{revisionId}
indexes:published:{cursor}
indexes:pending:{cursor}
audit:{timestamp}:{eventId}
settings:public
```

Representative R2 keys:

```text
stories/{storyId}/{assetId}/original
```

Durable Object storage records a composite `(storyId, githubUserId)` like membership and maintains per-story counts and a bounded hottest ranking.

### 8.3 Read And Write Behavior

Publishing writes the approved revision and public index before acknowledging success. If indexing fails, the story remains pending and the operation can be retried safely.

Image upload completes before the revision references the asset. Failed and abandoned uploads are marked for later cleanup.

If hottest ranking is temporarily unavailable, the public gallery falls back to latest ordering. Story reading remains available.

## 9. Authentication And Security

- GitHub OAuth callbacks validate a single-use `state` value.
- Sessions use `HttpOnly`, `Secure`, and `SameSite=Lax` cookies.
- Every API write checks authentication, ownership, and role on the server.
- Public anonymous responses omit private author identifiers entirely.
- Story bodies are stored and rendered as plain text. Arbitrary user HTML is not accepted.
- Image uploads validate content type, decoded image format, file size, count, and dimensions.
- R2 object names use generated identifiers rather than user filenames.
- Moderation actions, unpublishing, restoration, and role changes create append-only audit entries that application APIs do not update or delete.
- Secrets such as `GITHUB_CLIENT_SECRET` are configured with Wrangler secrets and never committed.
- Bootstrap administrator resolution occurs server-side on every protected request.

## 10. Error Handling

- OAuth errors return the user to a login error state without creating a partial account.
- Failed image uploads leave the editor intact and identify the failed asset.
- Failed submission saves preserve local form state and allow retry.
- Failed moderation transitions do not partially publish a revision.
- A ranking outage falls back to latest stories.
- Unauthorized API requests return consistent `401` or `403` responses without leaking private metadata.
- Missing and unpublished stories return a public `404` unless the requester has moderation access.

## 11. Testing And Acceptance

Automated tests cover:

- OAuth state validation and session handling.
- All four permission levels and route guards.
- Bootstrap administrator protection.
- Story lifecycle transitions and revision publication behavior.
- Anonymous public serialization.
- Image validation and failed upload recovery.
- Duplicate-like prevention, unlike behavior, and concurrent count correctness.
- Latest, hottest, and random ordering.
- Ranking fallback behavior.
- Audit entry creation.

Browser-level tests cover public browsing, GitHub-authenticated submission with a stubbed OAuth boundary, staff review, administrator role assignment, likes, and responsive layouts. Final visual verification uses populated realistic stories on desktop and mobile before grid dimensions are finalized.

## 12. Deployment Inputs

The operator provides:

- A Cloudflare account.
- A GitHub OAuth App.
- `GITHUB_CLIENT_ID`.
- `GITHUB_CLIENT_SECRET` as a Wrangler secret.
- The production origin and OAuth callback URL.
- A KV namespace, R2 bucket, and SQLite-backed Durable Object binding.
- `ADMIN_GITHUB_USERS=icebraker`.

The project will include Wrangler configuration, resource bindings, local development instructions, deployment scripts, and an environment variable example without secrets.
