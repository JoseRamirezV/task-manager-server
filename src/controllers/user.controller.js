const User = require("../models/user");
const Task = require("../models/task");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const sendEmail = require("../config/mailer");

//TODO
// borrar tareas cuya fecha limite excedió los 2 días

module.exports = {
  login: async (req, res) => {
    try {
      const { email, password } = req.params;
      const user = await User.findOne({ email });
      if (!user)
        return res.status(404).json({
          error: "Este correo no esta asociado con una cuenta Taskty",
        });
      const authenticated = bcrypt.compareSync(password, user.password);
      if (!authenticated)
        return res.status(401).json({ error: "Credenciales incorrectas" });
      user._doc.createdAt = undefined;
      user._doc.updatedAt = undefined;
      user._doc.password = undefined;
      const token = jwt.sign({ ...user._doc }, process.env.SECRET_KEY, {
        expiresIn: "1d",
      });
      res.cookie("token", token, {
        httpOnly: false,
        secure: true,
        sameSite: "none",
      });
      res.status(200).json({ user: user._doc });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  signup: async (req, res) => {
    try {
      const {
        email,
        firstName,
        firstLastName,
        temporalToken,
        verificationUrl,
      } = req.body;
      const exists = await User.findOne({ email });
      if (exists)
        return res.status(400).json({
          exists:
            "Este correo electrónico ya se encuentra asociado a una cuenta Taskty",
        });

      const password = encryptPassword(req.body.password);
      const user = `${firstName} ${firstLastName}`;

      const newUser = new User({
        ...req.body,
        user,
        password,
        temporalToken,
      });
      await newUser.save();

      await sendEmail(email, "Verificación de cuenta", "Verification", {
        user,
        code: temporalToken,
        url: verificationUrl,
      });

      res.status(201).send({ ok: "Registrado!" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  update: async (req, res) => {
    try {
      const { id } = req.params;
      const { needsVerification, ...newData } = req.body;
      if (needsVerification) {
        newData.verified = false;
        newData.temporalToken = needsVerification.temporalToken;
      }
      newData.user = `${newData.firstName} ${newData.firstLastName}`;
      const userData = await User.findByIdAndUpdate(id, newData, {
        new: true,
      });
      if (!userData) throw new Error("Algo salió mal");
      if (needsVerification) {
        const { temporalToken, verificationUrl, oldEmail } = needsVerification;
        await sendEmail(
          newData.email,
          "Verificación de cuenta",
          "Verification",
          {
            user: newData.user,
            code: temporalToken,
            url: verificationUrl,
          }
        );
        await Task.updateMany(
          { userEmail: oldEmail },
          { userEmail: newData.email }
        );
      }
      userData._doc.createdAt = undefined;
      userData._doc.updatedAt = undefined;
      userData._doc.password = undefined;
      userData._doc.temporalToken = undefined;
      res.json({ user: userData._doc });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  delete: async (req, res) => {
    try {
      const { id, pass } = req.params;
      const { email, password } = await User.findById(id);
      const passwordMatches = bcrypt.compareSync(pass, password);
      if (!passwordMatches) throw new Error("Contraseña incorrecta");
      await User.deleteOne({ _id: id });
      await Task.deleteMany({ userEmail: email });
      res.json({ ok: "Cuenta eliminada" });
    } catch (error) {
      res.json({ error: error.message });
    }
  },

  changePassword: async (req, res) => {
    try {
      const { oldPassword, newPassword } = req.body;
      const { id: _id } = req.params;
      const { password: currentPassword } = await User.findById(_id);
      const matches = bcrypt.compareSync(oldPassword, currentPassword);
      if (!matches) throw new Error("Contraseña incorrecta!");
      const updated = await User.findOneAndUpdate(
        { _id },
        { password: encryptPassword(newPassword) },
        { new: true }
      );
      if (!updated) throw new Error("No se encontró el usuario indicado");
      res.json({ ok: "Actualizado!" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  forgotPassword: async (req, res) => {
    try {
      const { email, code, temporalToken, newPassword } = req.body;
      if (JSON.stringify(req.body) === "{}") throw new Error("Empty body");
      if (temporalToken) {
        const userData = await User.findOneAndUpdate(
          { email },
          { temporalToken }
        );
        if (!userData)
          throw new Error("Este correo no se encuentra registrado en Taskty");
        sendEmail(email, "Código temporal", "Password", {
          user: userData.user,
          code: temporalToken,
        });
        return res.json({ ok: "Código enviado" });
      }
      const found = await User.findOneAndUpdate(
        { email, temporalToken: code },
        { password: encryptPassword(newPassword), temporalToken: null },
        { new: true }
      );
      if (!found) throw new Error("Token incorrecto");

      res.json({ ok: "Contraseña actualizado", user: found });
      return;
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  verifyAccount: async (req, res) => {
    try {
      const { email, code } = req.body;
      const { verified, temporalToken } = await User.findOne({ email });
      if (verified) throw new Error("Este usuario ya se encuentra verificado");
      if (code !== temporalToken)
        return res.status(401).json({
          invalid: "Código no valido, por favor verifica e intenta de nuevo",
        });
      const user = await User.findOneAndUpdate(
        { email },
        { temporalToken: null, verified: true },
        { new: true }
      );
      user._doc.createdAt = undefined;
      user._doc.updatedAt = undefined;
      user._doc.password = undefined;
      const token = jwt.sign({ ...user._doc }, process.env.SECRET_KEY);
      res.cookie("token", token, {
        httpOnly: false,
        secure: true,
        sameSite: "none",
      });
      res.json({ user: { ...user._doc, token } });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  verifyToken: (req, res) => {
    try {
      const { token } = req.cookies;
      jwt.verify(token, process.env.SECRET_KEY, async (err, decoded) => {
        if (err) return res.status(401).json({ error: "La sesión caducó" });
        const user = await User.findById(decoded._id);
        user._doc.createdAt = undefined;
        user._doc.updatedAt = undefined;
        user._doc.password = undefined;
        user._doc.temporalToken = undefined;
        res.status(200).json({ user });
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
};

const encryptPassword = (password) => {
  const saltRounds = Number(process.env.SALT_ROUNDS);
  return bcrypt.hashSync(password, saltRounds);
};
