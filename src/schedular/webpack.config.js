export default {
  entry: "./src/index.ts",
  target: "node",
  output: {
    path: `${process.cwd()}/dist`,
    filename: "index.mjs",
    libraryTarget: "module",
  },
  mode: "production",
  optimization: {
    minimize: true,
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js"],
  },
  experiments: {
    outputModule: true,
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        enforce: "pre",
        loader: "tslint-loader",
        options: {},
      },
      {
        test: /\.tsx?$/,
        loader: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  externals: {
    // Exclude peer dependencies if needed
    // Remove this if you want everything bundled
  },
};
