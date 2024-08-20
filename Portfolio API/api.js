const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const nodemailer = require("nodemailer");
const { google } = require("googleapis");
const dotenv = require("dotenv");
const rateLimit = require("express-rate-limit");
const { decrypt, encrypt } = require("./crypto/crypto.js");
const {
  emailSchema,
  validateSchema,
  validateRecaptcha,
  sanitize,
} = require("./validation/validation.js");

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
});

const app = express();
app.use(limiter);
app.use(cors());
app.use(express.urlencoded());
app.use(express.json());
dotenv.config();

const Projects = require("./models/Projects.js");
const Tools = require("./models/Tools");
const Project_Tools = require("./models/Project-Tools.js");
const Images = require("./models/Images.js");
const Timeline = require("./models/Timeline.js");
const Data = require("./models/Data.js");

// middleware
mongoose.connect(process.env.URI).then(() => {
  console.log("Connected to MongoDB Atlas");
});

// routes
app.get("/api/images", async (req, res) => {
  try {
    const images = await Images.find({ for: "profile" }).lean();
    if (!images) {
      res.status(400).json({ message: "Unable to retrieve image" });
    }

    res.status(200).json(images);
  } catch (err) {
    res.status(400).json({ message: "An error occured" });
  }
});

app.get("/api/timeline", async (req, res) => {
  try {
    const timeline = await Timeline.find({}).lean();
    if (!timeline) {
      res
        .status(400)
        .json({ message: "There was an issue receiving the timeline data" });
    }

    res.status(200).json(timeline);
  } catch (err) {
    res.status(400).json({ message: "An error occured" });
  }
});

app.get("/api/skills", async (req, res) => {
  try {
    const tools = await Tools.find({}).lean();
    if (!tools) {
      res.status(400).json({ message: "There was an issue loading the tools" });
    }
    res.status(200).json(tools);
  } catch (err) {
    res.status(400).json({ message: "An error occured" });
  }
});

app.post("/api/resume", validateRecaptcha, async (req, res) => {
  try {
    const resume = await Images.findOne({ for: "resume" }).lean();
    const coverletter = await Images.findOne({ for: "coverletter" }).lean();

    if (!resume || !coverletter) {
      res
        .status(400)
        .json({ message: "There was an issue retrieving the images" });
    }

    res.status(200).json({ resume, coverletter });
  } catch (err) {
    res.status(400).json({ message: "An error occured" });
  }
});

app.get("/api/projects", async (req, res) => {
  try {
    // get projects, tools and project tools
    const projects = await Projects.find({}).lean();
    const tools = await Tools.find({}).lean();
    const project_tools = await Project_Tools.find({}).lean();

    const projectsAndTools = projects.map((project) => {
      project.tools = [];

      project_tools.forEach((projectTool) => {
        if (project._id.toString() === projectTool.ProjectID.toString()) {
          const tool = tools.find(
            (tool) => tool._id.toString() === projectTool.ToolID.toString()
          );

          project.tools.push(tool.tool);
        }
      });

      return project;
    });

    res.status(200).json(projectsAndTools);
  } catch (err) {
    res
      .status(500)
      .json({ message: "There was an issue loading the projects" });
  }
});

app.post(
  "/api/mail",
  validateRecaptcha,
  validateSchema(emailSchema),
  async (req, res) => {
    const name = sanitize(req.body.name);
    const email = sanitize(req.body.email);
    const message = sanitize(req.body.message);

    const data = await Data.find({
      for: { $in: ["ClientID", "ClientSecret", "RefreshToken"] },
    });
    const clientID = data.find((item) => item.for === "ClientID");
    const clientSecret = data.find((item) => item.for === "ClientSecret");
    const refreshToken = data.find((item) => item.for === "RefreshToken");

    const clientIDKeydecrypted = decrypt(clientID.key);
    const clientSecretKeyDecrypted = decrypt(clientSecret.key);
    const refreshTokenKeyDecrypted = decrypt(refreshToken.key);

    if (!clientID || !clientSecret || !refreshToken) {
      throw new Error("Unable to retrieve necessary credentials");
    }

    try {
      const oauth2Client = new google.auth.OAuth2(
        clientIDKeydecrypted,
        clientSecretKeyDecrypted,
        process.env.REDIRECT_URI
      );

      oauth2Client.setCredentials({
        refresh_token: refreshTokenKeyDecrypted,
      });

      const accessToken = await oauth2Client
        .getRequestHeaders()
        .then((headers) => headers["Authorization"].split(" ")[1]);

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          type: "OAuth2",
          user: process.env.EMAIL,
          accessToken: accessToken,
          clientId: clientIDKeydecrypted,
          clientSecret: clientSecretKeyDecrypted,
          refreshToken: refreshTokenKeyDecrypted,
        },
      });

      const mailOptions = {
        from: email,
        to: process.env.EMAIL,
        subject: `${name} - Portfolio`,
        text: message,
      };

      transporter.sendMail(mailOptions, async (err, info) => {
        if (err) {
          res
            .status(500)
            .json({ message: "There was an issue sending the email" });
        } else {
          await Data.updateOne(
            { for: "AccessToken" },
            { $set: { key: encrypt(accessToken) } }
          );

          res.status(200).json({ message: "Email successfully sent" });
        }
      });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "An error occurred" });
    }
  }
);

app.listen(process.env.PORT, () => {
  console.log("Server is listening");
});
