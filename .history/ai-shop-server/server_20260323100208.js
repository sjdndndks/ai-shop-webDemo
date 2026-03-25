require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();

//允许前端跨域
app.use(cors());

app.use(express.json());