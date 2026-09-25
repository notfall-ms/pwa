
## file system
```src/
  frontend/
  backend/
    apps/
    _shared/
      
```

## dependencies
- **typescript**: needed to run eleventy with typescript
- **tsx**: for running and building the backend apps
- **@types/node**: for type definitions of node modules (e.g. child_process)
- **ts-node**: for transpiling the configs to js on the fly (e.g. project.config.js)
- **@11ty/eleventy**: for the static site generator
- **@typescript-eslint/eslint-plugin**: for creating custom ESLint rules
- **eslint**: for linting the code with ESLint
- **npm-run-all**: for running multiple npm scripts in parallel (e.g. `npm-run-all --parallel dev:md watch:atomic watch:api dev:eleventy dev:vite watch:healthcheck`)
- **vite**: for building the frontend assets

### testing
* **jest**: for testing the code (rules are in `jest.config.js`)
* **@types/jest**: for type definitions of jest
* **ts-jest**: for transpiling the tests to js on the fly
* **mock-fs**: for mocking the file system in tests
* **jest-environment-jsdom**: for simulating the browser environment in tests

## config

### eslint + prettier
* eslint.config.ts is loaded via `eslint.config.cjs` using Jiti
* `eslint.config.cjs` is the entry point for ESLint configuration in this project
* prettier rules are defined in `.prettierrc` and referred to by ESLint via `eslint-config-prettier`

### eleventy
The main eleventy configuration can be found in: `.eleventy.config.ts`
* **variables** defined in `project.config.ts`
* **filters** are defined in `src/setup/filters/filter.config.ts`
* **shortcodes** are defined in `src/setup/shortcodes/vite.shortcode.ts`


### linters
- **ESLint**: for linting the code (rules are in `.eslintrc.js`)
- **Prettier**: for formatting the code (rules are in `.prettierrc`)
- **JSDoc**: for documenting the code (rules are in `src/setup/linter/index.ts`)

## backend

### app
* create folder in `src/backend/apps/<app-name>/`
* create file `index.ts` in the app folder
* run the app with `npm run start_app <app-name>` (e.g. `npm run start_app test`)
* create a build task entry in `package.json` for the app (e.g. `"build:api": "npm run build_app -- api"`)
* for production build, run `npm run build_app <app-name>` (e.g. `npm run build_app test`)