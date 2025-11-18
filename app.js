var createError = require("http-errors");
const express = require("express");
require('dotenv').config()
var cors = require('cors')
require('./connection') /* Cossmic Aha  DB Connection file import  */
const app = express();
app.use(cors({ origin: ["http://localhost:5012", "https://pmt.ahasmarthomes.com","http://192.168.2.235:5011","https://ha.ahasmarthomes.com", "http://13.127.48.223:5012", "https://www.ahasmarthomes.com", "https://www.aurusit.com"], credentials: true, preflightContinue: false, exposedHeaders: ['SET-COOKIE'], methods: ['GET', 'POST', 'DELETE', 'UPDATE', 'PUT', 'PATCH'] }));
app.use(express.static(__dirname + '/'));  /* Get Local Uploaded Img*/ 

app.use(express.json())  
let port = 5020;
app.use(require('./src/routes/Order'))


var whitelist = ["https://pmt.ahasmarthomes.com","https://ha.ahasmarthomes.com","http://192.168.2.235:5011","https://www.ahasmarthomes.com"];
app.all("*", async (req, res, next) => {
  var origin = req.headers.origin;
  if (whitelist.indexOf(origin) != -1) {
    res.header("Access-Control-Allow-Origin", origin);
  }
  res.header("Access-Control-Allow-Headers", ["Content-Type", "X-Requested-With", "X-HTTP-Method-Override", "Accept","userToken"]);
  res.header("Access-Control-Expose-Headers", ["userToken"]);
  res.header("Access-Control-Allow-Credentials", true);
  res.header("Access-Control-Allow-Methods", "GET,POST,PATCH");
  res.header("Cache-Control", "no-store,no-cache,must-revalidate");
  res.header("Vary", "Origin");
  if (req.method === "OPTIONS") {
    res.status(200).send("");
    return;
  }
  next()
});

// ==cossmic route==
var cossmicRouter = require('./cossmic/routes/CossmicMasterRoute')
var ahaSendEmailRouter = require('./aha/routes/AhaEmailRoute')
require('./src/db/conn')   /*  DB Connection file import  */

const middelware=(req,res,next)=>{
    console.log("hello this is my middelware")
    next();
    }
let hostname="15.184.192.208"
app.get("/about",middelware, (req, res) => {
	res.send("Welcome Node Page");
});

// ==cossmic route link==
app.use("/CossmicEmail", cossmicRouter);
app.use("/AhaEmail", ahaSendEmailRouter);
app.use(function (req, res, next) {

     next(createError(404));
});
  

process.on("uncaughtException", function(e) {
 
  console.log("Exception raised on Production Server:" + e);
  
  })


  app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get("env") === "development" ? err : {};

    // render the error page
    res.status(err.status || 500);
    //res.render("error");
    console.log( " error: " + err + " Req:" + req)
    res.json({
        message: req + ", error: " + err,
        error: err,
        status: 500,
         result:false
      });
      
});


app.listen(port,() => {
	console.log(`server up and running on port http://${hostname}:${port}`);
});