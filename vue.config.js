const { defineConfig } = require('@vue/cli-service')
module.exports = defineConfig({
  transpileDependencies: true,
  devServer: {
    port: 8080,
    proxy: {
      '/api': {
        target: 'http://47.97.107.232:3001',
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://47.97.107.232:3001',
        changeOrigin: true
      }
    }
  }
})
