import { build } from 'vite'
import { fileURLToPath } from 'node:url'
const root=fileURLToPath(new URL('../',import.meta.url))
await build({root,configFile:false,logLevel:'warn',ssr:{noExternal:true},build:{ssr:'src/assessment/serverGrader.ts',outDir:'../AeppGenerator/src/AeppGenerator.Api/Assessment/Grader',emptyOutDir:false,minify:true,rolldownOptions:{output:{entryFileNames:'grade.mjs',inlineDynamicImports:true}}}})
