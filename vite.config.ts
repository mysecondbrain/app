import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/app/',   // <<< ganz wichtig: Repo-Name hier eintragen
  plugins: [react()],
})
