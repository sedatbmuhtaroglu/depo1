module.exports = {
  apps: [
    {
      name: "qrmenu-order",
      cwd: "/var/www/qrmenu-order",
      script: "npm",
      args: "run start",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
