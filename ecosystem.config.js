module.exports = {
  apps: [
    {
      name: '42customer-backend',
      cwd: './backend',
      script: 'node',
      args: 'dist/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3100
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3100
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true
    },
    {
      name: '42customer-frontend',
      cwd: './frontend',
      script: 'node',
      args: '-e "const express = require(\'express\'); const path = require(\'path\'); const app = express(); app.use(express.static(path.join(__dirname, \'dist/spa\'))); app.get(\'*\', (req, res) => { res.sendFile(path.resolve(__dirname, \'dist/spa/index.html\')); }); app.listen(8080, \'0.0.0.0\', () => console.log(\'Frontend running on port 8080\'));"',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 8080
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 8080
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true
    }
  ]
};