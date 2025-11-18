const { response } = require("express");
const express = require("express");
const router = express.Router();
const jwt = require('jsonwebtoken');
const axios = require('axios');
// var fs = require('fs');


const getResourseId = async (oid, Accountno, RISTA_APIKEY, RISTA_SECRET, RISTA_TABLE_Url, RISTA_BRANCH, PLATFORM) => {
    try {
        let totalseconds = new Date().getTime() / 1000
        // console.log("totalseconds", totalseconds)
        let payload = {
            iss: RISTA_APIKEY,
            iat: totalseconds,
            jti: PLATFORM + "_" + oid
        }
        // console.log("payload", payload)
        const token = jwt.sign(payload, RISTA_SECRET)
        let headerConfig = {
            headers: {
                "x-api-key": RISTA_APIKEY,
                "x-api-token": token
            }
        }
        let url = RISTA_TABLE_Url + RISTA_BRANCH
        let response = await axios.get(url, headerConfig)
        // console.log("response",response)
        if (response.data.length > 0) {
            let obj = {
                status: response.status,
                resultCount: response.data.filter((e, i) => e.name === Accountno).length,
                result: response.data.filter((e, i) => e.name === Accountno),
            }
            obj.resultCount<=0?obj = {}:null

            
            return obj
        }

    } catch (err) {
        console.log('\x1b[31m', `Function getResourceId OrderID:" ${oid}, ${RISTA_BRANCH}, ${new Date()}`)
        return {
            status: err.response.status,
            message: err.response.data.message,
        }
    }
}


// getResourseId
router.post("/getResourceId", async (req, res) => {
    let { orderid, Accountno, RISTA_APIKEY, RISTA_SECRET, RISTA_TABLE_Url, RISTA_BRANCH, PLATFORM } = req.body;
    try{
    if (orderid && Accountno && RISTA_APIKEY && RISTA_SECRET && RISTA_TABLE_Url && RISTA_BRANCH && PLATFORM) {
        let Data = await getResourseId(orderid, Accountno, RISTA_APIKEY, RISTA_SECRET, RISTA_TABLE_Url, RISTA_BRANCH, PLATFORM)
        if (Data.result) {
            Data.result.length > 0 ? console.log("\x1b[32m", `/getResourceId Success ${orderid}, ${Data.result[0].resourceId} , ${RISTA_BRANCH} , ${Data.status} Success ${new Date()}  `) : console.log('\x1b[31m', `/getResourceId 400 fail resourceId not available due to Invalid Accountno ${orderid} , ${RISTA_TABLE_Url} , ${new Date()}  `)
            res.status(Data.result.length > 0 ? Data.status : 400).send({
                // status: Data.status,
                // resultCount: Data.resultCount,
                // result: Data.result,
                resourceId: Data.result.length > 0 ? Data.result[0].resourceId : null,
                message: Data.result.length > 0 ? "Success resourceId" : "resourceId not available due to Invalid Accountno"
            });
        }
        else {
            console.log('\x1b[31m', `/getResourceId 400 Fail ${orderid} ,${Accountno}, ${RISTA_BRANCH} , ${new Date()}`)
            res.status(200).send({
                status: 400,
                message: "resourceId not available due to Some Invalid Keys"
            });
        }
    }
    else if (!RISTA_APIKEY || !RISTA_SECRET || !RISTA_TABLE_Url || !RISTA_BRANCH || !PLATFORM) {
        console.log('\x1b[31m', `/getResourceId 400 Fail some parameter missing check proper parameters like RISTA_APIKEY,RISTA_SECRET,RISTA_TABLE_Url,RISTA_BRANCH,PLATFORM ${orderid} , ${RISTA_TABLE_Url} , ${new Date()}`)
        res.status(200).send({
            status: 400,
            result:true,
            message: "some parameter missing check proper parameters like RISTA_APIKEY,RISTA_SECRET,RISTA_TABLE_Url,RISTA_BRANCH,PLATFORM"
        });
    }
    else if (orderid && !Accountno) {
        console.log('\x1b[31m', `/getResourceId 400 Fail Accountno Missing ${orderid} ,${Accountno}, ${RISTA_BRANCH} , ${new Date()}`)
        res.status(200).send({
            status: 400,
            result:true,
            message: "Accountno Missing"
        });
    }
    else if (!orderid && Accountno) {
        console.log('\x1b[31m', `/getResourceId 400 Fail orderid Missing ${orderid} ,${Accountno}, ${RISTA_BRANCH} , ${new Date()}`)
        res.status(200).send({
            status: 400,
            result:true,
            message: "orderid Missing"
        });
    }
    else {
        console.log('\x1b[31m', `/getResourceId 400 Fail orderid & Accountno Missing ${orderid} , ${RISTA_BRANCH} , ${new Date()}`)
        res.status(200).send({
            status: 400,
            result:true,
            message: "orderid & Accountno Missing"
        });
    }
} catch (err) {
    console.log('\x1b[31m', `API /getResourceId OrderID:" ${orderid}, ${Accountno},${RISTA_BRANCH}, ${new Date()}`)
    return {
        status: 500,
         result:true,
        message: err.response.data.message,
    }
}
})

// PushOrderDataRista
router.post("/PushOrderDataRista", async (req, res) => {
    let { orderid, Accountno, Custname, Items, RISTA_APIKEY, RISTA_SECRET, RISTA_TABLE_Url, RISTA_BRANCH, PLATFORM, RISTA_API_Url, RISTAT_CHANNEL } = req.body;
   try{
    if (orderid && Accountno && Custname && Items && RISTA_APIKEY && RISTA_SECRET && RISTA_TABLE_Url && RISTA_BRANCH && PLATFORM && RISTA_API_Url && RISTAT_CHANNEL) {
        let Data = await getResourseId(orderid, Accountno, RISTA_APIKEY, RISTA_SECRET, RISTA_TABLE_Url, RISTA_BRANCH, PLATFORM)
        if (Data != null && Data.result != undefined && Data.result[0].resourceId != undefined) {
            let lsDyn = []
            Items.map((itm, idx) => {
                lsDyn.push(
                    {
                        shortName: itm.ItemName,
                        longName: itm.ItemName,
                        skuCode: itm.ItemCode.toString(),
                        quantity: itm.Qty,
                        unitPrice: itm.Rate,
                        overridden: true
                    }
                )
            })

            let dynObjRista = {
                branchCode: RISTA_BRANCH,
                channel: RISTAT_CHANNEL,
                sourceInfo: {
                    invoiceNumber: orderid.toString(),
                    invoiceDate: new Date(),
                    callbackURL: "",
                    callbackHeaders: {}
                },
                customer: {
                    name: Custname,
                    phoneNumber: ""
                },
                resourceInfo: {
                    resourceId: Data.result[0].resourceId,
                    resourceName: Accountno,
                    groupSize: 4
                },
                items: lsDyn
            }
            let AllBkupData = JSON.stringify(dynObjRista)

            // ReadWrite txt file
            // var logger = fs.createWriteStream('../myTxt.txt', {
            //     flags: 'a' // 'a' means appending (old data will be preserved)
            //   })
            //   logger.write('\n')
            //   logger.write("******")
            //   logger.write(new Date().toString())
            //   logger.write('\n')
            //   logger.write(AllBkupData)
            //   logger.write('\n')
            //   logger.write("******")

            // Api Calling
            let totalseconds = new Date().getTime() / 1000
            let payload = {
                iss: RISTA_APIKEY,
                iat: totalseconds,
                jti: PLATFORM + "_" + orderid
            }
            const token = jwt.sign(payload, RISTA_SECRET)
            let headerConfig = {
                headers: {
                    "x-api-key": RISTA_APIKEY,
                    "x-api-token": token
                }
            }
            let url = RISTA_API_Url
            console.log("Rista Order API Parameters data: ", JSON.stringify(dynObjRista));
            axios.post(url, dynObjRista, headerConfig)
                .then((response) => {
                    // console.log("success", response.status)
                    console.log("\x1b[32m", `/PushOrderDataRista 200 Success ${orderid}, Resourceid: ${ Data.result[0].resourceId}, ${RISTA_BRANCH}, ${JSON.stringify(Items)},  ${new Date()}`)
                    res.status(200).send({
                        result: true,
                        message: "Successfully Added"
                    })
                })
                .catch((err) => {
                    // console.log("err", err.response.status)
                    if (err.response.status == 409) {
                        console.log("\x1b[32m", `/PushOrderDataRista 409 Success ${orderid}, Resourceid: ${ Data.result[0].resourceId}, ${RISTA_BRANCH}, ${err.response.data.message}, ${JSON.stringify(Items)}, ${new Date()}`)
                        res.status(200).send({
                            result: true,
                            message: err.response.data.message
                        })
                    }
                    else {
                        console.log('\x1b[31m', `/PushOrderDataRista OID: ${orderid}, Resourceid: ${ Data.result[0].resourceId}, Brnch: ${RISTA_BRANCH}, ${err.response.status},  ${JSON.stringify(Items)}, fail ${err.response.data.message} ${new Date()}`)
                        res.status(err.response.status).send({
                            result: false,
                            message: err.response.data.message
                        })
                    }
                })
        }
        else {
            console.log('\x1b[31m', `/PushOrderDataRista135 "resourceId not available due to Invalid Accountno Or Some Invalid Keys" ${orderid}, ${RISTA_BRANCH},  ${JSON.stringify(Items)}, ${new Date()}`)
            res.status(200).send({
                status: 400,
                result:true,
                message: "resourceId not available due to Invalid Accountno Or Some Invalid Keys"
            });
        }
    }
    else if (!RISTA_APIKEY || !RISTA_SECRET || !RISTA_TABLE_Url || !RISTA_BRANCH || !PLATFORM || !RISTA_API_Url || !RISTAT_CHANNEL) {
        console.log('\x1b[31m', `/PushOrderDataRista 400 Fail some parameter missing check proper parameters like RISTA_APIKEY,RISTA_SECRET,RISTA_TABLE_Url,RISTA_BRANCH,PLATFORM,RISTA_API_Url,RISTAT_CHANNEL ${orderid}, ${RISTA_BRANCH},  ${JSON.stringify(Items)}, ${new Date()}`)
        res.status(200).send({
            status: 400,
            result:true,
            message: "some parameter missing check proper parameters like RISTA_APIKEY,RISTA_SECRET,RISTA_TABLE_Url,RISTA_BRANCH,PLATFORM,RISTA_API_Url,RISTAT_CHANNEL"
        });
    }
    else {
        console.log('\x1b[31m', `/PushOrderDataRista 400 Fail some parameter missing check proper parameters like orderid,Accountno,Custname,Items ${orderid}, ${RISTA_BRANCH},  ${JSON.stringify(Items)}, ${new Date()}`)
        res.status(200).send({
            status: 400,
            result:true,
            message: "some parameter missing check proper parameters like orderid,Accountno,Custname,Items"
        });
    }

} catch (err) {
    console.log('\x1b[31m', `API /PushOrderDataRista OrderID:" ${orderid}, ${Accountno},${RISTA_BRANCH}, ${new Date()}, ${JSON.stringify(Items)}`)
    return {
        status: 500,
         result:true,
        message: err.response,
    }
}

})
module.exports = router;