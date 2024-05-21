const path = require("path");
//HTML 플러그인
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
  mode: "development",
  entry: "./src/main.js", //진입점
  output: {
    path: path.resolve(__dirname, "dist"), // bundle만들어질 장소
    filename: "main.js", // bundle 될 파일 이름
    publicPath: "http://localhost:3000/src", //웹팩 미들웨어 장소
    library: 'common',
  },
  module: {
    rules: [
      {
        test: /\.js$/, //.js 파일 templating
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env"],
          },
        },
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: "src/index.html", //html  webpack플러그인을 통해 html 파일도 함께 bundle
    }),
  ],
};