const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  const { token } = req.cookies
  if (!token) {
    res.status(401).send({ message: "Acceso no autorizado!" });
  } else {
    jwt.verify(token, process.env.SECRET_KEY, (err, payload) => {
      if (err) {
        res.cookie("token", '', {
          httpOnly: false,
          secure: true,
          sameSite: "none",
        });
        res.status(401).send({ error: "Acceso no autorizado!" });
      } else {
        req.userId = payload._id;
        next();
      }
    });
  }
};
