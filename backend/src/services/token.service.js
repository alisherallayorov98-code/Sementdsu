// JWT token yaratish va tekshirish
const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_EXPIRES } = require('../config');

exports.sign   = (payload) => jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
exports.verify = (token)   => jwt.verify(token, JWT_SECRET);
