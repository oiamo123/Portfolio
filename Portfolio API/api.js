const express = require("express");
const mongoose = require("mongoose");
const app = express();
const data = require("./data.json");
const cors = require("cors");
const nodemailer = require("nodemailer");
const { google } = require("googleapis");
const fs = require("fs");
const { z } = require("zod");

const Projects = require("./models/Projects.js");
const Tools = require("./models/Tools");
const Project_Tools = require("./models/Project-Tools.js");

app.use(cors());
app.use(express.urlencoded());
app.use(express.json());

const emailSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  email: z.string().email(),
  message: z.string().min(10, "Message must be at least 20 characters"),
});

const validateSchema = function (schema) {
  return (req, res, next) => {
    try {
      schema.parse(req.body);
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

mongoose.connect(data.uri).then(() => {
  console.log("Connected to MongoDB Atlas");
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

app.post("/api/mail", validateSchema(emailSchema), async (req, res) => {
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
});

app.listen(data.port, () => {
  console.log("Server is listening");
});
