# CoRent

A collaborative rental decision-making platform for groups of prospective tenants in Singapore. Built for BT3103 with Vue 3, Vite, Vue Router and Firebase.

## Tech Stack
- Vue 3 + Vite
- Vue Router
- Firebase Authentication and Firestore

## Prerequisites
- Node.js (v20 or later): check with `node -v`
- Git
- VS Code (recommended)

## Getting Started

1. Clone the repo:
```bash
   git clone https://github.com/<your-username>/corent.git
   cd corent
```
2. Install dependencies:
```bash
   npm install
```
3. Create your environment file:
```bash
   cp .env.example .env.local
```
4. Open `.env.local` and fill in the Firebase values (ask John for them privately, do not post them anywhere public).
5. Start the dev server:
```bash
   npm run dev
```
6. Open the localhost URL shown in the terminal and click through the nav links to confirm everything loads.

## Important Rules
- Never commit `.env.local`. It is git-ignored, so leave it that way.
- Never commit API keys or secrets of any kind.
- Never push directly to `main`. Use feature branches and pull requests.
- Do not run `npm audit fix --force`.
- Keep the project folder outside iCloud, OneDrive or Dropbox.

## Project Structure
```
src/
  firebase.js        Firebase init (shared, do not edit without telling the team)
  main.js
  App.vue            Nav bar and <RouterView />
  router/index.js    All routes
  views/             One page per feature
  components/        Reusable components, grouped by feature
  services/          Firestore and API helper functions
```

## Feature Ownership

| Feature | Owner | Main files |
|---|---|---|
| User Access Control and Auth |  | `LoginView.vue`, `RegisterView.vue` |
| Profile Creation and Preference Aggregation |  | `ProfileView.vue` |
| Browsing House Listings |  | `ListingsView.vue` |

Put your own components in `src/components/<your-feature>/` and your Firestore logic in `src/services/`. This keeps us from editing the same files.

Shared files (`App.vue`, `router/index.js`, `firebase.js`, `package.json`): tell the team in the group chat before changing them.

## Git Workflow

1. Update `main` before starting work:
```bash
   git checkout main
   git pull
```
2. Create a feature branch:
```bash
   git checkout -b feature/<short-name>
```
3. Commit often with clear messages:
```bash
   git add .
   git commit -m "Add login form validation"
```
4. Push your branch:
```bash
   git push -u origin feature/<short-name>
```
5. Open a Pull Request on GitHub and request a review from a teammate.
6. After merging, delete the branch and run `git pull` on `main`.

Before `git add .`, always run `git status` and check that only your intended files are listed.

## Adding Dependencies
1. Run `npm install <package>`.
2. Commit both `package.json` and `package-lock.json`.
3. Tell the team so they run `npm install` after pulling.

## Troubleshooting
- Firebase values are `undefined`: check that `.env.local` is in the project root (next to `package.json`), each variable starts with `VITE_`, and you restarted `npm run dev` after editing it.
- `npm install` fails or behaves oddly: confirm you are running it in the folder that contains `package.json`.
- Merge conflicts: pull `main` into your branch regularly, and ask for help before overriding anyone's changes.
- `git status` shows unexpected files: check where you are with `git rev-parse --show-toplevel`.