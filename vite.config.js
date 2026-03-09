import path from "path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 1000, // Aumenta o limite do aviso para 1MB (opcional)
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Separa bibliotecas pesadas em seus próprios arquivos
            if (id.includes('jspdf') || id.includes('html2canvas')) {
              return 'pdf-libs';
            }
            if (id.includes('three')) {
              return 'three-libs';
            }
            // O restante fica no vendor padrão
            return 'vendor';
          }
        },
      },
    },
  },
})