module.exports = {
  apps: [
    {
      name: "crm-app",
      script: "npm",
      args: "start",
      cwd: "/root/CRM-Pro/web-app",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};