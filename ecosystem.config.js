module.exports = {
    apps: [
        {
            name: 'munandy-weight-bot',
            script: 'index.js',
            instances: 1,
            autorestart: true,
            watch: false,       // Do not watch for file changes in production
            max_memory_restart: '200M',
            env: {
                NODE_ENV: 'production',
            },
        },
    ],
};
