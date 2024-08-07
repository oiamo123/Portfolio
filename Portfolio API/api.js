const express = require("express");
const mongoose = require("mongoose");
const app = express();
const data = require("./data.json");

const Projects = require("./models/Projects.js");
const Tools = require("./models/Tools");
const Project_Tools = require("./models/Project-Tools.js");

const uri = `mongodb+srv://${data.username}:${data.password}@cluster0.tnajcgm.mongodb.net/Portfolio?retryWrites=true&w=majority&appName=Cluster0`;

mongoose.connect(uri).then(() => {
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

    console.log(projectsAndTools);

    res.status(200).json(projectsAndTools);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.listen(data.port, () => {
  console.log("Server is listening");
});
