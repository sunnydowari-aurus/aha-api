const AWS = require("aws-sdk");

exports.uploadImageAWS = async (fileData,folderName) => {
    console.log('file.............', folderName)
    const imageURL = fileData.file?fileData.file:"";
    AWS.config.update({ region: process.env.S3_REGION });
    const s3 = new AWS.S3({
        accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
    });
    try {
        let params = await {
            Bucket: process.env.BUCKET_NAME,
            Key: `${folderName}${fileData.name.replace(/ /g, "-")}`, // File name you want to save as in S3
            Body: new Buffer.from(
                imageURL.replace(/^data:image\/\w+;base64,/, ""),
                "base64"
            ),
            ACL: "public-read",
            CacheControl: "max-age=31536000",
            Expires: new Date(
                new Date().setFullYear(new Date().getFullYear() + 20)
            ),
        };

        console.log(params);

        // Uploading files to the bucket
        await s3.upload(params, function (err, data) {
            if (err) {
                console.log(err);
                throw err;
            }
            // res.status(200).json({ message: `success`, data });
        });
    } catch (error) {
        console.log(error.message);
    }
};
