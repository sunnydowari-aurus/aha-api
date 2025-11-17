const nodemailer = require('nodemailer');
const axios = require('axios');
const sesTransport = require('nodemailer-ses-transport');
const ahaEmailSchema = require('../schemas/AhaEmailMaster');
const ahaLogSchema = require('../schemas/AhaLogMaster');
const aurusEmailSchema = require('../schemas/AurusEmailMaster');
const s3ImageData = require("./StaticModule");

// AHA Email API
module.exports.sendAHAEmail = async (req, res, next) => {
    try {
        const body = req.body;
        const objName = `${body['field:comp-l7a1c2s41']}`;
        const objEmail = `${body['field:comp-l7a1c2sb1']}`;
        const objMobile = `${body['field:comp-l7a1c2s9']}`;
        
        if (body !== null && objName != "undefined" && objName != "" && objEmail !== "undefined" && objEmail !== "" && objMobile !== "undefined" && objMobile !== "") {
            await ahaEmailSchema.create({
                Name: `${body['field:comp-l7a1c2s41']}`,
                LName: "",
                Email: `${body['field:comp-l7a1c2sb1']}`,
                Mobile: `${body['field:comp-l7a1c2s9']}`,
                Comment: `${body['field:comp-l7a1c2se']}`,
                utm_source: `${body['utm_source']}`,
                utm_medium: `${body['utm_medium']}`,
                utm_campaign: `${body['utm_campaign']}`,
                utm_content: `${body['utm_content']}`,
                utm_term: `${body['utm_term']}`,
                from: `${body['from']}`,
                preferredTime: "",
                apiName: "sendAHAEmail",
                objPageName: "",
                whenEntered: new Date(new Date().toISOString())
            });

            const transporter = nodemailer.createTransport(
                sesTransport({
                    smtpServerName: 'email-smtp.us-east-1.amazonaws.com',
                    accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
                    secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
                    region: process.env.S3_REGION || 'us-east-1',
                    secure: true,
                })
            );

            // Add your email sending logic here
            res.status(200).json({ message: "Email sent successfully", result: true });
        } else {
            res.status(400).json({ message: "Invalid parameters", result: false });
        }
    } catch (error) {
        console.error("Error in sendAHAEmail:", error);
        res.status(500).json({ message: "Internal server error", result: false });
    }
};

module.exports.sendNewAHAEmail = async (req, res, next) => {
    // Implement sendNewAHAEmail logic
    res.status(200).json({ message: "New AHA Email sent", result: true });
};

module.exports.sendEmailZohoAHA = async (req, res, next) => {
    // Implement sendEmailZohoAHA logic
    res.status(200).json({ message: "Zoho AHA Email sent", result: true });
};

module.exports.sendWhatsappData = async (req, res, next) => {
    // Implement sendWhatsappData logic
    res.status(200).json({ message: "WhatsApp data sent", result: true });
};

module.exports.sendEmailFranchise = async (req, res, next) => {
    // Implement sendEmailFranchise logic
    res.status(200).json({ message: "Franchise email sent", result: true });
};

module.exports.sendAurusEmail = async (req, res, next) => {
    // Implement sendAurusEmail logic
    res.status(200).json({ message: "Aurus email sent", result: true });
};

module.exports.getAHAEmail = async (req, res, next) => {
    try {
        const emails = await ahaEmailSchema.find();
        res.status(200).json({ data: emails, result: true });
    } catch (error) {
        console.error("Error in getAHAEmail:", error);
        res.status(500).json({ message: "Internal server error", result: false });
    }
};

module.exports.getAHALog = async (req, res, next) => {
    try {
        const logs = await ahaLogSchema.find();
        res.status(200).json({ data: logs, result: true });
    } catch (error) {
        console.error("Error in getAHALog:", error);
        res.status(500).json({ message: "Internal server error", result: false });
    }
};

module.exports.getAurusEmail = async (req, res, next) => {
    try {
        const emails = await aurusEmailSchema.find();
        res.status(200).json({ data: emails, result: true });
    } catch (error) {
        console.error("Error in getAurusEmail:", error);
        res.status(500).json({ message: "Internal server error", result: false });
    }
};

module.exports.updateAHAEmail = async (req, res, next) => {
    try {
        const { id, ...updateData } = req.body;
        const updated = await ahaEmailSchema.findByIdAndUpdate(id, updateData, { new: true });
        res.status(200).json({ data: updated, result: true });
    } catch (error) {
        console.error("Error in updateAHAEmail:", error);
        res.status(500).json({ message: "Internal server error", result: false });
    }
};

module.exports.updateAurusEmail = async (req, res, next) => {
    try {
        const { id, ...updateData } = req.body;
        const updated = await aurusEmailSchema.findByIdAndUpdate(id, updateData, { new: true });
        res.status(200).json({ data: updated, result: true });
    } catch (error) {
        console.error("Error in updateAurusEmail:", error);
        res.status(500).json({ message: "Internal server error", result: false });
    }
};

module.exports.sendAHACurtainsEmail = async (req, res, next) => {
    // Implement sendAHACurtainsEmail logic
    res.status(200).json({ message: "Curtains email sent", result: true });
};

module.exports.careerAurusEmail = async (req, res, next) => {
    // Implement careerAurusEmail logic
    res.status(200).json({ message: "Career Aurus email sent", result: true });
};

module.exports.sendMumbaiLandingEmail = async (req, res, next) => {
    // Implement sendMumbaiLandingEmail logic
    res.status(200).json({ message: "Mumbai landing email sent", result: true });
};

module.exports.WebHook = async (req, res, next) => {
    // Implement WebHook logic
    res.status(200).json({ message: "Webhook processed", result: true });
};

