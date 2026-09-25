import { defineConfig } from 'vite';
import { config } from './project.config';
import { LOG } from '@robert.tools/log';

// const healthPlugin = () => ({
//     name: 'health-endpoint',
//     configureServer: (server: any) => {
//         server.middlewares.use('/healthz', (_req: any, res: any) => {
//             res.statusCode = 200;
//             res.setHeader('content-type', 'text/plain; charset=utf-8');
//             res.end('ok');
//         });
//     },
// });

LOG.OK('Vite config running...');

// https://vitejs.dev/config/
export default defineConfig({
    // This is not critical, but I include it because there are more HTML transforms via plugins, that templates must handle
    // TODO: For legacy() to work without a hitch, we set a known @babel/standalone version in package.json
    // Remove that once https://github.com/vitejs/vite/issues/2442 is fixed
    // plugins: [healthPlugin()],
    build: {
        // This is important: Generate directly to _site and then assetsDir.
        // You could opt to build in an intermediate directory,
        // and have Eleventy copy the flies instead.
        outDir: config.OUTPUT_DIR,
        // This is the default assetsDir. If you are using assets
        // for anything else, consider renaming assetsDir.
        // This can help you set cache headers for hashed output more easily.
        // assetsDir: "assets",
        // Sourcemaps are nice, but not critical for this to work
        sourcemap: true,
        // This is critical: generate manifest.json in outDir
        manifest: true,
        rollupOptions: {
            // This is critical: overwrite default .html entry
            input: `${config.ENTRY_FILE}`,
        },
    },
});
