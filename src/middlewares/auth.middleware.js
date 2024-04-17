const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  const token = req.headers.authorization.split(' ')[1];
  if (!token) {
    res.status(401).send({ message: "Acceso no autorizado!" });
  } else {
    jwt.verify(token, process.env.SECRET_KEY, (err, payload) => {
      if (err) {
        res.status(401).send({ error: "Acceso no autorizado!" });
      } else {
        req.userId = payload._id;
        next();
      }
    });
  }
};
