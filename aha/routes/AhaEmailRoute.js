const express = require("express");
const router = express.Router();
const emailModule = require("../module/AHAEmailModule");


router.post("/sendEmail", emailModule.sendAHAEmail);
router.post("/sendNewAHAEmail", emailModule.sendNewAHAEmail);
router.post("/sendEmailZohoAHA", emailModule.sendEmailZohoAHA);
router.post("/sendWhatsappData", emailModule.sendWhatsappData);
router.post("/sendEmailFranchise", emailModule.sendEmailFranchise);
router.post("/sendAurusEmail", emailModule.sendAurusEmail);
router.post("/getEmail", emailModule.getAHAEmail);
router.post("/getAHALog", emailModule.getAHALog);
router.post("/getAurusEmail", emailModule.getAurusEmail);
router.post("/updateEmail", emailModule.updateAHAEmail);
router.post("/updateAurusEmail", emailModule.updateAurusEmail);
router.post("/sendCurtainsEmail", emailModule.sendAHACurtainsEmail);
router.post("/careerAurusEmail", emailModule.careerAurusEmail);
router.post("/sendMumbaiLandingEmail", emailModule.sendMumbaiLandingEmail);
router.post("/WebHook", emailModule.WebHook);


module.exports = router;
