const express = require("express");
const mongoose = require("mongoose");
const data = require("./data.json");
const cors = require("cors");
const nodemailer = require("nodemailer");
const { google } = require("googleapis");
const fs = require("fs");
const { z } = require("zod");
const request = require("./request.json");

const Projects = require("./models/Projects.js");
const Tools = require("./models/Tools");
const Project_Tools = require("./models/Project-Tools.js");
const Images = require("./models/Images.js");
const Timeline = require("./models/Timeline.js");

const app = express();

app.use(cors());
app.use(express.urlencoded());
app.use(express.json());

// middleware
const emailSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  email: z.string().email(),
  message: z.string().min(10, "Message must be at least 20 characters"),
});

const validateSchema = function (schema) {
  return (req, res, next) => {
    try {
      const dataToValidate = {
        name: req.body.name,
        email: req.body.email,
        message: req.body.message,
      };

      schema.parse(dataToValidate);
      next();
    } catch (err) {
      const errors = err.errors.map((e) => ({
        path: e.path.join("."),
        message: e.message,
      }));
      res.status(400).json(err.errors);
    }
  };
};

const validateRecaptcha = async function (req, res, next) {
  request.event.token = req.body.token;
  request.event.expectedAction = "mail";

  const recaptchaResponse = await fetch(
    `https://recaptchaenterprise.googleapis.com/v1/projects/numeric-camp-431804-f4/assessments?key=${data.APIKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    }
  );

  const response = await recaptchaResponse.json();

  if (response.riskAnalysis.score <= 0.3) {
    res.status(400).json({
      message:
        "Sorry, your email can't be sent right now due to suspicious activity.",
    });
  } else {
    next();
  }
};

mongoose.connect(data.uri).then(() => {
  console.log("Connected to MongoDB Atlas");
});

// routes
app.get("/api/images", async (req, res) => {
  const images = await Images.find({ for: "profile" }).lean();

  res.status(200).json(images);
});

app.get("/api/timeline", async (req, res) => {
  const timeline = await Timeline.find({}).lean();
  res.status(200).json(timeline);
});

app.get("/api/skills", async (req, res) => {
  const tools = await Tools.find({}).lean();
  res.status(200).json(tools);
});

app.post("/api/resume", validateRecaptcha, async (req, res) => {
  const resume = await Images.findOne({ for: "resume" }).lean();
  const coverletter = await Images.findOne({ for: "coverletter" }).lean();

  res.status(200).json({ resume, coverletter });
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
    res.status(500).json({ message: err.message });
  }
});

app.post(
  "/api/mail",
  validateRecaptcha,
  validateSchema(emailSchema),
  async (req, res) => {
    const { name, email, message } = req.body;
    try {
      const oauth2Client = new google.auth.OAuth2(
        data.ClientID,
        data.ClientSecret,
        data.RedirectURI
      );

      oauth2Client.setCredentials({
        refresh_token: data.RefreshToken,
      });

      const { token: accessToken } = await oauth2Client.getAccessToken();
      data.AccessToken = accessToken;

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          type: "OAuth2",
          user: data.email,
          accessToken: data.AccessToken,
          clientId: data.ClientID,
          clientSecret: data.ClientSecret,
          refreshToken: data.RefreshToken,
        },
      });

      const mailOptions = {
        from: email,
        to: data.email,
        subject: `${name} - Portfolio`,
        text: message,
      };

      transporter.sendMail(mailOptions, (err, info) => {
        if (err) {
          console.log(err);
          res
            .status(500)
            .json({ message: "There was an issue sending the email" });
        } else {
          fs.writeFileSync(
            "./data.json",
            JSON.stringify({ ...data, AccessToken: accessToken }, null, 2)
          );
          res.status(200).json({ message: "Email successfully sent!" });
        }
      });
    } catch (error) {
      res.status(500).json({ message: "An error occurred" });
    }
  }
);

app.listen(data.port, () => {
  console.log("Server is listening");
});
