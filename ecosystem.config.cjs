module.exports = {
  apps: [
    {
      name: "keep-living-h5",
      cwd: "F:\\Projects\\keep-living-h5",
      script: "node_modules/vite/bin/vite.js",
      args: "--host",
      interpreter: "node",
      autorestart: true,
      max_restarts: 20,
      restart_delay: 1000,
      exp_backoff_restart_delay: 2000,
      max_memory_restart: "800M",
      env: {
        NODE_ENV: "development",
      },
    },
  ],
};
