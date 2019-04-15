const { mongopath, getAsyncRedis } = require("./helpers/helper");
const express = require("express");
const compression = require("compression");
const app = express();
const path = require("path");
const bodyParser = require("body-parser");
const expressValidator = require("express-validator");
const session = require("express-session");
const passport = require("passport");
const MongoStore = require("connect-mongo")(session);
// const promisify = require('es6-promisify');
const { promisify } = require("util");
const Course = require("./models/course");
const Page = require("./models/page");
const Menulocation = require("./models/menulocation");
const Location = require("./models/location");
const flash = require("connect-flash");
const cron = require("node-cron");
const EventsController = require("./controllers/admin/AdminEventsController");
const JobsController = require("./controllers/admin/AdminJobsController");
const mongoose = require("mongoose");

// connect to redis server and get an extended client with promisified
// methods getAsync() and setAsync()
let redisClient = null;

if (process.env.USE_REDIS !== undefined && process.env.USE_REDIS === "true") {
  console.log("Redis enabled");

  redis = require("redis");
  redisClient = getAsyncRedis();
} else if (process.env.USE_REDIS === "false") {
  console.log("Redis disabled");
} else {
  console.error("USE_REDIS is not defined in .env");
  process.exit();
}

mongoose.set("useCreateIndex", true);
try {
  mongoose.connect(mongopath, { useNewUrlParser: true });
} catch (err) {
  console.log(`Please set a mongo path in your .env \n\n${err}`);
}

app.use(
  session({
    secret: process.env.SESSION_SECRET || "notaverysecuresecret",
    key: process.env.SESSION_KEY || "notaverysecurekey",
    resave: false,
    saveUninitialized: false,
    store: new MongoStore({ mongooseConnection: mongoose.connection })
  })
);
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));

app.use(compression());
app.use(express.static("public"));
app.use("/assets", express.static(path.join(__dirname, "node_modules/")));
app.use("/assets", express.static(path.join(__dirname, "assets/css/")));
app.use("/assets", express.static(path.join(__dirname, "assets/icons/")));
app.use("/media", express.static(path.join(__dirname, "assets/media/")));
app.use("/images", express.static(path.join(__dirname, "uploads/images")));

app.use(expressValidator());
app.use(flash());

app.use(function(req, res, next) {
  (res.locals.messages = {
    danger: req.flash("danger"),
    warning: req.flash("warning"),
    success: req.flash("success")
  }),
    (app.locals.pathclass = req.url
      .replace(/^\//g, "")
      .replace(/\//g, "-")
      .replace(/\-$/g, "")
      .toLowerCase());
  let match = req.url.match("[^/]+(?=/$|$)");
  res.locals.title = "ООО НУМПА";
  app.locals.moment = require("moment");
  res.locals.live = req.headers.host.includes("numpa.in.ua");
  if (match) {
    match = match[0].replace(/\//g, " ");
    res.locals.title =
      res.locals.title;
  }
  console.log(req.method, req.headers.host + req.url);
  next();
});
const methodOverride = require("method-override");
app.use(methodOverride("_method"));

app.use(passport.initialize());
app.use(passport.session());

app.use(async (req, res, next) => {
  let navData = null;

  if (process.env.USE_REDIS === "true") {
    try {
      getNavData = await redisClient.getAsync("navData");
      navData = JSON.parse(getNavData);
    } catch (error) {
      console.error("Redis ERROR: Could not get navigation data: " + error);
    }
  }

  if (navData === null) {
    let courses = await Course.find({})
      .sort("order")
      .exec();
    let locations = await Location.find({}).exec();

    let footerCat = await Menulocation.findOne({ name: "footer" });
    let footerPages = await Page.find({ menulocations: { $in: [footerCat] } });

    let headerCat = await Menulocation.findOne({ name: "header" });
    let headerPages = await Page.find({ menulocations: { $in: [headerCat] } });

    navData = {
      courses,
      locations,
      headerPages,
      footerPages
    };

    console.log("saving data");
    try {
      await redisClient.setAsync("navData", JSON.stringify(navData));
    } catch (error) {
      console.error("Redis ERROR: Could not save navigation data: " + error);
    }
  } else {
    console.log("using cached data");
  }

  const { courses, locations, headerPages, footerPages } = navData;

  res.locals.user = req.user || null;
  res.locals.currentPath = req.path;
  res.locals.locations = locations;
  res.locals.courses = courses;
  res.locals.headerPages = headerPages;
  res.locals.footerPages = footerPages;
  next();
});

app.use((req, res, next) => {
  req.login = promisify(req.login, req);
  next();
});

let indexRoutes = require("./routes/index");
let usersRoutes = require("./routes/users");
let storiesRoutes = require("./routes/stories");
let pagesRoutes = require("./routes/pages");
let jobsRoutes = require("./routes/jobs");
let eventsRoutes = require("./routes/events");
let coursesRoutes = require("./routes/courses");

let menulocationAdminRoutes = require("./routes/admin/menulocations");
let storiesAdminRoutes = require("./routes/admin/stories");
let coursesAdminRoutes = require("./routes/admin/courses");
let pagesAdminRoutes = require("./routes/admin/pages");
let jobsAdminRoutes = require("./routes/admin/jobs");
let locationsAdminRoutes = require("./routes/admin/locations");
let eventsAdminRoutes = require("./routes/admin/events");
let contactsAdminRoutes = require("./routes/admin/contacts");

app.use("/", indexRoutes);
app.use("/users", usersRoutes);
app.use("/stories", storiesRoutes);
app.use("/pages", pagesRoutes);
app.use("/jobs", jobsRoutes);
app.use("/events", eventsRoutes);
app.use("/courses", coursesRoutes);
app.use("/admin/stories", storiesAdminRoutes);
app.use("/admin/courses", coursesAdminRoutes);
app.use("/admin/pages", pagesAdminRoutes);
app.use("/admin/jobs", jobsAdminRoutes);
app.use("/admin/locations", locationsAdminRoutes);
app.use("/admin/events", eventsAdminRoutes);
app.use("/admin/menulocations", menulocationAdminRoutes);
app.use("/admin/contacts", contactsAdminRoutes);
app.use("/admin*", contactsAdminRoutes);

app.set("views", path.join(__dirname, "views/"));
app.set("view engine", "pug");

// scheduling cron job:
if (process.env.CRONINTERVAL) {
  console.log(`Cron scheduled for ${process.env.CRONINTERVAL}`)
  cron.schedule(
    process.env.CRONINTERVAL,
    () => {
      console.log(`Runing a job at ${new Date()}`);
      async function loadData() {
        try {
          const jobsResponse = await JobsController.fetchJobs();
          const response = await EventsController.fetchevents();
          console.log("👍 Done!\n\n Successfully Fetching data");
        } catch (e) {
          console.log("\n👎 Error! The Error info is below !!!");
          console.log(e);
          process.exit();
        }
      }
      loadData();
    },
    {
      scheduled: true,
      timezone: "Europe/Berlin"
    }
  );
} else {
  console.log(`No cron interval set in the .env. No cron started.`);
}

module.exports = app;
