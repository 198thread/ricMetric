const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

module.exports = {
    entry: {
        background: './src/background.js'
    },
    output: {
        filename: '[name].js',
        path: path.resolve(__dirname, 'dist'),
    },
    mode: 'development',
    devtool: 'source-map',
    experiments: {
        topLevelAwait: true,
    },
    resolve: {
        fallback: {
            fs: false,
            path: false,
        },
    },
    plugins: [
        new CleanWebpackPlugin(),
        new CopyWebpackPlugin({
            patterns: [
                // Copy JS files individually
                {
                    from: '*.js',
                    context: path.resolve(__dirname, 'src'),
                    to: path.resolve(__dirname, 'dist'),
                },
                // Copy manifest.json
                {
                    from: 'manifest.json',
                    context: path.resolve(__dirname, 'src'),
                    to: path.resolve(__dirname, 'dist'),
                },
                // Copy models directory
                {
                    from: 'models',
                    to: 'models',
                    context: path.resolve(__dirname),
                },
                // copy wasm files
                {
                    from: '**/*.wasm',
                    to: 'wasm/[name][ext]',
                    context: path.resolve(__dirname, 'node_modules/@huggingface/transformers/dist')
                },
                // copy wasm sibling files
                {
                    from: '**/*.mjs',
                    to: 'wasm/[name][ext]',
                    context: path.resolve(__dirname, 'node_modules/@huggingface/transformers/dist')
                }
            ],
        }),
    ],
};