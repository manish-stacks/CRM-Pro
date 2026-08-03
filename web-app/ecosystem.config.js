module.exports = {
  apps: [
    {
      name: "hbs-crm",
      script: "npm",
      args: "start",
      cwd: "/root/CRM-Pro/web-app",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};