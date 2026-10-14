// pm2 process file — start with: pm2 start ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'spotibed',
      script: 'src/index.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      kill_timeout: 5000,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
