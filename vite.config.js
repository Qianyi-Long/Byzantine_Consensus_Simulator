import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1];
const githubPagesBase = repoName
  ? repoName.endsWith('.github.io')
    ? '/'
    : `/${repoName}/`
  : './';

export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? githubPagesBase : './',
  plugins: [react()],
});
