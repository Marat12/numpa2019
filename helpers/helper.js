const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
const { promisify } = require("util");
const nodemailer = require("nodemailer");
const passport = require("passport");
const User = require("../models/user");
const LocalStrategy = require("passport-local").Strategy;
const Location = require("../models/location");
const Event = require("../models/event");

exports.fetchEventsByLocation = async () => {
  const locations = await Location.find({});
  let eventsByLocation = [];

  for await (let loc of locations) {
    eventsByLocation.push({
      name: loc.name,
      events: await Event.find({ location: loc._id })
        .populate("location")
        .sort({ start: -1 })
        .limit(3)
    });
  }
  return eventsByLocation;
};
exports.isAdmin = req => req.user.admin !== "true";

module.exports.ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  } else {
    res.redirect("/users/login");
  }
};
module.exports.redirectNonAdmin = (req, res, next) => {
  if (req.user.admin === "true") {
    return next();
  } else {
    return res.redirect("/admin/stories");
  }
};

passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password"
    },
    (email, password, done) => {
      User.getUserByEmail(email, (err, user) => {
        if (err) throw err;
        if (!user) {
          return done(null, false, {
            message: "Unknown User"
          });
        }
        User.comparePassword(password, user.password, (err, isMatch) => {
          if (err) throw err;
          if (isMatch) {
            return done(null, user);
          } else {
            return done(null, false, {
              message: "Invalid password"
            });
          }
        });
      });
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  User.getUserById(id, (err, user) => {
    done(err, user);
  });
});

exports.mongopath =
  process.env.MONGOURL || "mongodb://Marat1985:1234Mr1985@ds229909.mlab.com:29909/numpa";

exports.getAsyncRedis = () => {
  try {
    const redis = require("redis");
    const redisClient = redis.createClient({
      host: "127.0.0.1",
      port: 6379
    });

    redisClient.on("error", function(error) {
      console.error("Redis ERROR: " + error);
      process.exit();
    });

    redisClient.getAsync = promisify(redisClient.get).bind(redisClient);
    redisClient.setAsync = promisify(redisClient.set).bind(redisClient);

    return redisClient;
  } catch (err) {
    console.log(`Error occured in helper.js \n${err}`);
  }
};
exports.getRequestUrl = req => {
  return req.protocol + "://" + req.get("Host");
};
exports.sendMail = async (req, mailOptions) => {
  return new Promise((resolve, reject) => {
    let transporter = nodemailer.createTransport({
      service: 'gmail',
      host: process.env.MAILHOST,
      port: process.env.MAILPORT,
      secure: true,
      socketTimeout: 5000,
      logger: true,      
      auth: {
        user: process.env.MAILUSER,
        pass: process.env.MAILPW
      }
    });

    transporter.sendMail(mailOptions, async (error, info) => {
      if (error) {
        console.log(error, info);
        req.flash("danger", `Произошла ошибка, пожалуйста повторите позже!`);
        res.redirect(req.headers.referer);
        reject(error);
      }
      resolve(info);
    });
  });
};
