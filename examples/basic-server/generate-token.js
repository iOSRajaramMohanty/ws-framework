const jwt = require("jsonwebtoken");

const token = jwt.sign(
  { id: "user1" },
  "your-secret-key"
);

console.log(token);