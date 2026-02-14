// /config/index.js
const dotenv = require("dotenv");
dotenv.config(); // .env 파일 로드 (dotenv 라이브러리)

const defaultConfig = require("./default");
let environmentConfig = {};

switch (process.env.NODE_ENV){
  case "prd":
    environmentConfig = require("./production");
    break;
  case "stg":
    environmentConfig = require("./staging");
    break;
  default:
    environmentConfig = {};
}


module.exports = {
  ...defaultConfig,
  ...environmentConfig
};
