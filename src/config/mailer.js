const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  pool: true,
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.TASKTY_EMAIL,
    pass: process.env.MAIL_KEY,
  },
});

const MAIL_TEMPLATES = {
  Notification: ({
    description,
    limitDate,
  }) => `<p>Tu tarea <i style="white-space: pre;">"${description}"</i> está por expirar <br><br>
    <strong style="color: red;">Fecha limite - ${limitDate}</strong><br><br>
    Recuerda que las tareas se eliminarán una vez pasados 2 días de su fecha limite, de igual manera te enviaremos un correo con el contenido de dicha tarea, así que no te preocupes, tu pendiente no se pierde 😉</p>`,
  Verification: ({ user, code, url }) =>
    `<p>Hola ${user}<br><br><strong style="font-size: 30px;">${code}</strong><br><br>Ingresa este código en la pagina de verificación para verificar tu cuenta y habilitar el envío de notificaciones<br><br>También puedes ingresar a la siguiente URL ${url}<br><br>Bienvenido a Taskty.co 😊</p>`,
  Password: ({ user, code }) =>
    `<p>Hola ${user}<br><br><strong style="font-size: 30px;">${code}</strong><br><br>Ingresa este código para recuperar tu contraseña<br><br>att Taskty.co 😊</p>`,
};

const sendMail = async (to, subject, contentType, data) => {
  await transporter.sendMail({
    from: `"Taskty Notifications" <${process.env.TASKTY_EMAIL}>`,
    to,
    subject,
    html: MAIL_TEMPLATES[contentType]({ ...data }),
  });
};

module.exports = sendMail;
