const {
  get,
  signup,
  verifyAccount,
  verifyToken,
  update,
  delete: deleteUser,
  login,
  forgotPassword,
  changePassword,
} = require("../controllers/user.controller");
const auth = require("../middlewares/auth.middleware");
const router = require("express").Router();

router.get("/:email&:password", login);
router.post("/signUp", signup);
router.put("/update/:id", auth, update);
router.put("/change-password/:id", auth, changePassword);
router.delete("/delete/:id&:pass", auth, deleteUser);
router.put("/forgot-password", forgotPassword );
router.put("/verify", verifyAccount);
router.get("/isLogged/:token", verifyToken);

module.exports = router;
