const User = require("#models/user");
const Task = require("#models/task");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const sendEmail = require("#config/mailer");
const { scheduleJob, scheduledJobs } = require("node-schedule");
const moment = require("#config/moment");

module.exports = {
  login: async (req, res) => {
    try {
      const { email, password } = req.params;
      const user = await User.findOne({ email });
      if (!user) throw new Error("Este correo no esta asociado con una cuenta Taskty")
      const authenticated = bcrypt.compareSync(password, user.password);
      if (!authenticated) throw new Error("Credenciales incorrectas")
      user._doc.createdAt = undefined;
      user._doc.updatedAt = undefined;
      user._doc.password = undefined;
      const token = generateToken({ ...user._doc });
      res.status(200).json({ user: user._doc, token });
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
        return res.json({
          error:
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

      res.status(201).send({ success: "Registrado!" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  update: async (req, res) => {
    try {
      const { id } = req.params;
      const { needsVerification, ...newData } = req.body;
      if (needsVerification) {
        const emailExists = await User.findOne({ email: newData.email });
        console.log(emailExists);
        if (emailExists){
          throw new Error("Este email ya se encuentra registrado en Taskty")
        }
        newData.verified = false;
        newData.temporalToken = needsVerification.temporalToken;
      }
      newData.user = `${newData.firstName} ${newData.firstLastName}`;
      const userData = await User.findByIdAndUpdate(id, newData, {
        new: true,
      });
      if (!userData)
        throw new Error("Algo salió mal, por favor intenta de nuevo mas tarde");
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
        const tasksToNotifyToday = await Task.find({
          userEmail: newData.email,
          notify: true,
          notificationDate: {
            $gte: moment().toISOString(),
            $lt: moment(moment().format("YYYY-MM-DD 23:59")).toISOString(),
          },
        });
        if (tasksToNotifyToday) {
          for (const {
            _id,
            title,
            description,
            notificationDate,
            limitDate,
            userEmail,
          } of tasksToNotifyToday) {
            scheduledJobs[`${_id}`].cancel();
            const date = new Date(notificationDate);
            scheduleJob(`${_id}`, date, async () => {
              await sendEmail(userEmail, title, "Notification", {
                description,
                limitDate: moment(limitDate).format("DD [de] MMMM [del] YYYY"),
              });
              await Task.updateOne({ _id }, { notified: true });
            });
          }
        }
      }
      userData._doc.createdAt = undefined;
      userData._doc.updatedAt = undefined;
      userData._doc.password = undefined;
      userData._doc.temporalToken = undefined;
      res.json({ user: userData._doc });
    } catch (error) {
      console.log(error.message);
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
        throw new Error(
          "Código no valido, por favor verifica e intenta de nuevo"
        );
      const user = await User.findOneAndUpdate(
        { email },
        { temporalToken: null, verified: true },
        { new: true }
      );
      user._doc.createdAt = undefined;
      user._doc.updatedAt = undefined;
      user._doc.password = undefined;
      const token = generateToken({ ...user._doc });
      res.json({ user: user._doc, token });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  verifyToken: (req, res) => {
    try {
      const { token } = req.params;
      if (!token) throw new Error("La sesión caducó");
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

const generateToken = (data) =>
  jwt.sign(data, process.env.SECRET_KEY, {
    expiresIn: "1d",
  });
