import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    publicDir: 'public',

    define: {
      global: 'globalThis',
    },

    optimizeDeps: {
      exclude: ['@mediapipe/tasks-vision'],
    },

    server: {
      host: true,
      plugins: [],
    },

    plugins: [
      {
        name: 'fortune-dev-proxy',
        configureServer(server) {
          server.middlewares.use('/fortune', async (req, res) => {
            if (req.method !== 'POST') {
              res.writeHead(405);
              res.end();
              return;
            }

            const chunks = [];
            for await (const chunk of req) chunks.push(chunk);
            const { prompt } = JSON.parse(Buffer.concat(chunks).toString());

            const apiKey = env.VITE_ANTHROPIC_API_KEY;
            const upstream = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
              },
              body: JSON.stringify({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 900,
                stream: true,
                messages: [{ role: 'user', content: prompt }],
              }),
            });

            res.writeHead(upstream.status, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
            for await (const chunk of upstream.body) res.write(chunk);
            res.end();
          });
        },
      },
    ],
  };
});
