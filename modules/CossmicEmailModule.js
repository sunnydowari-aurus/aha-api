// const nodemailer = require('nodemailer'); // Not currently used
// const sesTransport = require('nodemailer-ses-transport'); // Not currently used
const path = require('path');
const cossmicSchema = require(path.join(__dirname, '../schemas/CossmicEmailMaster'));

module.exports.createEmail = async (req, res, next) => {
    try {
        const {
            Name,
            EmailID,
            MobileNo,
            Message,
            Url,
            whenEntered,
        } = req.body;

        const cteMaster = await cossmicSchema.create({
            Name,
            EmailID,
            MobileNo,
            Message,
            Url,
            whenEntered: new Date(),
        });

        if (!cteMaster) {
            res.status(500).json({ message: "Try Again !", result: false });
            return;
        } else if (Name == "" || EmailID == "" || MobileNo == "") {
            res.status(400).json({ message: "Required fields missing", result: false });
            return;
        }

        // Add email sending logic here if needed
        res.status(200).json({ message: "Email created successfully", data: cteMaster, result: true });
    } catch (error) {
        console.error("Error in createEmail:", error);
        res.status(500).json({ message: "Internal server error", result: false });
    }
};

