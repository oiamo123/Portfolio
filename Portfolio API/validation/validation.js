const { z } = require("zod");
const sanitizer = require("sanitize-html");
const request = require("../request.json");
const { decrypt } = require("../crypto/crypto.js");

const Data = require("../models/Data.js");

const sanitize = function (string) {
  const sanitized = sanitizer(string, {
    allowedTags: [],
    allowedAttributes: [],
  });

  return sanitized;
};

const emailSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  email: z.string().email(),
  message: z.string().min(10, "Message must be at least 20 characters"),
});

const validateSchema = function (schema) {
  return (req, res, next) => {
    try {
      const dataToValidate = {
        name: sanitize(req.body.name),
        email: sanitize(req.body.email),
        message: sanitize(req.body.message),
      };

      schema.parse(dataToValidate);
      next();
    } catch (err) {
      const errors = err.errors.map((e) => ({
        path: e.path.join("."),
        message: e.message,
      }));
      res.status(200).json(errors);
    }
  };
};

const validateRecaptcha = async function (req, res, next) {
  request.event.token = sanitize(req.body.token);
  request.event.expectedAction = "mail";

  const apiKey = await Data.findOne({ for: "APIKey" }).lean();
  const apiKeyDecrypted = decrypt(apiKey.key);

  const recaptchaResponse = await fetch(
    `https://recaptchaenterprise.googleapis.com/v1/projects/numeric-camp-431804-f4/assessments?key=${apiKeyDecrypted}`,
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
        "Sorry, your request can't be processed right now due to suspicious activity.",
    });
  } else {
    next();
  }
};

module.exports = {
  emailSchema,
  validateSchema,
  validateRecaptcha,
  sanitize,
};
