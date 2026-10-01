import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      usePolling: true,
      interval: 1000,
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const moduleId = id.replaceAll('\\', '/');
          const packagePath = moduleId.split('/node_modules/').at(-1) ?? '';
          if (/^(react|react-dom|scheduler|use-sync-external-store|@reduxjs|redux|redux-persist|react-redux)\//.test(packagePath)) return 'react-vendor';
          if (/^(antd|@ant-design|@rc-component|rc-|dayjs)\//.test(packagePath)) return 'antd-vendor';
        },
      },
    },
  },
});
