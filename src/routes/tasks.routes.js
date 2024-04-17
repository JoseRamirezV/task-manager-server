const { get, add, update, delete: deleteTask } = require("#controllers/tasks.controller");
const auth = require("#middlewares/auth.middleware")
const router = require("express").Router();

router.get("/:email",auth, get);
router.post("/add",auth, add);
router.put("/update/:id",auth, update);
router.delete("/delete",auth, deleteTask);

module.exports = router;
