module.exports = {
  apps: [
    {
      name: 'satyanet-server',
      cwd: './server',
      script: 'index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      env_development: {
        NODE_ENV: 'development'
      },
      max_memory_restart: '300M',
      watch: false,
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      merge_logs: true,
      time: true
    }
  ]
};
