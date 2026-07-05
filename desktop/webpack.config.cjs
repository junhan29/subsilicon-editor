const path = require('path')
const webpack = require('webpack')

module.exports = [
  {
    entry: './desktop/main.ts',
    target: 'electron-main',
    mode: 'development',
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
      ],
    },
    resolve: {
      extensions: ['.ts', '.js'],
    },
    output: {
      path: path.resolve(__dirname, '.electron'),
      filename: 'main.js',
    },
    externals: {
      electron: 'commonjs electron',
    },
  },
  {
    entry: './desktop/preload.ts',
    target: 'electron-preload',
    mode: 'development',
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
      ],
    },
    resolve: {
      extensions: ['.ts', '.js'],
    },
    output: {
      path: path.resolve(__dirname, '.electron'),
      filename: 'preload.js',
    },
    externals: {
      electron: 'commonjs electron',
    },
  },
]